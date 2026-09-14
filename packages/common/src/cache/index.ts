/**
 * A cache port, with the same shape as the queue port next to it: a structural
 * interface for the Redis client so this package never depends on a driver, and
 * an in-memory implementation so a deployment without Redis still works.
 *
 * What it is for is narrow. Not query results in general - staleness in a
 * research record is a correctness problem, and a page that shows yesterday's
 * evidence is worse than a page that takes another ten milliseconds. It is for
 * the handful of values that are expensive, global, and tolerant of being a
 * minute old: the platform counters in the header, chiefly, which measured
 * 22.7 ms and ran on every single page render.
 */

export interface Cache {
  readonly driver: 'memory' | 'redis' | 'none';
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlMs: number): Promise<void>;
  delete(key: string): Promise<void>;
  /** Read through: produce the value on a miss, and remember it. */
  wrap<T>(key: string, ttlMs: number, produce: () => Promise<T>): Promise<T>;
}

/** Shared read-through, so every implementation behaves identically on a miss. */
abstract class BaseCache implements Cache {
  abstract readonly driver: Cache['driver'];
  abstract get<T>(key: string): Promise<T | null>;
  abstract set<T>(key: string, value: T, ttlMs: number): Promise<void>;
  abstract delete(key: string): Promise<void>;

  async wrap<T>(key: string, ttlMs: number, produce: () => Promise<T>): Promise<T> {
    const hit = await this.get<T>(key).catch(() => null);
    if (hit !== null) return hit;

    const value = await produce();
    // A cache that cannot be written is a slow cache, not a broken request.
    await this.set(key, value, ttlMs).catch(() => undefined);
    return value;
  }
}

/**
 * Per-process. Correct for one long-running server, and on a serverless host it
 * is a cache per invocation - which is not useless (a single render reads the
 * counters more than once) but is not a shared cache either.
 */
export class MemoryCache extends BaseCache {
  readonly driver = 'memory';
  private readonly entries = new Map<string, { value: unknown; expiresAt: number }>();

  constructor(private readonly maxEntries = 500) {
    super();
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    // Bounded, so a key built from user input cannot grow the process forever.
    if (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }
}

interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: 'PX', milliseconds: number): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

/** Shared across every process, which is the only kind that helps under load. */
export class RedisCache extends BaseCache {
  readonly driver = 'redis';

  constructor(
    private readonly redis: RedisLike,
    private readonly prefix = 'saveus:cache:',
  ) {
    super();
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.redis.get(this.prefix + key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      // A value we cannot read is a value we do not have.
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    await this.redis.set(this.prefix + key, JSON.stringify(value), 'PX', Math.max(1, ttlMs));
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(this.prefix + key);
  }
}

/** Always a miss. For tests, and for anywhere caching would hide a bug. */
export class NoopCache extends BaseCache {
  readonly driver = 'none';
  async get<T>(): Promise<T | null> {
    return null;
  }
  async set(): Promise<void> {}
  async delete(): Promise<void> {}
}

/** How long each cached value may be stale. Deliberately short. */
export const CACHE_TTL = {
  /** Header counters. Nobody is harmed by a count that is a minute behind. */
  platformStats: 60_000,
  /** Reference data: domains, agents, the epistemic vocabulary. Changes on deploy. */
  reference: 300_000,
} as const;
