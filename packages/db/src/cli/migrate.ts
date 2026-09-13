import { createDb } from '../client.js';
import { migrate } from '../migrator.js';

const { db, pool } = createDb();
try {
  const result = await migrate(db);
  console.log(
    result.applied.length > 0
      ? `Applied ${result.applied.length} migration(s): ${result.applied.join(', ')}`
      : 'Database is up to date.',
  );
} finally {
  await db.destroy();
  await pool.end().catch(() => undefined);
}
