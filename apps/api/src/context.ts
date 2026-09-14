import { createRequire } from 'node:module';
import type Redis from 'ioredis';
import {
  MemoryCache,
  MemoryRateLimiter,
  NoopCache,
  RedisCache,
  RedisRateLimiter,
  resolveRateLimits,
  type Cache,
  type RateLimitSettings,
  type RateLimiter,
} from '@saveus/common';
import { InMemoryQueue, RedisQueue, type Queue } from '@saveus/common/queue';
import {
  CorpusSearchProvider,
  ProblemScopedSearchProvider,
  resolveProvider,
  type AIProvider,
  type ResearchSearchProvider,
} from '@saveus/agents';
import { PostgresRateLimiter, createDb, resolveDbConfig, type Db } from '@saveus/db';
import { readEnv, type AppEnv } from './env.js';

type RedisConstructor = new (url: string) => Redis;

/**
 * Application context.
 *
 * Every dependency the HTTP layer needs is assembled here and passed down, so
 * routes never reach for a global and tests can substitute a database, a
 * provider or a queue without touching route code.
 */
export interface AppContext {
  env: AppEnv;
  db: Db;
  provider: AIProvider;
  search: ResearchSearchProvider;
  queue: Queue;
  rateLimiter: RateLimiter;
  cache: Cache;
  limits: RateLimitSettings;
}

export interface CreateContextOptions {
  db?: Db;
  env?: AppEnv;
  provider?: AIProvider;
  queue?: Queue;
  rateLimiter?: RateLimiter;
  cache?: Cache;
}

export function createContext(options: CreateContextOptions = {}): AppContext {
  const env = options.env ?? readEnv();
  // One connection, shared by the queue, the limiter and the cache. Opening
  // three would triple the connection count for no benefit.
  const redis = env.REDIS_URL ? connectRedis(env.REDIS_URL) : null;
  // Resolve from the environment rather than hard-coding: TLS and pool size
  // are exactly the two settings that differ between a laptop and a managed
  // database, and pinning them here made both wrong in production.
  const db = options.db ?? createDb(resolveDbConfig()).db;
  const provider = options.provider ?? resolveProvider(process.env);
  const search = new ProblemScopedSearchProvider(db, new CorpusSearchProvider(db));

  return {
    env,
    db,
    provider,
    search,
    queue: options.queue ?? createQueue(redis),
    rateLimiter: options.rateLimiter ?? createRateLimiter(env, db, redis),
    cache: options.cache ?? createCache(env, redis),
    limits: resolveRateLimits(),
  };
}

/**
 * A rate limiter the deployment can actually rely on.
 *
 * The in-memory one counts in a Map, which is correct for a single long-running
 * server and meaningless anywhere else: on a serverless host every invocation
 * starts with an empty Map, so the middleware runs, decides yes, and protects
 * nothing. Anything with more than one process shares the counter in Postgres,
 * which is the one dependency every deployment of this platform already has.
 *
 * Tests keep the in-memory one: they are single-process by construction, and a
 * limiter that writes to the shared test database would leak state between
 * suites.
 */
function createRateLimiter(env: AppEnv, db: Db, redis: Redis | null): RateLimiter {
  if (env.NODE_ENV === 'test' || env.RATE_LIMIT_DRIVER === 'memory') return new MemoryRateLimiter();
  // Redis when it is there: a limit is checked on every request, and an INCR is
  // cheaper than a database round trip. Postgres otherwise, because a shared
  // counter somewhere beats a per-process one everywhere.
  if (redis && env.RATE_LIMIT_DRIVER !== 'postgres') return new RedisRateLimiter(redis);
  return new PostgresRateLimiter(db);
}

/**
 * Only shared caches are worth much under load: a per-process one on a
 * serverless host is a cache per invocation. It is still better than nothing -
 * a single render reads the platform counters more than once - so the in-memory
 * one is the fallback rather than no cache at all.
 */
function createCache(env: AppEnv, redis: Redis | null): Cache {
  if (env.NODE_ENV === 'test') return new NoopCache();
  if (redis) return new RedisCache(redis);
  return new MemoryCache();
}

function createQueue(redis: Redis | null): Queue {
  return redis ? new RedisQueue(redis) : new InMemoryQueue();
}

/** Loaded lazily so a deployment without Redis never pulls in the driver. */
function connectRedis(url: string): Redis | null {
  try {
    const require = createRequire(import.meta.url);
    const Redis = (require('ioredis') as { default: RedisConstructor }).default;
    return new Redis(url);
  } catch (error) {
    // Redis is an optimisation here, never a requirement. Losing it should
    // slow the platform down, not take it off the air.
    console.warn(
      '[api] REDIS_URL is set but the client could not be created; falling back to Postgres and in-process state:',
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}
