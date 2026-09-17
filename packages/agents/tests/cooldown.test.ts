import { describe, expect, it } from 'vitest';
import { HttpFetcher, parseRetryAfter, type CooldownStore } from '../src/index.js';

/**
 * Being asked to wait, and actually waiting.
 *
 * The fetcher parsed `Retry-After` from the beginning and then dropped it on
 * the floor, so a 429 changed nothing: the other seven URLs on that host went
 * out anyway, and tomorrow's cycle asked again at the same rate. These pin the
 * behaviour that fixes it.
 */

/** A fetcher whose network layer is a script of canned responses. */
function scripted(responses: Response[], options = {}) {
  const calls: string[] = [];
  let index = 0;

  const fetcher = new HttpFetcher({
    minHostIntervalMs: 0,
    ...options,
  });

  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    const response = responses[Math.min(index, responses.length - 1)];
    index += 1;
    return response!.clone();
  }) as typeof fetch;

  return { fetcher, calls, restore: () => { globalThis.fetch = original; } };
}

const limited = (retryAfter: string) =>
  new Response('slow down', { status: 429, headers: { 'retry-after': retryAfter } });

const feed = (body = '<?xml version="1.0"?><rss><channel></channel></rss>') =>
  new Response(body, { status: 200, headers: { 'content-type': 'application/rss+xml' } });

describe('honouring Retry-After', () => {
  it('stops asking the host for the rest of the run', async () => {
    const { fetcher, calls, restore } = scripted([limited('120'), feed()]);
    try {
      const first = await fetcher.fetch('https://example.org/a.xml');
      expect(first.status).toBe('RATE_LIMITED');
      expect(calls).toHaveLength(1);

      // A different path on the same host. A publisher limits a client, not a
      // URL, so this must not reach the network at all.
      const second = await fetcher.fetch('https://example.org/b.xml');
      expect(second.status).toBe('RATE_LIMITED');
      expect(calls).toHaveLength(1);

      // Subdomains of the same site are the same conversation for our purposes
      // only if they resolve to the same host key; a different host is free.
      const other = await fetcher.fetch('https://other.example/c.xml');
      expect(other.status).toBe('OK');
      expect(calls).toHaveLength(2);
    } finally {
      restore();
    }
  });

  it('reports how long is left rather than a bare refusal', async () => {
    const { fetcher, restore } = scripted([limited('300')]);
    try {
      await fetcher.fetch('https://example.org/a.xml');
      const again = await fetcher.fetch('https://example.org/a.xml');

      expect(again.status).toBe('RATE_LIMITED');
      if (again.status === 'RATE_LIMITED') {
        expect(again.retryAfterMs).toBeGreaterThan(290_000);
        expect(again.retryAfterMs).toBeLessThanOrEqual(300_000);
      }
    } finally {
      restore();
    }
  });

  it('remembers across processes when given somewhere to write it', async () => {
    const table = new Map<string, number>();
    const store: CooldownStore = {
      get: async (host) => table.get(host) ?? null,
      set: async (host, until) => void table.set(host, until),
    };

    const first = scripted([limited('600')], { cooldowns: store });
    try {
      await first.fetcher.fetch('https://example.org/a.xml');
      expect(table.get('example.org')).toBeGreaterThan(Date.now());
    } finally {
      first.restore();
    }

    // A new process, the same publisher, the same day.
    const second = scripted([feed()], { cooldowns: store });
    try {
      const outcome = await second.fetcher.fetch('https://example.org/a.xml');
      expect(outcome.status).toBe('RATE_LIMITED');
      expect(second.calls).toHaveLength(0);
    } finally {
      second.restore();
    }
  });

  it('lets a lapsed cooldown through', async () => {
    const store: CooldownStore = {
      get: async () => Date.now() - 1_000,
      set: async () => undefined,
    };
    const { fetcher, calls, restore } = scripted([feed()], { cooldowns: store });
    try {
      expect((await fetcher.fetch('https://example.org/a.xml')).status).toBe('OK');
      expect(calls).toHaveLength(1);
    } finally {
      restore();
    }
  });

  it('bounds how long one header may park a host', async () => {
    // A publisher can ask for a week; honour it, but not past our own ceiling,
    // or a single bad header removes a source from the set for good.
    const { fetcher, restore } = scripted([limited('604800')], { maxCooldownMs: 60_000 });
    try {
      await fetcher.fetch('https://example.org/a.xml');
      const again = await fetcher.fetch('https://example.org/a.xml');
      if (again.status === 'RATE_LIMITED') {
        expect(again.retryAfterMs).toBeLessThanOrEqual(60_000);
      }
    } finally {
      restore();
    }
  });

  it('keeps working when the store is unavailable', async () => {
    // A cooldown that cannot be written is worth less than one that can, but it
    // is not worth failing the fetch over.
    const broken: CooldownStore = {
      get: async () => { throw new Error('database is down'); },
      set: async () => { throw new Error('database is down'); },
    };
    const { fetcher, restore } = scripted([feed()], { cooldowns: broken });
    try {
      expect((await fetcher.fetch('https://example.org/a.xml')).status).toBe('OK');
    } finally {
      restore();
    }
  });

  it('treats 503 with a Retry-After the same as 429', async () => {
    const unavailable = new Response('back soon', {
      status: 503,
      headers: { 'retry-after': '90' },
    });
    const { fetcher, calls, restore } = scripted([unavailable, feed()]);
    try {
      expect((await fetcher.fetch('https://example.org/a.xml')).status).toBe('RATE_LIMITED');
      expect((await fetcher.fetch('https://example.org/b.xml')).status).toBe('RATE_LIMITED');
      expect(calls).toHaveLength(1);
    } finally {
      restore();
    }
  });
});

describe('reading Retry-After', () => {
  it('accepts seconds and HTTP dates', () => {
    expect(parseRetryAfter('120')).toBe(120_000);
    const soon = new Date(Date.now() + 45_000).toUTCString();
    expect(parseRetryAfter(soon)).toBeGreaterThan(40_000);
  });

  it('falls back rather than trusting nonsense', () => {
    expect(parseRetryAfter(null)).toBe(60_000);
    expect(parseRetryAfter('whenever you like')).toBe(60_000);
    expect(parseRetryAfter('-30')).toBe(0);
    expect(parseRetryAfter('999999999')).toBe(6 * 60 * 60 * 1000);
  });
});
