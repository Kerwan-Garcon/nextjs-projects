import { sql } from 'kysely';
import { createDb } from '../client.js';

/**
 * Synthetic volume, for measuring rather than for looking at.
 *
 * Optimising against the 21-problem demonstration seed tells you nothing: every
 * plan is a sequential scan of a table that fits in a page, and every one of
 * them is instant. This inflates the board to a size where the query planner
 * makes real decisions, so an index can be justified by a number instead of by
 * a hunch.
 *
 *   pnpm --filter @saveus/db loadgen 5000
 *
 * The rows are obvious nonsense - titles are numbered, bodies are repeated -
 * and every one is marked `origin = 'LOADTEST'` so it can be told apart from
 * the demonstration data and deleted in one statement. Never run this against
 * a database you intend to keep.
 */

const PROBLEMS = Number(process.argv[2] ?? 5_000);
const HYPOTHESES_PER_PROBLEM = 4;
const CONTRIBUTIONS_PER_PROBLEM = 40;
const SOURCES = 10_000;
const USERS = 2_000;

const { db, pool } = createDb();

async function step(label: string, run: () => Promise<unknown>): Promise<void> {
  const startedAt = Date.now();
  await run();
  console.log(`  ${label.padEnd(26)} ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
}

try {
  console.log(`Generating ${PROBLEMS} problems of synthetic load.\n`);

  await step('users', async () => {
    await sql`
      INSERT INTO users (handle, display_name, reputation, trust, is_anonymous, origin)
      SELECT 'load-' || i, 'Load ' || i, (random() * 400)::int, random(), false, 'LOADTEST'
      FROM generate_series(1, ${USERS}) AS i
      ON CONFLICT (handle) DO NOTHING
    `.execute(db);
  });

  await step('sources', async () => {
    await sql`
      INSERT INTO sources (title, authors, publisher, publication_date, url, canonical_url,
                           source_type, domain, reliability, content_hash, origin)
      SELECT 'Load source ' || i, ARRAY['Load Author'], 'Load Publisher', '2025-01-01',
             'https://loadtest.invalid/' || i, 'https://loadtest.invalid/' || i,
             'REPORT', 'other', 'MEDIUM', 'loadtest-' || i, 'LOADTEST'
      FROM generate_series(1, ${SOURCES}) AS i
      ON CONFLICT (canonical_url) DO NOTHING
    `.execute(db);
  });

  await step('problems', async () => {
    await sql`
      INSERT INTO problems (ref, slug, title, summary, description, geography_label,
                            geography_scale, difficulty, urgency, status, origin, created_at, updated_at)
      SELECT
        'L' || lpad(i::text, 6, '0'),
        'load-problem-' || i,
        'Load problem ' || i || ': a synthetic entry for measuring query plans',
        'Synthetic summary for load problem ' || i || ', long enough to resemble a real one.',
        repeat('Synthetic description. ', 40),
        (ARRAY['Global','Europe','Paris','Sahel','South Asia'])[1 + (i % 5)],
        (ARRAY['GLOBAL','CONTINENTAL','CITY','REGIONAL','NATIONAL'])[1 + (i % 5)],
        (i % 11), (i % 11), 'OPEN', 'LOADTEST',
        now() - make_interval(hours => i % 8760),
        now() - make_interval(hours => i % 8760)
      FROM generate_series(1, ${PROBLEMS}) AS i
      ON CONFLICT (slug) DO NOTHING
    `.execute(db);
  });

  await step('problem_domains', async () => {
    await sql`
      INSERT INTO problem_domains (problem_id, domain_key, is_primary)
      SELECT p.id, d.key, true
      FROM problems p
      JOIN LATERAL (
        SELECT key FROM domains ORDER BY md5(p.id::text || key) LIMIT 1
      ) d ON true
      WHERE p.origin = 'LOADTEST'
      ON CONFLICT DO NOTHING
    `.execute(db);
  });

  await step('problem_sources', async () => {
    await sql`
      WITH numbered_problems AS (
        SELECT id, row_number() OVER (ORDER BY ref) - 1 AS n
        FROM problems WHERE origin = 'LOADTEST'
      ), numbered_sources AS (
        SELECT id, row_number() OVER (ORDER BY content_hash) - 1 AS n,
               count(*) OVER () AS total
        FROM sources WHERE origin = 'LOADTEST'
      )
      INSERT INTO problem_sources (problem_id, source_id, role)
      SELECT p.id, s.id, 'EVIDENCE'
      FROM numbered_problems p
      CROSS JOIN generate_series(0, 5) AS k
      JOIN numbered_sources s ON s.n = (p.n * 6 + k) % s.total
      ON CONFLICT DO NOTHING
    `.execute(db);
  });

  await step('hypotheses', async () => {
    await sql`
      INSERT INTO hypotheses (ref, problem_id, title, claim, mechanism, expected_impact,
                              validation_method, author_id, status, origin, created_at, updated_at)
      SELECT
        'LH' || lpad(p.n::text, 7, '0') || '-' || k,
        p.id,
        'Load hypothesis ' || k || ' for problem ' || p.n,
        repeat('Synthetic claim. ', 6),
        repeat('Synthetic mechanism. ', 8),
        repeat('Synthetic impact. ', 4),
        repeat('Synthetic validation method. ', 4),
        u.id, 'PROPOSED', 'LOADTEST',
        p.created_at, p.created_at
      FROM (SELECT id, created_at, row_number() OVER (ORDER BY ref) AS n FROM problems WHERE origin = 'LOADTEST') p
      CROSS JOIN generate_series(1, ${HYPOTHESES_PER_PROBLEM}) AS k
      JOIN LATERAL (
        SELECT id FROM users WHERE origin = 'LOADTEST' ORDER BY md5(p.id::text || k::text) LIMIT 1
      ) u ON true
      ON CONFLICT (ref) DO NOTHING
    `.execute(db);
  });

  await step('contributions', async () => {
    await sql`
      INSERT INTO contributions (kind, target_type, target_id, problem_id, author_id, body,
                                 score, status, origin, created_at)
      SELECT
        (ARRAY['COMMENT','EVIDENCE','COUNTERARGUMENT','QUESTION'])[1 + (k % 4)],
        'PROBLEM', p.id, p.id, u.id,
        repeat('Synthetic contribution body. ', 5),
        (random() * 60)::real, 'ACTIVE', 'LOADTEST',
        p.created_at + make_interval(mins => k)
      FROM (SELECT id, created_at FROM problems WHERE origin = 'LOADTEST') p
      CROSS JOIN generate_series(1, ${CONTRIBUTIONS_PER_PROBLEM}) AS k
      JOIN LATERAL (
        SELECT id FROM users WHERE origin = 'LOADTEST' ORDER BY md5(p.id::text || k::text) LIMIT 1
      ) u ON true
    `.execute(db);
  });

  await step('analyze', async () => {
    await sql`ANALYZE`.execute(db);
  });

  const counts = await sql<{ table: string; n: number }>`
    SELECT 'problems' AS table, count(*)::int AS n FROM problems
    UNION ALL SELECT 'hypotheses', count(*)::int FROM hypotheses
    UNION ALL SELECT 'contributions', count(*)::int FROM contributions
    UNION ALL SELECT 'problem_sources', count(*)::int FROM problem_sources
    UNION ALL SELECT 'sources', count(*)::int FROM sources
    UNION ALL SELECT 'users', count(*)::int FROM users
  `.execute(db);

  console.log('\nTotals:');
  for (const row of counts.rows) console.log(`  ${row.table.padEnd(18)} ${row.n}`);
  console.log('\nRemove it all with: pnpm --filter @saveus/db loadgen:clear');
} finally {
  await db.destroy();
  await pool.end().catch(() => undefined);
}
