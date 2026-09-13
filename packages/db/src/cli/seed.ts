import { createDb } from '../client.js';
import { migrate } from '../migrator.js';
import { seed } from '../seed/index.js';

const { db, pool } = createDb();
try {
  await migrate(db);
  const existing = await db.selectFrom('problems').select('id').limit(1).executeTakeFirst();
  if (existing) {
    console.error('Database already contains problems. Run `pnpm db:reset` first to reseed.');
    process.exitCode = 1;
  } else {
    const summary = await seed(db);
    console.log('Seed complete:');
    for (const [key, value] of Object.entries(summary)) {
      console.log(`  ${key.padEnd(18)} ${value}`);
    }
  }
} finally {
  await db.destroy();
  await pool.end().catch(() => undefined);
}
