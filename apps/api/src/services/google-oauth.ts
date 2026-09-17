import { createHash, createPublicKey, createVerify, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Google sign-in, as the authorization-code flow with PKCE.
 *
 * No OAuth library. The flow is four steps, each of which has to be done
 * exactly right, and a dependency would hide which of them this code actually
 * performs. What it performs:
 *
 * - PKCE. The verifier never leaves the server; only its SHA-256 goes to
 *   Google. An intercepted redirect is worthless without it.
 * - `state`, stored server-side with an expiry and deleted on use. That is the
 *   CSRF defence, and single-use is the part people skip.
 * - `nonce`, echoed in the ID token, which ties the token to this particular
 *   authorisation request and stops a token minted elsewhere being replayed.
 * - Full ID token verification: RS256 signature against Google's published
 *   keys, then issuer, audience, expiry and nonce. TLS to the token endpoint
 *   would arguably make the signature check redundant; doing it anyway costs
 *   one cached HTTP request and removes the argument.
 *
 * The key set is fetched from Google and cached until its Cache-Control says
 * otherwise, so a sign-in is one outbound request, not two.
 */

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const JWKS_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);

/** Clock skew allowed on `exp` and `iat`. Google recommends a small window. */
const CLOCK_SKEW_SECONDS = 120;

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface GoogleIdentity {
  subject: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
}

/* ------------------------------------------------------------------ */
/* PKCE and state                                                      */
/* ------------------------------------------------------------------ */

export interface AuthorizationRequest {
  url: string;
  state: string;
  codeVerifier: string;
  nonce: string;
}

export function base64url(input: Buffer): string {
  return input.toString('base64url');
}

export function createCodeVerifier(): string {
  // 43-128 characters of the unreserved set, per RFC 7636. 32 random bytes
  // base64url-encoded lands at 43.
  return base64url(randomBytes(32));
}

export function codeChallengeFor(verifier: string): string {
  return base64url(createHash('sha256').update(verifier).digest());
}

/**
 * Build the URL to send the browser to. `prompt=select_account` rather than
 * `consent`: re-asking for consent on every sign-in trains people to click
 * through it.
 */
export function buildAuthorizationRequest(config: GoogleConfig): AuthorizationRequest {
  const state = base64url(randomBytes(24));
  const nonce = base64url(randomBytes(24));
  const codeVerifier = createCodeVerifier();

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    // Identity only. The platform has no business reading anybody's mail.
    scope: 'openid email profile',
    state,
    nonce,
    code_challenge: codeChallengeFor(codeVerifier),
    code_challenge_method: 'S256',
    prompt: 'select_account',
    include_granted_scopes: 'true',
  });

  return { url: `${AUTH_ENDPOINT}?${params.toString()}`, state, codeVerifier, nonce };
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/* ------------------------------------------------------------------ */
/* Token exchange                                                      */
/* ------------------------------------------------------------------ */

export class GoogleAuthError extends Error {
  constructor(
    readonly reason: string,
    message: string,
  ) {
    super(message);
    this.name = 'GoogleAuthError';
  }
}

interface TokenResponse {
  id_token?: string;
  access_token?: string;
  error?: string;
  error_description?: string;
}

export async function exchangeCode(
  config: GoogleConfig,
  code: string,
  codeVerifier: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const response = await fetchImpl(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      code_verifier: codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: config.redirectUri,
    }).toString(),
  });

  const payload = (await response.json().catch(() => null)) as TokenResponse | null;
  if (!response.ok || !payload?.id_token) {
    throw new GoogleAuthError(
      'TOKEN_EXCHANGE_FAILED',
      payload?.error_description ?? payload?.error ?? `Google returned ${response.status}`,
    );
  }
  return payload.id_token;
}

/* ------------------------------------------------------------------ */
/* ID token verification                                               */
/* ------------------------------------------------------------------ */

interface Jwk {
  kid?: string;
  kty?: string;
  alg?: string;
  use?: string;
  n?: string;
  e?: string;
}

interface KeyCache {
  keys: Jwk[];
  expiresAt: number;
}

let cache: KeyCache | null = null;

/** Exposed so a test can start from a known state. */
export function resetGoogleKeyCache(): void {
  cache = null;
}

async function googleKeys(fetchImpl: typeof fetch): Promise<Jwk[]> {
  if (cache && cache.expiresAt > Date.now()) return cache.keys;

  const response = await fetchImpl(JWKS_ENDPOINT);
  if (!response.ok) {
    throw new GoogleAuthError('JWKS_UNAVAILABLE', `Google key set returned ${response.status}`);
  }

  const payload = (await response.json()) as { keys?: Jwk[] };
  const keys = payload.keys ?? [];
  if (keys.length === 0) throw new GoogleAuthError('JWKS_EMPTY', 'Google published no keys');

  const maxAge = /max-age=(\d+)/.exec(response.headers.get('cache-control') ?? '')?.[1];
  const ttlMs = maxAge ? Number(maxAge) * 1000 : 60 * 60 * 1000;
  cache = { keys, expiresAt: Date.now() + Math.min(ttlMs, 24 * 60 * 60 * 1000) };
  return keys;
}

interface IdTokenClaims {
  iss?: string;
  aud?: string | string[];
  sub?: string;
  exp?: number;
  iat?: number;
  nonce?: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  picture?: string;
}

function decodeSegment(segment: string): unknown {
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')) as unknown;
}

/**
 * Verify an ID token and return only what the platform will store. Every failure
 * is a `GoogleAuthError` with a reason, so the route can log which check failed
 * without leaking the token.
 */
export async function verifyIdToken(
  idToken: string,
  config: GoogleConfig,
  expectedNonce: string,
  options: { now?: Date; fetchImpl?: typeof fetch } = {},
): Promise<GoogleIdentity> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = Math.floor((options.now ?? new Date()).getTime() / 1000);

  const parts = idToken.split('.');
  if (parts.length !== 3) throw new GoogleAuthError('MALFORMED', 'The ID token is not a JWT');
  const [encodedHeader, encodedPayload, encodedSignature] = parts as [string, string, string];

  let header: { alg?: string; kid?: string };
  let claims: IdTokenClaims;
  try {
    header = decodeSegment(encodedHeader) as { alg?: string; kid?: string };
    claims = decodeSegment(encodedPayload) as IdTokenClaims;
  } catch {
    throw new GoogleAuthError('MALFORMED', 'The ID token segments are not JSON');
  }

  if (header.alg !== 'RS256') {
    // "none" and symmetric algorithms are how this gets bypassed. Only RS256.
    throw new GoogleAuthError('BAD_ALGORITHM', `Unexpected signing algorithm ${header.alg}`);
  }

  const keys = await googleKeys(fetchImpl);
  const jwk = keys.find((candidate) => candidate.kid === header.kid);
  if (!jwk) throw new GoogleAuthError('UNKNOWN_KEY', 'No published Google key matches this token');

  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${encodedHeader}.${encodedPayload}`);
  verifier.end();

  const publicKey = createPublicKey({ key: jwk as never, format: 'jwk' });
  if (!verifier.verify(publicKey, Buffer.from(encodedSignature, 'base64url'))) {
    throw new GoogleAuthError('BAD_SIGNATURE', 'The ID token signature does not verify');
  }

  if (!claims.iss || !ISSUERS.has(claims.iss)) {
    throw new GoogleAuthError('BAD_ISSUER', `Unexpected issuer ${claims.iss ?? 'none'}`);
  }

  const audiences = Array.isArray(claims.aud) ? claims.aud : claims.aud ? [claims.aud] : [];
  if (!audiences.some((audience) => safeEqual(audience, config.clientId))) {
    throw new GoogleAuthError('BAD_AUDIENCE', 'The ID token was issued for a different client');
  }

  if (typeof claims.exp !== 'number' || claims.exp + CLOCK_SKEW_SECONDS < now) {
    throw new GoogleAuthError('EXPIRED', 'The ID token has expired');
  }
  if (typeof claims.iat === 'number' && claims.iat - CLOCK_SKEW_SECONDS > now) {
    throw new GoogleAuthError('NOT_YET_VALID', 'The ID token is dated in the future');
  }

  if (!claims.nonce || !safeEqual(claims.nonce, expectedNonce)) {
    throw new GoogleAuthError('BAD_NONCE', 'The ID token does not match this sign-in attempt');
  }

  if (!claims.sub) throw new GoogleAuthError('NO_SUBJECT', 'The ID token carries no subject');

  return {
    subject: claims.sub,
    email: typeof claims.email === 'string' ? claims.email.toLowerCase() : null,
    emailVerified: claims.email_verified === true || claims.email_verified === 'true',
    name: typeof claims.name === 'string' ? claims.name : null,
    picture: typeof claims.picture === 'string' ? claims.picture : null,
  };
}

/* ------------------------------------------------------------------ */
/* Handles                                                             */
/* ------------------------------------------------------------------ */

/**
 * A handle from what Google told us, in the platform's own vocabulary.
 *
 * The email local part is preferred over the display name because it is
 * already short and already unique-ish; the display name is the fallback, and
 * a random suffix is the last resort. The email itself is never the handle:
 * the board shows handles, and nobody agreed to publish their address.
 */
export function suggestHandle(identity: GoogleIdentity): string {
  const fromEmail = identity.email?.split('@')[0] ?? '';
  const base = normalizeHandle(fromEmail) || normalizeHandle(identity.name ?? '') || 'researcher';
  return base.slice(0, 24);
}

function normalizeHandle(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

/** `taken` answers whether a handle already exists; the first free one wins. */
export async function uniqueHandle(
  base: string,
  taken: (handle: string) => Promise<boolean>,
): Promise<string> {
  if (!(await taken(base))) return base;
  for (let attempt = 2; attempt <= 60; attempt += 1) {
    const candidate = `${base.slice(0, 21)}-${attempt}`;
    if (!(await taken(candidate))) return candidate;
  }
  return `${base.slice(0, 16)}-${randomBytes(4).toString('hex')}`;
}
