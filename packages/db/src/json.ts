/**
 * JSONB values are serialised explicitly. Passing a JS array straight to
 * node-postgres would produce a Postgres array literal, not JSON.
 */
export function json(value: unknown): string {
  return JSON.stringify(value ?? null);
}
