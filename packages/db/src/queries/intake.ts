import type { Db } from '../client.js';

/** When the scheduled intake last ran. The clock the daily rule is read against. */
export async function lastScheduledIngestion(db: Db): Promise<Date | null> {
  const row = await db
    .selectFrom('ingestion_runs')
    .where('trigger', '=', 'SCHEDULED')
    .select('started_at')
    .orderBy('started_at', 'desc')
    .limit(1)
    .executeTakeFirst();
  return row?.started_at ?? null;
}
