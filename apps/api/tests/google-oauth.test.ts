import { createHash, generateKeyPairSync, createSign, randomBytes } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import {
  GoogleAuthError,
  buildAuthorizationRequest,
  codeChallengeFor,
  createCodeVerifier,
  exchangeCode,
  resetGoogleKeyCache,
  suggestHandle,
  uniqueHandle,
  verifyIdToken,
  type GoogleConfig,
} from '../src/services/google-oauth.js';
import { safeReturnPath } from '../src/routes/auth.js';

/**
 * These tests mint their own RSA key and sign their own tokens, so the whole
 * verification path runs for real: a token this suite forges with the wrong
 * audience, the wrong nonce, the wrong algorithm or a past expiry has to be
 * refused by the same code that will see Google's.
 */

const config: GoogleConfig = {
  clientId: '1234567890-example.apps.googleusercontent.com',
  clientSecret: 'test-secret',
  redirectUri: 'https://save-us.example/api/auth/google/callback',
};

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-key', alg: 'RS256', use: 'sig' };

function sign(claims: Record<string, unknown>, header: Record<string, unknown> = {}): string {
  const encode = (value: unknown): string =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  const head = encode({ alg: 'RS256', kid: 'test-key', typ: 'JWT', ...header });
  const body = encode(claims);

  if (header.alg === 'none') return `${head}.${body}.`;

  const signer = createSign('RSA-SHA256');
  signer.update(`${head}.${body}`);
  signer.end();
  return `${head}.${body}.${signer.sign(privateKey).toString('base64url')}`;
}

function jwksFetch(keys: unknown[] = [jwk]): typeof fetch {
  return (async () =>
    new Response(JSON.stringify({ keys }), {
      status: 200,
      headers: { 'content-type': 'application/json', 'cache-control': 'max-age=3600' },
    })) as unknown as typeof fetch;
}

const NONCE = 'nonce-under-test';

function validClaims(over: Record<string, unknown> = {}): Record<string, unknown> {
  const now = Math.floor(Date.now() / 1000);
  return {
    iss: 'https://accounts.google.com',
    aud: config.clientId,
    sub: '110000000000000000001',
    iat: now,
    exp: now + 3600,
    nonce: NONCE,
    email: 'Ada.Lovelace@example.org',
    email_verified: true,
    name: 'Ada Lovelace',
    picture: 'https://lh3.googleusercontent.com/a/example',
    ...over,
  };
}

afterEach(() => {
  resetGoogleKeyCache();
});

describe('PKCE and the authorization request', () => {
  it('produces a verifier in the length the spec allows', () => {
    const verifier = createCodeVerifier();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
    expect(verifier).toMatch(/^[A-Za-z0-9\-._~]+$/);
  });

  it('sends S256 of the verifier, never the verifier itself', () => {
    const request = buildAuthorizationRequest(config);
    const url = new URL(request.url);

    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBe(codeChallengeFor(request.codeVerifier));
    expect(url.toString()).not.toContain(request.codeVerifier);
    expect(createHash('sha256').update(request.codeVerifier).digest('base64url')).toBe(
      url.searchParams.get('code_challenge'),
    );
  });

  it('asks for identity scopes and nothing more', () => {
    const url = new URL(buildAuthorizationRequest(config).url);
    expect(url.searchParams.get('scope')).toBe('openid email profile');
    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.searchParams.get('redirect_uri')).toBe(config.redirectUri);
  });

  it('mints a fresh state and nonce every time', () => {
    const first = buildAuthorizationRequest(config);
    const second = buildAuthorizationRequest(config);
    expect(first.state).not.toBe(second.state);
    expect(first.nonce).not.toBe(second.nonce);
    expect(first.codeVerifier).not.toBe(second.codeVerifier);
  });
});

describe('ID token verification', () => {
  it('accepts a well-formed token and returns only what is stored', async () => {
    const identity = await verifyIdToken(sign(validClaims()), config, NONCE, {
      fetchImpl: jwksFetch(),
    });

    expect(identity).toEqual({
      subject: '110000000000000000001',
      email: 'ada.lovelace@example.org',
      emailVerified: true,
      name: 'Ada Lovelace',
      picture: 'https://lh3.googleusercontent.com/a/example',
    });
  });

  const refusals: [string, Record<string, unknown>, string][] = [
    ['a token for another client', { aud: 'someone-else.apps.googleusercontent.com' }, 'BAD_AUDIENCE'],
    ['a token from another issuer', { iss: 'https://evil.example' }, 'BAD_ISSUER'],
    ['an expired token', { exp: Math.floor(Date.now() / 1000) - 7200 }, 'EXPIRED'],
    ['a replayed token from another attempt', { nonce: 'a-different-nonce' }, 'BAD_NONCE'],
    ['a token with no nonce at all', { nonce: undefined }, 'BAD_NONCE'],
    ['a token with no subject', { sub: undefined }, 'NO_SUBJECT'],
  ];

  for (const [label, over, reason] of refusals) {
    it(`refuses ${label}`, async () => {
      await expect(
        verifyIdToken(sign(validClaims(over)), config, NONCE, { fetchImpl: jwksFetch() }),
      ).rejects.toMatchObject({ reason });
    });
  }

  it('refuses an unsigned token, whatever the header claims', async () => {
    await expect(
      verifyIdToken(sign(validClaims(), { alg: 'none' }), config, NONCE, {
        fetchImpl: jwksFetch(),
      }),
    ).rejects.toMatchObject({ reason: 'BAD_ALGORITHM' });
  });

  it('refuses a token signed by a key Google does not publish', async () => {
    const other = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const otherJwk = {
      ...other.publicKey.export({ format: 'jwk' }),
      kid: 'test-key',
      alg: 'RS256',
    };

    // Same kid, different key: the signature must not verify.
    await expect(
      verifyIdToken(sign(validClaims()), config, NONCE, { fetchImpl: jwksFetch([otherJwk]) }),
    ).rejects.toMatchObject({ reason: 'BAD_SIGNATURE' });
  });

  it('refuses a token whose key id is not in the published set', async () => {
    await expect(
      verifyIdToken(sign(validClaims(), { kid: 'not-published' }), config, NONCE, {
        fetchImpl: jwksFetch(),
      }),
    ).rejects.toMatchObject({ reason: 'UNKNOWN_KEY' });
  });

  it('refuses something that is not a JWT', async () => {
    await expect(
      verifyIdToken('not.a', config, NONCE, { fetchImpl: jwksFetch() }),
    ).rejects.toBeInstanceOf(GoogleAuthError);
  });

  it('caches the key set rather than fetching it per sign-in', async () => {
    let calls = 0;
    const counting = (async () => {
      calls += 1;
      return new Response(JSON.stringify({ keys: [jwk] }), {
        status: 200,
        headers: { 'cache-control': 'max-age=3600' },
      });
    }) as unknown as typeof fetch;

    await verifyIdToken(sign(validClaims()), config, NONCE, { fetchImpl: counting });
    await verifyIdToken(sign(validClaims()), config, NONCE, { fetchImpl: counting });
    expect(calls).toBe(1);
  });
});

describe('the code exchange', () => {
  it('sends the verifier and the secret, and returns the ID token', async () => {
    let body = '';
    const stub = (async (_url: string, init: RequestInit) => {
      body = String(init.body);
      return new Response(JSON.stringify({ id_token: 'the-token' }), { status: 200 });
    }) as unknown as typeof fetch;

    expect(await exchangeCode(config, 'auth-code', 'the-verifier', stub)).toBe('the-token');

    const sent = new URLSearchParams(body);
    expect(sent.get('code_verifier')).toBe('the-verifier');
    expect(sent.get('grant_type')).toBe('authorization_code');
    expect(sent.get('redirect_uri')).toBe(config.redirectUri);
  });

  it('reports Google refusing the exchange rather than pretending it worked', async () => {
    const stub = (async () =>
      new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 })) as unknown as typeof fetch;

    await expect(exchangeCode(config, 'code', 'verifier', stub)).rejects.toMatchObject({
      reason: 'TOKEN_EXCHANGE_FAILED',
    });
  });
});

describe('handles derived from a Google identity', () => {
  const identity = {
    subject: 's',
    email: 'ada.lovelace@example.org',
    emailVerified: true,
    name: 'Ada Lovelace',
    picture: null,
  };

  it('prefers the email local part, never the whole address', () => {
    expect(suggestHandle(identity)).toBe('ada-lovelace');
    expect(suggestHandle(identity)).not.toContain('@');
  });

  it('falls back to the display name, then to something neutral', () => {
    expect(suggestHandle({ ...identity, email: null })).toBe('ada-lovelace');
    expect(suggestHandle({ ...identity, email: null, name: null })).toBe('researcher');
    expect(suggestHandle({ ...identity, email: null, name: '???' })).toBe('researcher');
  });

  it('strips accents rather than emitting a handle nobody can type', () => {
    expect(suggestHandle({ ...identity, email: 'jérôme.morel@example.org' })).toBe('jerome-morel');
  });

  it('suffixes until the handle is free', async () => {
    const existing = new Set(['ada-lovelace', 'ada-lovelace-2']);
    expect(await uniqueHandle('ada-lovelace', async (h) => existing.has(h))).toBe('ada-lovelace-3');
    expect(await uniqueHandle('unused', async (h) => existing.has(h))).toBe('unused');
  });

  it('gives up on suffixes rather than looping forever', async () => {
    const handle = await uniqueHandle('busy', async () => true);
    expect(handle.startsWith('busy-')).toBe(true);
    expect(handle.length).toBeGreaterThan('busy-'.length);
  });
});

describe('the post sign-in redirect', () => {
  it('accepts a path on this app', () => {
    expect(safeReturnPath('/my-work')).toBe('/my-work');
    expect(safeReturnPath('/problems?domain=climate')).toBe('/problems?domain=climate');
  });

  it('refuses anything that could leave the app', () => {
    for (const hostile of [
      'https://evil.example/phish',
      '//evil.example/phish',
      'javascript:alert(1)',
      '/\\evil.example',
      'my-work',
      undefined,
    ]) {
      expect(safeReturnPath(hostile)).toBeNull();
    }
  });

  it('bounds the length, so the query string cannot be used as storage', () => {
    expect(safeReturnPath(`/${randomBytes(400).toString('hex')}`)?.length).toBe(200);
  });
});
