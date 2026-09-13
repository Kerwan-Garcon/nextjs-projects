import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

/**
 * End-to-end configuration.
 *
 * The suite runs against the production build with the seeded database, which
 * is the same thing a reviewer sees when they clone the repository and run
 * `pnpm setup && pnpm dev`.
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `pnpm --filter @saveus/web exec next start --port ${PORT}`,
        url: `${BASE_URL}/api/health`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          DATABASE_URL:
            process.env.DATABASE_URL ?? 'postgres://saveus:saveus@127.0.0.1:5432/saveus',
          APP_SECRET: process.env.APP_SECRET ?? 'e2e-secret-value-for-sessions',
          NODE_ENV: 'production',
        },
      },
});
