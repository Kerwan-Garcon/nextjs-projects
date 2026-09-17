import { describe, expect, it } from 'vitest';
import { readEnv } from '../src/env.js';

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
