import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getCookie } from 'hono/cookie';
import { AppError, HTTP_STATUS, RATE_LIMITS } from '@saveus/common';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { SESSION_COOKIE, resolveSession, type SessionUser } from './auth.js';
import { createContext, type AppContext } from './context.js';
import { authRoutes } from './routes/auth.js';
import { contributionRoutes } from './routes/contributions.js';
import { hypothesisRoutes } from './routes/hypotheses.js';
import { ingestionRoutes } from './routes/ingestion.js';
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
    const identity = c.get('user')?.id ?? c.req.header('x-forwarded-for') ?? 'anonymous';
    const decision = await context.rateLimiter.check(
      `read:${identity}`,
      RATE_LIMITS.read.limit,
      RATE_LIMITS.read.windowMs,
    );
    if (!decision.allowed) {
      return c.json({ error: { code: 'RATE_LIMITED', message: 'Too many requests' } }, 429);
    }
    await next();
  });

  app.onError((error, c) => {
    if (error instanceof AppError) {
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
  app.route('/', ingestionRoutes());

  return app;
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
    RATE_LIMITS.write.limit,
    RATE_LIMITS.write.windowMs,
  );
  if (!decision.allowed) {
    throw new AppError('RATE_LIMITED', 'Slow down: too many writes in the last minute.');
  }
}
