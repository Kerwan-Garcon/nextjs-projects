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

    if (!bucket || bucket.resetAt <= now) {
      const resetAt = now + windowMs;
      this.windows.set(key, { count: 1, resetAt });
      return { allowed: true, remaining: limit - 1, limit, resetAt };
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

export const RATE_LIMITS = {
  write: { limit: 30, windowMs: 60_000 },
  agentRun: { limit: 12, windowMs: 60_000 },
  read: { limit: 600, windowMs: 60_000 },
} as const;
