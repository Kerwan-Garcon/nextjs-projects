import { isLiveIntakeEnabled, resolveConnectors, runIngestion } from '@saveus/agents';
import { createDb } from '@saveus/db';

/**
 * Run one intake cycle now and print what the gate did with everything it saw.
 *
 *   INTAKE_LIVE=true pnpm --filter @saveus/worker intake
 */
const { db, pool } = createDb();
try {
  console.log(`Intake mode: ${isLiveIntakeEnabled() ? 'LIVE' : 'OFFLINE (set INTAKE_LIVE=true)'}\n`);
  const stats = await runIngestion({ db, connectors: resolveConnectors(db), trigger: 'MANUAL' });

  for (const stat of stats) {
    console.log(`${stat.connector}`);
    console.log(
      `  fetched ${stat.fetched} -> ${stat.accepted} accepted, ${stat.weak} weak, ` +
        `${stat.rejected} rejected, ${stat.duplicates} duplicate(s)`,
    );
    console.log(
      `  ${stat.candidates} candidate(s) queued for curation` +
        (stat.deferred > 0 ? `, ${stat.deferred} deferred over the per-run cap` : ''),
    );
    const reasons = Object.entries(stat.rejectionReasons).sort((a, b) => b[1] - a[1]);
    for (const [reason, count] of reasons.slice(0, 6)) {
      console.log(`    x${String(count).padStart(3)}  ${reason}`);
    }
    for (const error of stat.errors.slice(0, 8)) {
      console.log(`    ERROR ${error.externalId}: ${error.reason}`);
    }
    console.log();
  }
} finally {
  await db.destroy();
  await pool.end().catch(() => undefined);
}
