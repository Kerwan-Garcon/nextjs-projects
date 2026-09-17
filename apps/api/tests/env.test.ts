import { describe, expect, it } from 'vitest';
import { googleConfig, readEnv } from '../src/env.js';

const REAL_SECRET = 'JZ8Qa1n5r7T2vB4xC6yE9wF0hK3mN5pR7sU9zA1cD3g=';

/**
 * The session secret guard.
 *
 * Worth its own test because the failure is silent: a deployment that boots
 * with a published key looks exactly like one that does not, right up until
 * somebody mints themselves a session.
 */
describe('APP_SECRET', () => {
  const base = { NODE_ENV: 'production', DATABASE_URL: 'postgres://x/y' } as const;

  it('refuses every placeholder this repository publishes', () => {
    // The schema default, and - the one that was actually missing - the value
    // .env.example tells a reader to replace.
    for (const published of [
      'dev-only-secret-change-me-please',
      'change-me-to-a-long-random-string',
    ]) {
      expect(() => readEnv({ ...base, APP_SECRET: published }), published).toThrow(/placeholder/i);
      // Whitespace is not a change of secret.
      expect(() => readEnv({ ...base, APP_SECRET: ` ${published} ` }), published).toThrow(
        /placeholder/i,
      );
    }
  });

  it('refuses a missing secret in production', () => {
    expect(() => readEnv({ ...base })).toThrow(/placeholder/i);
  });

  it('accepts a real one', () => {
    expect(readEnv({ ...base, APP_SECRET: REAL_SECRET }).APP_SECRET).toBe(REAL_SECRET);
  });

  it('leaves development alone, so nobody has to generate a key to run the tests', () => {
    expect(readEnv({ DATABASE_URL: 'postgres://x/y' }).APP_SECRET).toBe(
      'dev-only-secret-change-me-please',
    );
  });

  it('still requires a secret long enough to be one', () => {
    expect(() => readEnv({ ...base, APP_SECRET: 'short' })).toThrow(/APP_SECRET/);
  });
});

/**
 * The deploy-time chicken-and-egg: the URL is assigned by the platform, so it
 * cannot be configured before the first deploy.
 */
describe('PUBLIC_APP_URL', () => {
  const base = { NODE_ENV: 'production', APP_SECRET: REAL_SECRET } as const;

  it('falls back to the platform production host', () => {
    const env = readEnv({ ...base, VERCEL_PROJECT_PRODUCTION_URL: 'save-us.vercel.app' });
    expect(env.PUBLIC_APP_URL).toBe('https://save-us.vercel.app');
  });

  it('lets an explicit value win, because only the operator knows a custom domain', () => {
    const env = readEnv({
      ...base,
      PUBLIC_APP_URL: 'https://saveus.org',
      VERCEL_PROJECT_PRODUCTION_URL: 'save-us.vercel.app',
    });
    expect(env.PUBLIC_APP_URL).toBe('https://saveus.org');
  });

  it('does not prefix a host that already carries a scheme', () => {
    const env = readEnv({ ...base, VERCEL_PROJECT_PRODUCTION_URL: 'https://save-us.vercel.app' });
    expect(env.PUBLIC_APP_URL).toBe('https://save-us.vercel.app');
  });

  it('still defaults to localhost off-platform', () => {
    expect(readEnv({ ...base }).PUBLIC_APP_URL).toBe('http://localhost:3000');
  });

  it('builds the Google redirect URI from whatever it resolved to', () => {
    const env = readEnv({
      ...base,
      VERCEL_PROJECT_PRODUCTION_URL: 'save-us.vercel.app',
      GOOGLE_CLIENT_ID: 'id.apps.googleusercontent.com',
      GOOGLE_CLIENT_SECRET: 'secret',
    });
    expect(googleConfig(env)?.redirectUri).toBe(
      'https://save-us.vercel.app/api/auth/google/callback',
    );
  });
});
