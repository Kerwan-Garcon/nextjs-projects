import { describe, expect, it, vi } from 'vitest';
import {
  MemoryCache,
  NoopCache,
  RedisCache,
  RedisRateLimiter,
  type Cache,
} from '../src/index.js';

/**
 * A fake Redis, because the properties being tested are this code's, not the
 * server's: that only the first request of a window sets the expiry, that a
 * value which cannot be parsed is treated as absent, and that a cache which
 * fails does not fail the request behind it.
 */
function fakeRedis() {
  const store = new Map<string, { value: string; expiresAt: number | null }>();
  const calls = { incr: 0, pexpire: 0, set: 0, get: 0 };

  const live = (key: string) => {
    const entry = store.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      store.delete(key);
      return null;
    }
    return entry;
  };

  return {
    calls,
    store,
    async get(key: string) {
      calls.get += 1;
      return live(key)?.value ?? null;
    },
    async set(key: string, value: string, _mode: 'PX', ms: number) {
      calls.set += 1;
      store.set(key, { value, expiresAt: Date.now() + ms });
      return 'OK';
    },
    async del(key: string) {
      store.delete(key);
      return 1;
    },
    async incr(key: string) {
      calls.incr += 1;
      const entry = live(key);
      const next = Number(entry?.value ?? 0) + 1;
      store.set(key, { value: String(next), expiresAt: entry?.expiresAt ?? null });
      return next;
    },
    async pexpire(key: string, ms: number) {
      calls.pexpire += 1;
      const entry = store.get(key);
      if (entry) store.set(key, { ...entry, expiresAt: Date.now() + ms });
      return 1;
    },
    async pttl(key: string) {
      const entry = live(key);
      if (!entry) return -2;
      return entry.expiresAt === null ? -1 : entry.expiresAt - Date.now();
    },
  };
}

const shared = (make: () => Cache, label: string) => {
  describe(label, () => {
    it('returns what was put in, and nothing for what was not', async () => {
      const cache = make();
      await cache.set('k', { n: 1 }, 60_000);
      expect(await cache.get<{ n: number }>('k')).toEqual({ n: 1 });
      expect(await cache.get('absent')).toBeNull();
    });

    it('forgets a value once its time is up', async () => {
      const cache = make();
      await cache.set('k', 'v', 5);
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(await cache.get('k')).toBeNull();
    });

    it('produces once on a miss and reads after', async () => {
      const cache = make();
      const produce = vi.fn(async () => 'computed');

      expect(await cache.wrap('k', 60_000, produce)).toBe('computed');
      expect(await cache.wrap('k', 60_000, produce)).toBe('computed');
      expect(produce).toHaveBeenCalledTimes(1);
    });

    it('drops what it is told to', async () => {
      const cache = make();
      await cache.set('k', 'v', 60_000);
      await cache.delete('k');
      expect(await cache.get('k')).toBeNull();
    });
  });
};

shared(() => new MemoryCache(), 'the in-process cache');
shared(() => new RedisCache(fakeRedis()), 'the Redis cache');

describe('cache behaviour that is not shared', () => {
  it('the no-op cache always misses, so it never hides a bug', async () => {
    const cache = new NoopCache();
    await cache.set('k', 'v', 60_000);
    expect(await cache.get('k')).toBeNull();

    const produce = vi.fn(async () => 'computed');
    await cache.wrap('k', 60_000, produce);
    await cache.wrap('k', 60_000, produce);
    expect(produce).toHaveBeenCalledTimes(2);
  });

  it('the in-process cache is bounded, so a key built from input cannot grow it forever', async () => {
    const cache = new MemoryCache(3);
    for (let index = 0; index < 10; index += 1) await cache.set(`k${index}`, index, 60_000);
    // The oldest were evicted; the most recent survived.
    expect(await cache.get('k0')).toBeNull();
    expect(await cache.get('k9')).toBe(9);
  });

  it('treats a value it cannot parse as absent rather than throwing', async () => {
    const redis = fakeRedis();
    redis.store.set('saveus:cache:k', { value: 'not json', expiresAt: null });
    expect(await new RedisCache(redis).get('k')).toBeNull();
  });

  it('serves the request even when the cache is broken', async () => {
    const broken = {
      get: async () => { throw new Error('redis is down'); },
      set: async () => { throw new Error('redis is down'); },
      del: async () => { throw new Error('redis is down'); },
    };
    // A cache that cannot be reached is a slow request, not a failed one.
    expect(await new RedisCache(broken).wrap('k', 1_000, async () => 'computed')).toBe('computed');
  });
});

describe('rate limiting in Redis', () => {
  it('allows up to the limit and refuses past it', async () => {
    const limiter = new RedisRateLimiter(fakeRedis());
    expect((await limiter.check('k', 2, 60_000)).allowed).toBe(true);
    expect((await limiter.check('k', 2, 60_000)).allowed).toBe(true);

    const refused = await limiter.check('k', 2, 60_000);
    expect(refused.allowed).toBe(false);
    expect(refused.remaining).toBe(0);
  });

  it('sets the expiry once, so a steady caller cannot hold the window open', async () => {
    const redis = fakeRedis();
    const limiter = new RedisRateLimiter(redis);
    for (let attempt = 0; attempt < 5; attempt += 1) await limiter.check('k', 10, 60_000);

    expect(redis.calls.incr).toBe(5);
    // Only the request that opened the window; a sliding expiry would never reset.
    expect(redis.calls.pexpire).toBe(1);
  });

  it('opens a fresh window once the old one lapses', async () => {
    const limiter = new RedisRateLimiter(fakeRedis());
    expect((await limiter.check('k', 1, 10)).allowed).toBe(true);
    expect((await limiter.check('k', 1, 10)).allowed).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 25));
    expect((await limiter.check('k', 1, 10)).allowed).toBe(true);
  });

  it('repairs a key that somehow has no expiry rather than leaving it forever', async () => {
    const redis = fakeRedis();
    redis.store.set('saveus:rl:k', { value: '5', expiresAt: null });

    const decision = await new RedisRateLimiter(redis).check('k', 10, 30_000);
    expect(decision.resetAt).toBeGreaterThan(Date.now());
    expect(redis.calls.pexpire).toBeGreaterThan(0);
  });

  it('counts each key separately', async () => {
    const limiter = new RedisRateLimiter(fakeRedis());
    await limiter.check('a', 1, 60_000);
    expect((await limiter.check('a', 1, 60_000)).allowed).toBe(false);
    expect((await limiter.check('b', 1, 60_000)).allowed).toBe(true);
  });
});
