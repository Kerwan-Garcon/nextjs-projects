import { checkUrl, hostOf } from '@saveus/common';

/**
 * The intake HTTP client.
 *
 * Fetching other people's servers on a schedule is a thing you can do badly, so
 * this is deliberately conservative:
 *
 * - one request at a time per host, with a minimum gap between them;
 * - a real User-Agent naming the project and a contact address;
 * - conditional requests (ETag / Last-Modified), so an unchanged feed costs the
 *   publisher a 304 and costs us nothing;
 * - `Retry-After` honoured on 429 and 503 rather than hammered through;
 * - a response size cap and a content-type check, because a feed URL that
 *   suddenly returns 200 MB of HTML is not a feed any more;
 * - the same SSRF guard used everywhere else: no private hosts, no credentials
 *   in the URL, no non-HTTP schemes, and the guard is re-applied after every
 *   redirect rather than trusted once.
 */

export interface FetchState {
  etag: string | null;
  lastModified: string | null;
}

export type FetchOutcome =
  | { status: 'OK'; body: string; contentType: string; etag: string | null; lastModified: string | null }
  | { status: 'NOT_MODIFIED' }
  | { status: 'RATE_LIMITED'; retryAfterMs: number }
  | { status: 'FAILED'; httpStatus: number | null; reason: string };

export interface HttpFetcherOptions {
  userAgent?: string;
  timeoutMs?: number;
  maxBytes?: number;
  minHostIntervalMs?: number;
  acceptedContentTypes?: readonly string[];
}

const MAX_REDIRECTS = 5;

const DEFAULT_USER_AGENT =
  'save-us-intake/0.1 (research problem ingestion; +https://github.com/Kerwan-Garcon/nextjs-projects)';

export class HttpFetcher {
  private readonly userAgent: string;
  private readonly timeoutMs: number;
  private readonly maxBytes: number;
  private readonly minHostIntervalMs: number;
  private readonly acceptedContentTypes: readonly string[];
  /** Per-host serialisation: each host's requests queue behind the last one. */
  private readonly hostQueues = new Map<string, Promise<unknown>>();
  private readonly lastRequestAt = new Map<string, number>();

  constructor(options: HttpFetcherOptions = {}) {
    this.userAgent = options.userAgent ?? process.env.INTAKE_USER_AGENT ?? DEFAULT_USER_AGENT;
    this.timeoutMs = options.timeoutMs ?? 25_000;
    this.maxBytes = options.maxBytes ?? 8 * 1024 * 1024;
    this.minHostIntervalMs = options.minHostIntervalMs ?? 1_500;
    this.acceptedContentTypes = options.acceptedContentTypes ?? [
      'application/rss+xml',
      'application/atom+xml',
      'application/xml',
      'text/xml',
      'application/json',
      'text/json',
    ];
  }

  async fetch(
    url: string,
    state: FetchState = { etag: null, lastModified: null },
  ): Promise<FetchOutcome> {
    const checked = checkUrl(url);
    if (!checked.ok) {
      return { status: 'FAILED', httpStatus: null, reason: `${checked.reason}: ${checked.detail}` };
    }

    // The queue slot is taken once, for the whole request including its
    // redirects. Re-entering it per hop deadlocks the moment two hosts point at
    // each other, which real publishers do: feeds.example.com redirects to
    // www.example.com, which redirects back.
    return this.enqueue(hostOf(url), () => this.perform(url, state));
  }

  /** Serialise per host, and keep a floor between consecutive requests to it. */
  private enqueue<T>(host: string, task: () => Promise<T>): Promise<T> {
    const previous = this.hostQueues.get(host) ?? Promise.resolve();
    const next = previous.then(async () => {
      await this.respectInterval(host);
      return task();
    });

    // Keep the chain alive even when a task rejects.
    this.hostQueues.set(
      host,
      next.then(
        () => undefined,
        () => undefined,
      ),
    );
    return next;
  }

  private async perform(startUrl: string, state: FetchState): Promise<FetchOutcome> {
    const headers: Record<string, string> = {
      'user-agent': this.userAgent,
      accept:
        'application/rss+xml, application/atom+xml, application/xml;q=0.9, application/json;q=0.9, */*;q=0.1',
    };
    if (state.etag) headers['if-none-match'] = state.etag;
    if (state.lastModified) headers['if-modified-since'] = state.lastModified;

    let url = startUrl;
    const seen = new Set<string>([startUrl]);

    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      if (hop > 0) {
        // Later hops are still requests to somebody's server.
        await this.respectInterval(hostOf(url));
      }

      let response: Response;
      try {
        response = await fetch(url, {
          headers,
          redirect: 'manual',
          signal: AbortSignal.timeout(this.timeoutMs),
        });
      } catch (error) {
        const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
        return { status: 'FAILED', httpStatus: null, reason };
      }

      // Redirects are followed by hand so the SSRF guard applies to every hop.
      if (response.status >= 300 && response.status < 400) {
        void response.body?.cancel().catch(() => undefined);

        const location = response.headers.get('location');
        if (!location) {
          return { status: 'FAILED', httpStatus: response.status, reason: 'Redirect without a location' };
        }

        const target = new URL(location, url).toString();
        if (seen.has(target)) {
          return {
            status: 'FAILED',
            httpStatus: response.status,
            reason: `Redirect loop: ${target} was already visited`,
          };
        }
        const checked = checkUrl(target);
        if (!checked.ok) {
          return {
            status: 'FAILED',
            httpStatus: response.status,
            reason: `Redirect to a rejected target (${checked.reason})`,
          };
        }

        seen.add(target);
        url = target;
        continue;
      }

      if (response.status === 304) return { status: 'NOT_MODIFIED' };

      if (response.status === 429 || response.status === 503) {
        void response.body?.cancel().catch(() => undefined);
        return {
          status: 'RATE_LIMITED',
          retryAfterMs: parseRetryAfter(response.headers.get('retry-after')),
        };
      }

      if (!response.ok) {
        void response.body?.cancel().catch(() => undefined);
        return { status: 'FAILED', httpStatus: response.status, reason: `HTTP ${response.status}` };
      }

      const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
      if (!this.acceptedContentTypes.some((accepted) => contentType.includes(accepted))) {
        void response.body?.cancel().catch(() => undefined);
        return {
          status: 'FAILED',
          httpStatus: response.status,
          reason: `Unexpected content type "${contentType || 'none'}" - this is no longer a feed`,
        };
      }

      const declaredLength = Number(response.headers.get('content-length') ?? '0');
      if (declaredLength > this.maxBytes) {
        void response.body?.cancel().catch(() => undefined);
        return {
          status: 'FAILED',
          httpStatus: response.status,
          reason: `Response declares ${declaredLength} bytes, over the ${this.maxBytes} cap`,
        };
      }

      const body = await readCapped(response, this.maxBytes);
      if (body === null) {
        return {
          status: 'FAILED',
          httpStatus: response.status,
          reason: `Response exceeded the ${this.maxBytes} byte cap while streaming`,
        };
      }

      return {
        status: 'OK',
        body,
        contentType,
        etag: response.headers.get('etag'),
        lastModified: response.headers.get('last-modified'),
      };
    }

    return { status: 'FAILED', httpStatus: null, reason: `More than ${MAX_REDIRECTS} redirects` };
  }

  private async respectInterval(host: string): Promise<void> {
    const last = this.lastRequestAt.get(host);
    if (last !== undefined) {
      const wait = this.minHostIntervalMs - (Date.now() - last);
      if (wait > 0) await sleep(wait);
    }
    this.lastRequestAt.set(host, Date.now());
  }
}

async function readCapped(response: Response, maxBytes: number): Promise<string | null> {
  if (!response.body) return await response.text();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder('utf-8').decode(merged);
}

export function parseRetryAfter(header: string | null): number {
  if (!header) return 60_000;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.min(6 * 60 * 60 * 1000, Math.max(0, seconds * 1000));
  const date = new Date(header);
  if (!Number.isNaN(date.getTime())) {
    return Math.min(6 * 60 * 60 * 1000, Math.max(0, date.getTime() - Date.now()));
  }
  return 60_000;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
