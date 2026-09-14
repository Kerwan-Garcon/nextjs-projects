import { Kysely, PostgresDialect, sql } from 'kysely';
import pg from 'pg';
import { resolveDbConfig, type DbConfig } from './config.js';
import type { Database } from './schema.js';

/**
 * Kysely client. A single pool per process: Next.js dev reloads would otherwise
 * open a new pool on every hot update.
 */

// Return DATE/TIMESTAMP columns unchanged where we store plain strings.
pg.types.setTypeParser(pg.types.builtins.INT8, (value) => Number(value));

export type Db = Kysely<Database>;

let cached: { db: Db; pool: pg.Pool } | null = null;

export function createDb(config: DbConfig = resolveDbConfig()): { db: Db; pool: pg.Pool } {
  const pool = new pg.Pool({
    connectionString: config.connectionString,
    max: config.maxPoolSize,
    // A serverless invocation that waits thirty seconds for a connection has
    // already exceeded its own budget; failing fast is more useful.
    connectionTimeoutMillis: Number(process.env.DATABASE_CONNECT_TIMEOUT_MS ?? 10_000),
    idleTimeoutMillis: Number(process.env.DATABASE_IDLE_TIMEOUT_MS ?? 30_000),
    ...(config.ssl ? { ssl: { rejectUnauthorized: config.rejectUnauthorized } } : {}),
  });
  const db = new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });
  return { db, pool };
}

export function getDb(): Db {
  if (!cached) cached = createDb();
  return cached.db;
}

export async function closeDb(): Promise<void> {
  if (!cached) return;
  await cached.db.destroy();
  cached = null;
}

export async function pingDb(db: Db = getDb()): Promise<boolean> {
  try {
    await sql`select 1`.execute(db);
    return true;
  } catch {
    return false;
  }
}

export { sql };
