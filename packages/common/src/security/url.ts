/**
 * URL validation for anything that arrives from outside the platform: user
 * submissions, connector documents, agent output. Pure, so it runs in every
 * environment.
 */

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

const BLOCKED_HOST_PATTERNS: readonly RegExp[] = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^\[?::1\]?$/,
  /\.local$/i,
  /\.internal$/i,
  /^metadata\.google\.internal$/i,
];

/** Tracking parameters stripped before a URL becomes a canonical identity. */
const STRIPPED_PARAMS: readonly string[] = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
  'fbclid',
  'mc_cid',
  'mc_eid',
  'ref_src',
];

export type UrlRejection =
  'MALFORMED' | 'PROTOCOL_NOT_ALLOWED' | 'CREDENTIALS_IN_URL' | 'PRIVATE_HOST' | 'TOO_LONG';

export type UrlCheck = { ok: true; url: URL } | { ok: false; reason: UrlRejection; detail: string };

export function checkUrl(input: string): UrlCheck {
  const raw = input.trim();
  if (raw.length > 2048) {
    return { ok: false, reason: 'TOO_LONG', detail: 'URL exceeds 2048 characters' };
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: 'MALFORMED', detail: 'Not a parseable absolute URL' };
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    return {
      ok: false,
      reason: 'PROTOCOL_NOT_ALLOWED',
      detail: `Protocol ${url.protocol} is not allowed`,
    };
  }
  if (url.username || url.password) {
    return { ok: false, reason: 'CREDENTIALS_IN_URL', detail: 'URLs must not embed credentials' };
  }
  if (BLOCKED_HOST_PATTERNS.some((pattern) => pattern.test(url.hostname))) {
    return {
      ok: false,
      reason: 'PRIVATE_HOST',
      detail: `Host ${url.hostname} is not publicly addressable`,
    };
  }
  return { ok: true, url };
}

export function isSafeUrl(input: string): boolean {
  return checkUrl(input).ok;
}

/**
 * Canonical form used as a source identity: lowercased host, no tracking
 * parameters, no fragment, sorted query, no trailing slash on the path.
 */
export function canonicalizeUrl(input: string): string | null {
  const checked = checkUrl(input);
  if (!checked.ok) return null;

  const url = new URL(checked.url.toString());
  url.hash = '';
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  for (const param of STRIPPED_PARAMS) url.searchParams.delete(param);

  const entries = [...url.searchParams.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  url.search = '';
  for (const [key, value] of entries) url.searchParams.append(key, value);

  if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.replace(/\/+$/, '');
  }
  if (
    (url.protocol === 'https:' && url.port === '443') ||
    (url.protocol === 'http:' && url.port === '80')
  ) {
    url.port = '';
  }
  return url.toString();
}

export function hostOf(input: string): string {
  const checked = checkUrl(input);
  return checked.ok ? checked.url.hostname.replace(/^www\./, '') : 'UNKNOWN';
}
