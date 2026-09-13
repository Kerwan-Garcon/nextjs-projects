import { JOB_NAMES, type Queue } from '@saveus/common/queue';
import type { Db } from '@saveus/db';

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

export function resolveScheduleHour(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env.INTAKE_HOUR_UTC ?? 5);
  return Number.isInteger(raw) && raw >= 0 && raw <= 23 ? raw : 5;
}

/**
 * Should a cycle run now? Pure, so the rule is testable without waiting a day.
 */
export function shouldRunDaily(input: {
  now: Date;
  lastRunAt: Date | null;
  hour: number;
}): boolean {
  if (input.now.getUTCHours() < input.hour) return false;
  if (!input.lastRunAt) return true;

  const startOfToday = Date.UTC(
    input.now.getUTCFullYear(),
    input.now.getUTCMonth(),
    input.now.getUTCDate(),
    input.hour,
  );
  return input.lastRunAt.getTime() < startOfToday;
}

export async function lastIngestionAt(db: Db): Promise<Date | null> {
  const row = await db
    .selectFrom('ingestion_runs')
    .where('trigger', '=', 'SCHEDULED')
    .select('started_at')
    .orderBy('started_at', 'desc')
    .limit(1)
    .executeTakeFirst();
  return row?.started_at ?? null;
}

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
      const lastRunAt = await lastIngestionAt(this.options.db);
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
