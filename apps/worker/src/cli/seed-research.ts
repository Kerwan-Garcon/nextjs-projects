import { seedDemoResearch } from '@saveus/agents';
import { createDb } from '@saveus/db';

/**
 * Produces the demo agent runs by executing real pipelines against the seeded
 * corpus. Kept in the worker because that is where agent execution belongs;
 * the database package must not depend on the agent runtime.
 */
const { db, pool } = createDb();
try {
  const existing = await db.selectFrom('agent_runs').select('id').limit(1).executeTakeFirst();
  if (existing) {
    console.log('Agent runs already present; skipping research seeding.');
  } else {
    const summary = await seedDemoResearch(db);
    console.log('Research seeding complete:');
    console.log(`  research sessions  ${summary.sessions}`);
    console.log(`  agent runs         ${summary.runs}`);
    console.log(`  findings           ${summary.findings}`);
    console.log(`  ingestion candidates ${summary.candidates}`);
  }
} finally {
  await db.destroy();
  await pool.end().catch(() => undefined);
}
