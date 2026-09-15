import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getCookie } from 'hono/cookie';
import { AppError, HTTP_STATUS, type RateLimitDecision } from '@saveus/common';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { SESSION_COOKIE, resolveSession, type SessionUser } from './auth.js';
import { createContext, type AppContext } from './context.js';
import { authRoutes } from './routes/auth.js';
import { contributionRoutes } from './routes/contributions.js';
import { courseRoutes } from './routes/courses.js';
import { hypothesisRoutes } from './routes/hypotheses.js';
import { ingestionRoutes } from './routes/ingestion.js';
import { cronRoutes } from './routes/cron.js';
import { metaRoutes } from './routes/meta.js';
import { peopleRoutes } from './routes/people.js';
import { problemRoutes } from './routes/problems.js';
import { researchRoutes } from './routes/research.js';

export type ApiEnv = {
  Variables: {
    ctx: AppContext;
    user: SessionUser | null;
  };
};

export type ApiApp = ReturnType<typeof createApp>;

/**
 * HTTP surface.
 *
 * The same Hono app is mounted inside the Next.js server for the web client and
 * served standalone by `apps/api` for any other client - a future mobile or
 * desktop build talks to exactly this API, which is why it exists as its own
 * app rather than as Next route handlers.
 */
export function createApp(context: AppContext = createContext()) {
  const app = new Hono<ApiEnv>().basePath('/api');

  app.use('*', cors({ origin: (origin) => origin ?? '*', credentials: true }));

  app.use('*', async (c, next) => {
    c.set('ctx', context);
    const user = await resolveSession(
      context.db,
      getCookie(c, SESSION_COOKIE),
      context.env.APP_SECRET,
    );
    c.set('user', user);
    await next();
  });

  // Read limiting is generous; writes and agent runs are limited per identity
  // in their own routes, where the cost actually is.
  app.use('*', async (c, next) => {
    const decision = await context.rateLimiter.check(
      `read:${callerIdentity(c)}`,
      context.limits.read.limit,
      context.limits.read.windowMs,
    );
    applyRateLimitHeaders(c, decision);

    if (!decision.allowed) {
      return c.json(
        {
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests',
            details: null,
          },
        },
        429,
      );
    }
    await next();
  });

  app.onError((error, c) => {
    if (error instanceof AppError) {
      // A refusal that does not say when to come back invites a retry loop.
      const retryAfter = retryAfterFrom(error);
      if (retryAfter !== null) c.header('Retry-After', String(retryAfter));

      return c.json(
        { error: { code: error.code, message: error.message, details: error.details ?? null } },
        HTTP_STATUS[error.code] as ContentfulStatusCode,
      );
    }
    console.error('[api] unhandled error', error);
    return c.json({ error: { code: 'INTERNAL', message: 'Unexpected server error' } }, 500);
  });

  app.notFound((c) => c.json({ error: { code: 'NOT_FOUND', message: 'No such endpoint' } }, 404));

  app.route('/', metaRoutes());
  app.route('/', authRoutes());
  app.route('/', problemRoutes());
  app.route('/', hypothesisRoutes());
  app.route('/', contributionRoutes());
  app.route('/', researchRoutes());
  app.route('/', peopleRoutes());
  app.route('/', courseRoutes());
  app.route('/', ingestionRoutes());
  app.route('/', cronRoutes());

  return app;
}

/**
 * Who to count this request against.
 *
 * A signed-in identity is the honest answer. Falling back to an address needs
 * care: `x-forwarded-for` is a request header like any other, so reading it
 * whole lets a caller send a different value each time and never meet a limit.
 *
 * The assumption made here is one trusted proxy in front of the app, which is
 * what every deployment in docs/DEPLOY.md is. Under that assumption the proxy's
 * own `x-real-ip`, or the rightmost entry it appended to the chain, is the one
 * value the caller could not choose. Anything to the left of it is hearsay.
 */
/** The seconds a RATE_LIMITED error carries, when it carries any. */
function retryAfterFrom(error: AppError): number | null {
  if (error.code !== 'RATE_LIMITED') return null;
  const details = error.details;
  if (details && typeof details === 'object' && 'retryAfterSeconds' in details) {
    const seconds = (details as { retryAfterSeconds: unknown }).retryAfterSeconds;
    if (typeof seconds === 'number' && Number.isFinite(seconds))
      return Math.max(1, Math.ceil(seconds));
  }
  return 60;
}

export function callerIdentity(c: {
  get: (key: 'user') => SessionUser | null | undefined;
  req: { header: (name: string) => string | undefined };
}): string {
  const user = c.get('user');
  if (user) return `user:${user.id}`;

  const realIp = c.req.header('x-real-ip')?.trim();
  if (realIp) return `ip:${realIp}`;

  const chain = (c.req.header('x-forwarded-for') ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  const nearest = chain[chain.length - 1];

  return nearest ? `ip:${nearest}` : 'anonymous';
}

/**
 * Tell the client what the limit is, on every response rather than only on the
 * one that was refused. A 429 with no `Retry-After` gives a well-behaved client
 * nothing to be well-behaved with, and it is the header this platform demands
 * of itself when it fetches other people.
 */
export function applyRateLimitHeaders(
  c: { header: (name: string, value: string) => void },
  decision: RateLimitDecision,
): void {
  const resetSeconds = Math.max(0, Math.ceil((decision.resetAt - Date.now()) / 1000));
  c.header('RateLimit-Limit', String(decision.limit));
  c.header('RateLimit-Remaining', String(decision.remaining));
  c.header('RateLimit-Reset', String(resetSeconds));
  if (!decision.allowed) c.header('Retry-After', String(resetSeconds));
}

/** Throws rather than returning null so route handlers stay linear. */
export function requireUser(user: SessionUser | null): SessionUser {
  if (!user) {
    throw new AppError(
      'UNAUTHENTICATED',
      'Sign in to contribute. Any identity works, including anonymous.',
    );
  }
  return user;
}

export async function enforceWriteLimit(context: AppContext, identity: string): Promise<void> {
  const decision = await context.rateLimiter.check(
    `write:${identity}`,
    context.limits.write.limit,
    context.limits.write.windowMs,
  );
  if (!decision.allowed) {
    throw new AppError('RATE_LIMITED', 'Slow down: too many writes in the last minute.', {
      retryAfterSeconds: Math.max(1, Math.ceil((decision.resetAt - Date.now()) / 1000)),
    });
  }
}
