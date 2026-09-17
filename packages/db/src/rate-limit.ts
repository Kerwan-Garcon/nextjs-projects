import { sql } from 'kysely';
import type { RateLimitDecision, RateLimiter } from '@saveus/common';
import type { Db } from './client.js';

/**
 * Rate limiting in Postgres.
 *
 * The in-memory limiter keeps its counters in a Map, which is correct for one
 * long-running server and worthless for anything else. On a serverless host
 * every invocation starts with an empty Map, so the limit becomes "one request
 * per request" - the middleware runs, decides yes, and protects nothing.
 *
 * This keeps the counter where every process can see it. One statement per
 * check: the upsert both increments and reports, so a decision costs a single
 * round trip rather than a read followed by a write that races it.
 */
export class PostgresRateLimiter implements RateLimiter {
  constructor(private readonly db: Db) {}

  async check(key: string, limit: number, windowMs: number): Promise<RateLimitDecision> {
    const seconds = Math.max(1, Math.round(windowMs / 1000));

    // The CASE arms are what make this a fixed window: an expired row is reset
    // rather than deleted, so a lapsed key and a fresh one take the same path.
    const result = await sql<{ count: number; expires_at: Date }>`
      INSERT INTO rate_limits (key, count, expires_at)
      VALUES (${key}, 1, now() + make_interval(secs => ${seconds}))
      ON CONFLICT (key) DO UPDATE SET
        count = CASE
          WHEN rate_limits.expires_at <= now() THEN 1
          ELSE rate_limits.count + 1
        END,
        expires_at = CASE
          WHEN rate_limits.expires_at <= now() THEN now() + make_interval(secs => ${seconds})
          ELSE rate_limits.expires_at
        END
      RETURNING count, expires_at
    `.execute(this.db);

    const row = result.rows[0];
    if (!row) {
      // Unreachable via RETURNING, but a limiter that throws would take the
      // whole request down. Failing open on an impossible branch is the lesser
      // of the two, and it is loud in the logs.
      console.warn('[rate-limit] upsert returned no row; allowing the request');
      return { allowed: true, remaining: limit - 1, limit, resetAt: Date.now() + windowMs };
    }

    return {
      allowed: row.count <= limit,
      remaining: Math.max(0, limit - row.count),
      limit,
      resetAt: new Date(row.expires_at).getTime(),
    };
  }

  /**
   * Drop lapsed rows. Keys are bounded by users and addresses rather than by
   * requests, so this is housekeeping rather than a necessity - it is called
   * from the daily cycle, not from the request path.
   */
  async sweep(): Promise<number> {
    const result = await this.db
      .deleteFrom('rate_limits')
      .where('expires_at', '<', new Date())
      .executeTakeFirst();
    return Number(result.numDeletedRows ?? 0);
  }
}
