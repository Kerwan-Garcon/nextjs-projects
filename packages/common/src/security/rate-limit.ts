/**
 * Fixed-window rate limiting. Agent runs are expensive and writes are
 * abusable, so both are limited per identity.
 */

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: number;
}

export interface RateLimiter {
  check(key: string, limit: number, windowMs: number): Promise<RateLimitDecision>;
}

export class MemoryRateLimiter implements RateLimiter {
  private readonly windows = new Map<string, { count: number; resetAt: number }>();

  async check(key: string, limit: number, windowMs: number): Promise<RateLimitDecision> {
    const now = Date.now();
    const bucket = this.windows.get(key);

    // A fresh window and a live one take the same decision, or a limit of zero
    // still lets the first request through and `remaining` reports -1.
    if (!bucket || bucket.resetAt <= now) {
      const resetAt = now + windowMs;
      this.windows.set(key, { count: 1, resetAt });
      return { allowed: 1 <= limit, remaining: Math.max(0, limit - 1), limit, resetAt };
    }

    bucket.count += 1;
    return {
      allowed: bucket.count <= limit,
      remaining: Math.max(0, limit - bucket.count),
      limit,
      resetAt: bucket.resetAt,
    };
  }

  reset(): void {
    this.windows.clear();
  }
}

interface RedisLike {
  incr(key: string): Promise<number>;
  pexpire(key: string, milliseconds: number): Promise<unknown>;
  pttl(key: string): Promise<number>;
}

/**
 * Rate limiting in Redis.
 *
 * Postgres can hold the counter and does when it has to, but a limit is checked
 * on every request and a database round trip per request is a cost worth
 * avoiding when something cheaper is already connected. INCR is atomic, which
 * is the only property that matters here.
 */
export class RedisRateLimiter implements RateLimiter {
  constructor(
    private readonly redis: RedisLike,
    private readonly prefix = 'saveus:rl:',
  ) {}

  async check(key: string, limit: number, windowMs: number): Promise<RateLimitDecision> {
    const full = this.prefix + key;
    const count = await this.redis.incr(full);

    // Only the request that opened the window sets its expiry, so the window is
    // fixed rather than sliding forward on every hit - which would let a steady
    // caller hold a key open indefinitely.
    if (count === 1) await this.redis.pexpire(full, windowMs);

    const ttl = await this.redis.pttl(full);
    // -1 means no expiry was set, which should not happen; repair rather than
    // leave a key that never resets.
    if (ttl < 0) await this.redis.pexpire(full, windowMs);

    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      limit,
      resetAt: Date.now() + (ttl > 0 ? ttl : windowMs),
    };
  }
}

export interface RateLimitRule {
  limit: number;
  windowMs: number;
}

export interface RateLimitSettings {
  write: RateLimitRule;
  agentRun: RateLimitRule;
  read: RateLimitRule;
}

/**
 * Defaults, sized for one person using the platform hard rather than for a
 * crowd. A read limit of six hundred a minute is generous for a human and
 * restrictive for a load test, which is the correct way round.
 */
export const DEFAULT_RATE_LIMITS: RateLimitSettings = {
  write: { limit: 30, windowMs: 60_000 },
  agentRun: { limit: 12, windowMs: 60_000 },
  read: { limit: 600, windowMs: 60_000 },
};

/**
 * The right numbers depend on who is in front of the deployment - a CDN that
 * absorbs the board, a single origin taking everything, a private instance with
 * ten users - and none of that is knowable from here. So they are configurable,
 * and the defaults are only defaults.
 */
export function resolveRateLimits(env: NodeJS.ProcessEnv = process.env): RateLimitSettings {
  const positive = (raw: string | undefined, fallback: number): number => {
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
  };

  return {
    read: {
      limit: positive(env.RATE_LIMIT_READ_PER_MINUTE, DEFAULT_RATE_LIMITS.read.limit),
      windowMs: 60_000,
    },
    write: {
      limit: positive(env.RATE_LIMIT_WRITE_PER_MINUTE, DEFAULT_RATE_LIMITS.write.limit),
      windowMs: 60_000,
    },
    agentRun: {
      limit: positive(env.RATE_LIMIT_AGENT_RUNS_PER_MINUTE, DEFAULT_RATE_LIMITS.agentRun.limit),
      windowMs: 60_000,
    },
  };
}

