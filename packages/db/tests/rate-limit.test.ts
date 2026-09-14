import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, migrate, dropAll, PostgresRateLimiter, type Db } from '../src/index.js';
import type { Pool } from 'pg';

/**
 * The counter has to be shared, or it is not a limit.
 *
 * These run against a real database because the guarantee being tested is the
 * one the SQL provides: two processes checking the same key at the same moment
 * must see one counter, not two. A fake would test the fake.
 */
const URL_ = process.env.TEST_DATABASE_URL ?? 'postgres://saveus:saveus@127.0.0.1:5432/saveus_test';

let db: Db;
let pool: Pool;
let limiter: PostgresRateLimiter;

beforeAll(async () => {
  ({ db, pool } = createDb({
    connectionString: URL_,
    maxPoolSize: 6,
    ssl: false,
    rejectUnauthorized: false,
  }));
  await dropAll(db);
  await migrate(db);
  limiter = new PostgresRateLimiter(db);
}, 120_000);

afterAll(async () => {
  await db?.destroy();
  await pool?.end().catch(() => undefined);
});

const key = (name: string): string => `${name}:${Math.random().toString(36).slice(2)}`;

describe('rate limiting in Postgres', () => {
  it('allows up to the limit and refuses past it', async () => {
    const k = key('allow');
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const decision = await limiter.check(k, 3, 60_000);
      expect(decision.allowed, `attempt ${attempt}`).toBe(true);
      expect(decision.remaining).toBe(3 - attempt);
    }

    const refused = await limiter.check(k, 3, 60_000);
    expect(refused.allowed).toBe(false);
    expect(refused.remaining).toBe(0);
    expect(refused.limit).toBe(3);
  });

  it('counts each key on its own', async () => {
    const [a, b] = [key('a'), key('b')];
    await limiter.check(a, 1, 60_000);
    expect((await limiter.check(a, 1, 60_000)).allowed).toBe(false);
    expect((await limiter.check(b, 1, 60_000)).allowed).toBe(true);
  });

  it('opens a fresh window once the old one lapses', async () => {
    const k = key('window');
    // A window measured in milliseconds rounds to one second, the floor.
    expect((await limiter.check(k, 1, 1)).allowed).toBe(true);
    expect((await limiter.check(k, 1, 1)).allowed).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 1_200));
    const fresh = await limiter.check(k, 1, 1);
    expect(fresh.allowed).toBe(true);
    expect(fresh.remaining).toBe(0);
  });

  it('reports when the window resets', async () => {
    const decision = await limiter.check(key('reset'), 5, 30_000);
    const seconds = (decision.resetAt - Date.now()) / 1000;
    expect(seconds).toBeGreaterThan(25);
    expect(seconds).toBeLessThanOrEqual(31);
  });

  it('counts concurrent checks exactly once each', async () => {
    // The point of the whole exercise. Ten simultaneous requests against a
    // limit of four must produce four allowances, not ten - which is what a
    // read-then-write would produce, and what a per-process Map produces on
    // any host that runs more than one.
    const k = key('race');
    const decisions = await Promise.all(
      Array.from({ length: 10 }, () => limiter.check(k, 4, 60_000)),
    );

    expect(decisions.filter((decision) => decision.allowed)).toHaveLength(4);
  });

  it('sweeps lapsed rows and leaves live ones', async () => {
    const [stale, live] = [key('stale'), key('live')];
    await limiter.check(stale, 10, 1);
    await limiter.check(live, 10, 600_000);
    await new Promise((resolve) => setTimeout(resolve, 1_200));

    await limiter.sweep();

    const rows = await db.selectFrom('rate_limits').select('key').execute();
    const keys = rows.map((row) => row.key);
    expect(keys).not.toContain(stale);
    expect(keys).toContain(live);
  });
});
