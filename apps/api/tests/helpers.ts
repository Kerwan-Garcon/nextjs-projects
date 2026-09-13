import { MemoryRateLimiter } from '@saveus/common';
import { InMemoryQueue } from '@saveus/common/queue';
import { DeterministicProvider, seedDemoResearch } from '@saveus/agents';
import { createDb, dropAll, migrate, type Db } from '@saveus/db';
import { seed } from '@saveus/db/seed';
import type { Pool } from 'pg';
import { createApp } from '../src/app.js';
import { createContext, type AppContext } from '../src/context.js';
import { readEnv } from '../src/env.js';

/**
 * API test harness.
 *
 * Tests run against a real Postgres database with the real seed, because the
 * behaviour worth testing here - derived status, scoring, permissions - lives
 * in SQL and in the services, and a mocked database would test neither.
 */

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://saveus:saveus@127.0.0.1:5432/saveus_test';

export interface Harness {
  app: ReturnType<typeof createApp>;
  ctx: AppContext;
  db: Db;
  pool: Pool;
  request: (path: string, init?: RequestInit) => Promise<Response>;
  json: <T>(path: string, init?: RequestInit) => Promise<T>;
  signIn: (handle: string) => Promise<string>;
  close: () => Promise<void>;
}

const ORIGIN = 'http://test.local';

export async function createHarness(options: { seedResearch?: boolean } = {}): Promise<Harness> {
  const { db, pool } = createDb({
    connectionString: TEST_DATABASE_URL,
    maxPoolSize: 4,
    ssl: false,
  });

  await dropAll(db);
  await migrate(db);
  await seed(db);
  if (options.seedResearch) await seedDemoResearch(db, new DeterministicProvider());

  const env = readEnv({
    ...process.env,
    NODE_ENV: 'test',
    DATABASE_URL: TEST_DATABASE_URL,
    APP_SECRET: 'test-secret-value-for-sessions',
  });

  const ctx = createContext({
    db,
    env,
    provider: new DeterministicProvider(),
    queue: new InMemoryQueue(),
    rateLimiter: new MemoryRateLimiter(),
  });

  const app = createApp(ctx);

  const request = (path: string, init: RequestInit = {}): Promise<Response> =>
    app.request(new Request(`${ORIGIN}${path}`, init));

  const json = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    const response = await request(path, init);
    return (await response.json()) as T;
  };

  const signIn = async (handle: string): Promise<string> => {
    const response = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ handle }),
    });
    const setCookie = response.headers.get('set-cookie') ?? '';
    const cookie = setCookie.split(';')[0];
    if (!cookie) throw new Error(`Sign-in for ${handle} returned no cookie (${response.status})`);
    return cookie;
  };

  return {
    app,
    ctx,
    db,
    pool,
    request,
    json,
    signIn,
    close: async () => {
      await db.destroy();
      await pool.end().catch(() => undefined);
    },
  };
}

export function withCookie(cookie: string, init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers);
  headers.set('cookie', cookie);
  return { ...init, headers };
}

export function postJson(body: unknown, cookie?: string): RequestInit {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (cookie) headers.set('cookie', cookie);
  return { method: 'POST', headers, body: JSON.stringify(body) };
}
