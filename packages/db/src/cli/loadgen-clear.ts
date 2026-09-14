import { sql } from 'kysely';
import { createDb } from '../client.js';

/** Remove everything `loadgen` created. Cascades handle the dependants. */
const { db, pool } = createDb();
try {
  for (const table of ['contributions', 'hypotheses', 'problems', 'sources', 'users']) {
    const result = await sql`DELETE FROM ${sql.ref(table)} WHERE origin = 'LOADTEST'`.execute(db);
    console.log(`  ${table.padEnd(16)} ${result.numAffectedRows ?? 0n} removed`);
  }
  await sql`ANALYZE`.execute(db);
} finally {
  await db.destroy();
  await pool.end().catch(() => undefined);
}
