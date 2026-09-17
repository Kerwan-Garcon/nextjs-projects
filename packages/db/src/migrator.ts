import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql } from 'kysely';
import type { Db } from './client.js';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

/**
 * Plain SQL migrations applied in filename order and recorded in
 * `_migrations`. No magic: the files are readable and reviewable as SQL.
 */
export async function migrate(db: Db, dir: string = MIGRATIONS_DIR): Promise<MigrationResult> {
  await sql`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `.execute(db);

  const rows = await sql<{ name: string }>`SELECT name FROM _migrations`.execute(db);
  const done = new Set(rows.rows.map((row) => row.name));

  const files = (await readdir(dir)).filter((file) => file.endsWith('.sql')).sort();
  const applied: string[] = [];
  const skipped: string[] = [];

  for (const file of files) {
    if (done.has(file)) {
      skipped.push(file);
      continue;
    }
    const statement = await readFile(join(dir, file), 'utf8');
    await db.transaction().execute(async (trx) => {
      await sql.raw(statement).execute(trx);
      await sql`INSERT INTO _migrations (name) VALUES (${file})`.execute(trx);
    });
    applied.push(file);
  }

  return { applied, skipped };
}

/** Drops every table in the public schema. Used by `db:reset` and by tests. */
export async function dropAll(db: Db): Promise<void> {
  await sql`DROP SCHEMA public CASCADE`.execute(db);
  await sql`CREATE SCHEMA public`.execute(db);
}
