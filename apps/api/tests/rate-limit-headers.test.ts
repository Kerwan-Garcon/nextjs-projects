import { describe, expect, it } from 'vitest';
import { applyRateLimitHeaders, callerIdentity } from '../src/app.js';
import type { SessionUser } from '../src/auth.js';

/**
 * Who a request is counted against, and what the client is told about it.
 *
 * Both were wrong in ways that fail silently. `x-forwarded-for` was read whole,
 * so a caller sending a fresh value each time never met a limit. And a 429 went
 * out with no `Retry-After`, which is the header this platform demands of the
 * publishers it fetches - and then did not send itself.
 */

const request = (headers: Record<string, string>, user: SessionUser | null = null) => ({
  get: () => user,
  req: { header: (name: string) => headers[name.toLowerCase()] },
});

const user: SessionUser = {
  id: 'u-1',
  handle: 'a-devi',
  displayName: 'A. Devi',
  reputation: 10,
  trust: 0.5,
  isAnonymous: false,
};

describe('who a request is counted against', () => {
  it('uses the signed-in identity before anything a header claims', () => {
    expect(callerIdentity(request({ 'x-forwarded-for': '9.9.9.9' }, user))).toBe('user:u-1');
  });

  it('prefers the address the proxy set over the chain it forwarded', () => {
    expect(
      callerIdentity(request({ 'x-real-ip': '203.0.113.7', 'x-forwarded-for': '1.1.1.1' })),
    ).toBe('ip:203.0.113.7');
  });

  it('takes the entry the proxy appended, not the one the caller chose', () => {
    // A caller can send anything; only the rightmost entry was added by the
    // proxy in front of us. Trusting the leftmost is how a limit is bypassed
    // with a header that changes every request.
    expect(callerIdentity(request({ 'x-forwarded-for': 'spoofed, 198.51.100.4' }))).toBe(
      'ip:198.51.100.4',
    );
    expect(callerIdentity(request({ 'x-forwarded-for': '  a , b ,  198.51.100.9 ' }))).toBe(
      'ip:198.51.100.9',
    );
  });

  it('counts requests with no usable address together rather than separately', () => {
    // One shared bucket is a limit. A bucket per unidentifiable caller is not.
    expect(callerIdentity(request({}))).toBe('anonymous');
    expect(callerIdentity(request({ 'x-forwarded-for': '' }))).toBe('anonymous');
    expect(callerIdentity(request({ 'x-forwarded-for': ' , , ' }))).toBe('anonymous');
  });
});

describe('what the client is told', () => {
  const collect = () => {
    const headers: Record<string, string> = {};
    return { headers, header: (name: string, value: string) => void (headers[name] = value) };
  };

  it('states the limit on an allowed request too, not only on a refusal', () => {
    const sink = collect();
    applyRateLimitHeaders(sink, {
      allowed: true,
      remaining: 7,
      limit: 30,
      resetAt: Date.now() + 42_000,
    });

    expect(sink.headers['RateLimit-Limit']).toBe('30');
    expect(sink.headers['RateLimit-Remaining']).toBe('7');
    expect(Number(sink.headers['RateLimit-Reset'])).toBeGreaterThan(38);
    // Nothing to retry: the request went through.
    expect(sink.headers['Retry-After']).toBeUndefined();
  });

  it('says when to come back on a refusal', () => {
    const sink = collect();
    applyRateLimitHeaders(sink, {
      allowed: false,
      remaining: 0,
      limit: 30,
      resetAt: Date.now() + 25_000,
    });

    expect(sink.headers['RateLimit-Remaining']).toBe('0');
    expect(Number(sink.headers['Retry-After'])).toBeGreaterThan(20);
  });

  it('never reports a negative wait for a window that already lapsed', () => {
    const sink = collect();
    applyRateLimitHeaders(sink, {
      allowed: false,
      remaining: 0,
      limit: 5,
      resetAt: Date.now() - 10_000,
    });

    expect(sink.headers['Retry-After']).toBe('0');
    expect(sink.headers['RateLimit-Reset']).toBe('0');
  });
});
