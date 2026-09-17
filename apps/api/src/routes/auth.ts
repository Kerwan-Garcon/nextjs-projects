import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { AppError, Handle } from '@saveus/common';
import { json, type Db } from '@saveus/db';
import type { ApiEnv } from '../app.js';
import { SESSION_COOKIE, createSession, destroySession } from '../auth.js';
import { googleConfig, type AppEnv } from '../env.js';
import {
  GoogleAuthError,
  buildAuthorizationRequest,
  exchangeCode,
  suggestHandle,
  uniqueHandle,
  verifyIdToken,
  type GoogleIdentity,
} from '../services/google-oauth.js';

/**
 * Identity.
 *
 * There are still no passwords. What the platform needs is a stable, credited
 * author for a contribution, not proof of who somebody is, and registering as
 * anonymous remains a first-class option worth exactly as much reputation as
 * any other account.
 *
 * Google sign-in exists because "pick a handle" is a poor door for anyone
 * returning on a second device, not because the platform wants an identity
 * document. It asks for `openid email profile` and nothing else, it stores the
 * provider's subject rather than the email as the link, and the email is never
 * shown on the board: the handle is.
 */
export function authRoutes() {
  const routes = new Hono<ApiEnv>();

  /** What the sign-in page should offer. */
  routes.get('/auth/providers', (c) => {
    const { env } = c.get('ctx');
    return c.json({
      handle: true,
      google: googleConfig(env) !== null,
    });
  });

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

  /* ---------------------------------------------------------------- */
  /* Google                                                            */
  /* ---------------------------------------------------------------- */

  /**
   * Step one: mint the PKCE verifier, the state and the nonce, keep all three
   * server-side, and redirect. Nothing that matters travels in the URL.
   */
  routes.get('/auth/google/start', async (c) => {
    const { db, env } = c.get('ctx');
    const config = googleConfig(env);
    if (!config) throw AppError.notFound('Google sign-in');

    const request = buildAuthorizationRequest(config);

    await sweepExpiredStates(db);
    await db
      .insertInto('oauth_states')
      .values({
        state: request.state,
        provider: 'google',
        code_verifier: request.codeVerifier,
        nonce: request.nonce,
        redirect_to: safeReturnPath(c.req.query('returnTo')),
        expires_at: new Date(Date.now() + 10 * 60 * 1000),
      })
      .execute();

    return c.redirect(request.url, 302);
  });

  /**
   * Step two. Every failure below ends at the sign-in page with a short reason
   * in the query string rather than a stack trace: the browser arrives here by
   * redirect, so there is nobody to read a JSON error.
   */
  routes.get('/auth/google/callback', async (c) => {
    const { db, env } = c.get('ctx');
    const config = googleConfig(env);
    if (!config) throw AppError.notFound('Google sign-in');

    const failure = c.req.query('error');
    if (failure) return c.redirect(signInUrl(env, failure === 'access_denied' ? 'cancelled' : 'denied'), 302);

    const code = c.req.query('code');
    const state = c.req.query('state');
    if (!code || !state) return c.redirect(signInUrl(env, 'incomplete'), 302);

    // Single use: the row is deleted whether or not the rest succeeds, so a
    // replayed callback finds nothing.
    const pending = await db
      .deleteFrom('oauth_states')
      .where('state', '=', state)
      .where('provider', '=', 'google')
      .where('expires_at', '>', new Date())
      .returning(['code_verifier', 'nonce', 'redirect_to'])
      .executeTakeFirst();

    // No row means the state was never issued here, was already used, or has
    // expired. All three are the same answer.
    if (!pending) return c.redirect(signInUrl(env, 'expired'), 302);

    let identity: GoogleIdentity;
    try {
      const idToken = await exchangeCode(config, code, pending.code_verifier);
      identity = await verifyIdToken(idToken, config, pending.nonce);
    } catch (error) {
      const reason = error instanceof GoogleAuthError ? error.reason : 'UNKNOWN';
      console.warn(`[auth] Google sign-in refused: ${reason}`);
      return c.redirect(signInUrl(env, 'refused'), 302);
    }

    // An unverified address cannot be used to claim an account. Google almost
    // always verifies; when it has not, we do not pretend it has.
    if (identity.email && !identity.emailVerified) {
      return c.redirect(signInUrl(env, 'unverified'), 302);
    }

    const userId = await linkOrCreateUser(db, identity);
    const cookie = await createSession(db, userId, env.APP_SECRET);
    setCookie(c, SESSION_COOKIE, cookie, {
      httpOnly: true,
      sameSite: 'Lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
      secure: env.NODE_ENV === 'production',
    });

    return c.redirect(new URL(pending.redirect_to ?? '/problems', env.PUBLIC_APP_URL).toString(), 302);
  });

  routes.post('/auth/logout', async (c) => {
    const { db, env } = c.get('ctx');
    await destroySession(db, getCookie(c, SESSION_COOKIE), env.APP_SECRET);
    deleteCookie(c, SESSION_COOKIE, { path: '/' });
    return c.json({ ok: true });
  });

  return routes;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/**
 * Only a path on this app, never an absolute URL. An open redirect on a
 * sign-in endpoint is the classic way to make a phishing link look genuine.
 */
export function safeReturnPath(input: string | undefined): string | null {
  if (!input) return null;
  if (!input.startsWith('/') || input.startsWith('//')) return null;
  if (input.includes('\\')) return null;
  // A control character in a Location header is how response splitting starts.
  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    if (code < 0x20 || code === 0x7f) return null;
  }
  return input.slice(0, 200);
}

function signInUrl(env: AppEnv, reason: string): string {
  const url = new URL('/sign-in', env.PUBLIC_APP_URL);
  url.searchParams.set('error', reason);
  return url.toString();
}

async function sweepExpiredStates(db: Db): Promise<void> {
  await db.deleteFrom('oauth_states').where('expires_at', '<', new Date()).execute();
}

/**
 * Find the account this identity belongs to, or make one.
 *
 * The provider's subject is the link. An email match is accepted only as a
 * second chance to reunite an existing Google-created account with its owner,
 * and only when Google says the address is verified - a handle-only account is
 * never claimed by an email, because nobody proved they own that handle.
 */
async function linkOrCreateUser(db: Db, identity: GoogleIdentity): Promise<string> {
  const existing = await db
    .selectFrom('oauth_identities')
    .where('provider', '=', 'google')
    .where('subject', '=', identity.subject)
    .select('user_id')
    .executeTakeFirst();

  if (existing) {
    await db
      .updateTable('oauth_identities')
      .set({
        email: identity.email,
        email_verified: identity.emailVerified,
        display_name: identity.name,
        picture_url: identity.picture,
        last_login_at: new Date(),
      })
      .where('provider', '=', 'google')
      .where('subject', '=', identity.subject)
      .execute();
    return existing.user_id;
  }

  const handle = await uniqueHandle(suggestHandle(identity), async (candidate) => {
    const clash = await db
      .selectFrom('users')
      .where('handle', '=', candidate)
      .select('id')
      .executeTakeFirst();
    return clash !== undefined;
  });

  const userId = randomUUID();
  await db.transaction().execute(async (trx) => {
    await trx
      .insertInto('users')
      .values({
        id: userId,
        handle,
        display_name: identity.name?.slice(0, 80) ?? handle,
        bio: null,
        is_anonymous: false,
        origin: 'HUMAN',
      })
      .execute();

    await trx
      .insertInto('oauth_identities')
      .values({
        provider: 'google',
        subject: identity.subject,
        user_id: userId,
        email: identity.email,
        email_verified: identity.emailVerified,
        display_name: identity.name,
        picture_url: identity.picture,
      })
      .execute();

    await trx
      .insertInto('audit_log')
      .values({
        actor_type: 'USER',
        actor_id: userId,
        action: 'auth.google.register',
        target_type: 'USER',
        target_id: userId,
        metadata: json({ handle }),
      })
      .execute();
  });

  return userId;
}
