import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['packages/**/tests/**/*.test.ts', 'apps/**/tests/**/*.test.ts'],
    // API tests share one Postgres database, so they run in a single worker.
    pool: 'threads',
    poolOptions: { threads: { singleThread: true } },
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
  resolve: {
    // Workspace sources import with explicit ".js" specifiers.
    extensions: ['.ts', '.tsx', '.js', '.json'],
    alias: [{ find: /^(\.{1,2}\/.*)\.js$/, replacement: '$1' }],
  },
});
