/**
 * The daily-run rule.
 *
 * A deployment can be driven by the worker's own clock, by a platform scheduler
 * calling an HTTP endpoint, or - during a migration between the two - by both.
 * Two copies of "have we already run today" is how it ends up fetching every
 * publisher twice, so there is one, and it is pure.
 */

export const DEFAULT_INTAKE_HOUR_UTC = 5;

export function resolveScheduleHour(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env.INTAKE_HOUR_UTC ?? DEFAULT_INTAKE_HOUR_UTC);
  return Number.isInteger(raw) && raw >= 0 && raw <= 23 ? raw : DEFAULT_INTAKE_HOUR_UTC;
}

/**
 * Should a cycle run now?
 *
 * The decision is taken from the last recorded run rather than from an
 * in-process timer, which is what makes it survive a restart: a worker
 * restarted four times in an hour still ingests once that day, and a platform
 * scheduler that retries or fires twice across regions does not double up.
 */
export function shouldRunDaily(input: { now: Date; lastRunAt: Date | null; hour: number }): boolean {
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
