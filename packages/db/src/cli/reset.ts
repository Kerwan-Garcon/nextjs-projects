import { createDb } from '../client.js';
import { dropAll, migrate } from '../migrator.js';

const { db, pool } = createDb();
try {
  await dropAll(db);
  const result = await migrate(db);
  console.log(`Schema reset. Applied ${result.applied.length} migration(s).`);
} finally {
  await db.destroy();
  await pool.end().catch(() => undefined);
}
