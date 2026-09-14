import { createRequire } from 'node:module';
import type Redis from 'ioredis';
import { MemoryRateLimiter, type RateLimiter } from '@saveus/common';
import { InMemoryQueue, RedisQueue, type Queue } from '@saveus/common/queue';
import {
  CorpusSearchProvider,
  ProblemScopedSearchProvider,
  resolveProvider,
  type AIProvider,
  type ResearchSearchProvider,
} from '@saveus/agents';
import { createDb, resolveDbConfig, type Db } from '@saveus/db';
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
}

export interface CreateContextOptions {
  db?: Db;
  env?: AppEnv;
  provider?: AIProvider;
  queue?: Queue;
  rateLimiter?: RateLimiter;
}

export function createContext(options: CreateContextOptions = {}): AppContext {
  const env = options.env ?? readEnv();
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
    queue: options.queue ?? createQueue(env),
    rateLimiter: options.rateLimiter ?? new MemoryRateLimiter(),
  };
}

function createQueue(env: AppEnv): Queue {
  if (!env.REDIS_URL) return new InMemoryQueue();
  // Loaded lazily so a deployment without Redis never pulls in the driver.
  const require = createRequire(import.meta.url);
  const Redis = (require('ioredis') as { default: RedisConstructor }).default;
  return new RedisQueue(new Redis(env.REDIS_URL));
}
