import { describe, expect, it } from 'vitest';
import { resolveDbConfig } from '../src/config.js';

/**
 * These two settings are the whole difference between a laptop and a deployment,
 * and both fail quietly when they are wrong: no TLS to a managed database is a
 * connection in clear text over the public internet, and a pool of ten per
 * serverless invocation is a free tier that runs out of connections under mild
 * traffic. So the defaults are pinned here.
 */
describe('database configuration', () => {
  const remote = 'postgres://user:pass@ep-cool-name.eu-central-1.aws.neon.tech/saveus';

  it('turns TLS on for a host reached over the internet', () => {
    expect(resolveDbConfig({ DATABASE_URL: remote }).ssl).toBe(true);
  });

  it('leaves it off for a database on this machine', () => {
    for (const url of [
      'postgres://saveus:saveus@127.0.0.1:5432/saveus',
      'postgres://saveus:saveus@localhost:5432/saveus',
      'postgres://saveus:saveus@db.internal:5432/saveus',
    ]) {
      expect(resolveDbConfig({ DATABASE_URL: url }).ssl, url).toBe(false);
    }
  });

  it('lets the environment overrule the guess in both directions', () => {
    expect(resolveDbConfig({ DATABASE_URL: remote, DATABASE_SSL: 'false' }).ssl).toBe(false);
    expect(
      resolveDbConfig({ DATABASE_URL: 'postgres://u:p@localhost/db', DATABASE_SSL: 'true' }).ssl,
    ).toBe(true);
  });

  it('verifies the certificate only when asked, because managed providers use their own CA', () => {
    expect(resolveDbConfig({ DATABASE_URL: remote }).rejectUnauthorized).toBe(false);
    expect(resolveDbConfig({ DATABASE_URL: remote, DATABASE_SSL_STRICT: 'true' }).rejectUnauthorized).toBe(
      true,
    );
  });

  it('keeps one connection per serverless invocation and a real pool elsewhere', () => {
    expect(resolveDbConfig({ DATABASE_URL: remote, VERCEL: '1' }).maxPoolSize).toBe(1);
    expect(resolveDbConfig({ DATABASE_URL: remote, AWS_LAMBDA_FUNCTION_NAME: 'f' }).maxPoolSize).toBe(1);
    expect(resolveDbConfig({ DATABASE_URL: remote }).maxPoolSize).toBe(10);
    expect(resolveDbConfig({ DATABASE_URL: remote, VERCEL: '1', DATABASE_POOL_SIZE: '4' }).maxPoolSize).toBe(4);
  });

  it('falls back to the local development database rather than throwing', () => {
    expect(resolveDbConfig({}).connectionString).toContain('127.0.0.1');
    expect(resolveDbConfig({ DATABASE_URL: '   ' }).connectionString).toContain('127.0.0.1');
  });

  it('does not mistake an unparseable URL for a local one', () => {
    // Better to attempt TLS and fail loudly than to send credentials in clear.
    expect(resolveDbConfig({ DATABASE_URL: 'not a url at all' }).ssl).toBe(true);
  });
});
