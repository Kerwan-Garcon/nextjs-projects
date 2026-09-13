import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { AppError, Handle } from '@saveus/common';
import type { ApiEnv } from '../app.js';
import { SESSION_COOKIE, createSession, destroySession } from '../auth.js';

/**
 * Deliberately minimal identity. There are no passwords in the MVP: what the
 * platform needs is a stable author for a contribution, not proof of who
 * someone is. Registering as anonymous is a first-class option.
 */
export function authRoutes() {
  const routes = new Hono<ApiEnv>();

  routes.get('/me', (c) => c.json({ user: c.get('user') }));

  routes.get('/auth/identities', async (c) => {
    const { db } = c.get('ctx');
    const users = await db
      .selectFrom('users')
      .select(['handle', 'display_name', 'reputation', 'is_anonymous', 'bio'])
      .orderBy('reputation', 'desc')
      .limit(24)
      .execute();

    return c.json({
      identities: users.map((user) => ({
        handle: user.handle,
        displayName: user.display_name,
        reputation: user.reputation,
        isAnonymous: user.is_anonymous,
        bio: user.bio,
      })),
    });
  });

  routes.post('/auth/login', zValidator('json', z.object({ handle: Handle })), async (c) => {
    const { db, env } = c.get('ctx');
    const { handle } = c.req.valid('json');

    const user = await db
      .selectFrom('users')
      .where('handle', '=', handle)
      .selectAll()
      .executeTakeFirst();
    if (!user) throw AppError.notFound('Researcher');

    const cookie = await createSession(db, user.id, env.APP_SECRET);
    setCookie(c, SESSION_COOKIE, cookie, {
      httpOnly: true,
      sameSite: 'Lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
      secure: env.NODE_ENV === 'production',
    });

    return c.json({
      user: {
        id: user.id,
        handle: user.handle,
        displayName: user.display_name,
        reputation: user.reputation,
        trust: user.trust,
        isAnonymous: user.is_anonymous,
      },
    });
  });

  routes.post(
    '/auth/register',
    zValidator(
      'json',
      z.object({
        handle: Handle,
        displayName: z.string().trim().min(1).max(80).optional(),
        anonymous: z.boolean().default(false),
      }),
    ),
    async (c) => {
      const { db, env } = c.get('ctx');
      const input = c.req.valid('json');

      const existing = await db
        .selectFrom('users')
        .where('handle', '=', input.handle)
        .select('id')
        .executeTakeFirst();
      if (existing) throw AppError.conflict('That handle is taken');

      const user = await db
        .insertInto('users')
        .values({
          handle: input.handle,
          display_name: input.displayName ?? input.handle,
          bio: null,
          is_anonymous: input.anonymous,
          origin: 'HUMAN',
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      const cookie = await createSession(db, user.id, env.APP_SECRET);
      setCookie(c, SESSION_COOKIE, cookie, {
        httpOnly: true,
        sameSite: 'Lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
        secure: env.NODE_ENV === 'production',
      });

      return c.json(
        {
          user: {
            id: user.id,
            handle: user.handle,
            displayName: user.display_name,
            reputation: user.reputation,
            trust: user.trust,
            isAnonymous: user.is_anonymous,
          },
        },
        201,
      );
    },
  );

  routes.post('/auth/logout', async (c) => {
    const { db, env } = c.get('ctx');
    await destroySession(db, getCookie(c, SESSION_COOKIE), env.APP_SECRET);
    deleteCookie(c, SESSION_COOKIE, { path: '/' });
    return c.json({ ok: true });
  });

  return routes;
}
