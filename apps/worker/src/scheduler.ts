import { resolveScheduleHour, shouldRunDaily } from '@saveus/common';
import { JOB_NAMES, type Queue } from '@saveus/common/queue';
import { lastScheduledIngestion, type Db } from '@saveus/db';

/**
 * The daily intake schedule.
 *
 * No cron dependency: the worker is already a long-running process, so it keeps
 * its own clock. Two properties matter more than precision.
 *
 * It is idempotent across restarts. The decision to run is taken from the last
 * recorded ingestion run in the database, not from an in-process timer, so a
 * worker that is restarted four times in an hour still ingests once that day.
 *
 * And it does not thunder. The hour is configurable and the check interval is
 * coarse, because there is no value in fetching a daily feed more often than it
 * is published.
 */

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

export interface SchedulerOptions {
  db: Db;
  queue: Queue;
  /** UTC hour at which the daily cycle should run. */
  hour?: number;
  checkIntervalMs?: number;
  now?: () => Date;
}

/**
 * Re-exported so callers of the worker keep one import, but the rule itself
 * lives in `@saveus/common` and the query in `@saveus/db`. A deployment can be
 * driven by this clock, by a platform scheduler calling `/api/cron/intake`, or
 * briefly by both, and two copies of "have we run today" is how it ingests
 * twice.
 */
export { resolveScheduleHour, shouldRunDaily };
export const lastIngestionAt = lastScheduledIngestion;

export class IntakeScheduler {
  private timer: NodeJS.Timeout | null = null;
  private readonly hour: number;
  private readonly checkIntervalMs: number;
  private readonly now: () => Date;

  constructor(private readonly options: SchedulerOptions) {
    this.hour = options.hour ?? resolveScheduleHour();
    this.checkIntervalMs = options.checkIntervalMs ?? CHECK_INTERVAL_MS;
    this.now = options.now ?? (() => new Date());
  }

  start(): void {
    if (this.timer) return;
    console.log(`[worker] intake scheduled daily at ${String(this.hour).padStart(2, '0')}:00 UTC.`);
    void this.tick();
    this.timer = setInterval(() => void this.tick(), this.checkIntervalMs);
    // Do not hold the process open on the timer alone.
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async tick(): Promise<boolean> {
    try {
      const lastRunAt = await lastScheduledIngestion(this.options.db);
      if (!shouldRunDaily({ now: this.now(), lastRunAt, hour: this.hour })) return false;

      // A stable key per day makes a double-enqueue a no-op.
      const day = this.now().toISOString().slice(0, 10);
      await this.options.queue.enqueue(
        JOB_NAMES.ingestionCycle,
        { trigger: 'SCHEDULED' },
        { idempotencyKey: `ingestion:${day}` },
      );
      console.log(`[worker] queued the daily intake cycle for ${day}.`);
      return true;
    } catch (error) {
      console.error('[worker] scheduler tick failed:', error instanceof Error ? error.message : error);
      return false;
    }
  }
}
