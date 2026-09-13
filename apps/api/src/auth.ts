import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { sha256Hex } from '@saveus/common';
import type { Db } from '@saveus/db';

/**
 * Deliberately simple authentication.
 *
 * A signed cookie carries an opaque token; the token's hash is the session row.
 * No passwords, because the platform's premise is that an anonymous account
 * with good evidence is worth as much as a credentialed one - what matters is
 * that a contribution has a stable, attributable author.
 */

export const SESSION_COOKIE = 'saveus_session';
const SESSION_TTL_DAYS = 30;

export interface SessionUser {
  id: string;
  handle: string;
  displayName: string;
  reputation: number;
  trust: number;
  isAnonymous: boolean;
}

export function signToken(token: string, secret: string): string {
  const signature = createHmac('sha256', secret).update(token).digest('base64url');
  return `${token}.${signature}`;
}

export function verifyToken(signed: string, secret: string): string | null {
  const index = signed.lastIndexOf('.');
  if (index <= 0) return null;

  const token = signed.slice(0, index);
  const provided = Buffer.from(signed.slice(index + 1));
  const expected = Buffer.from(createHmac('sha256', secret).update(token).digest('base64url'));

  if (provided.length !== expected.length) return null;
  return timingSafeEqual(provided, expected) ? token : null;
}

export async function createSession(db: Db, userId: string, secret: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await db
    .insertInto('auth_sessions')
    .values({ user_id: userId, token_hash: sha256Hex(token), expires_at: expiresAt })
    .execute();

  return signToken(token, secret);
}

export async function resolveSession(
  db: Db,
  signed: string | undefined,
  secret: string,
): Promise<SessionUser | null> {
  if (!signed) return null;
  const token = verifyToken(signed, secret);
  if (!token) return null;

  const row = await db
    .selectFrom('auth_sessions as s')
    .innerJoin('users as u', 'u.id', 's.user_id')
    .where('s.token_hash', '=', sha256Hex(token))
    .where('s.expires_at', '>', new Date())
    .select(['u.id', 'u.handle', 'u.display_name', 'u.reputation', 'u.trust', 'u.is_anonymous'])
    .executeTakeFirst();

  if (!row) return null;
  return {
    id: row.id,
    handle: row.handle,
    displayName: row.display_name,
    reputation: row.reputation,
    trust: row.trust,
    isAnonymous: row.is_anonymous,
  };
}

export async function destroySession(
  db: Db,
  signed: string | undefined,
  secret: string,
): Promise<void> {
  if (!signed) return;
  const token = verifyToken(signed, secret);
  if (!token) return;
  await db.deleteFrom('auth_sessions').where('token_hash', '=', sha256Hex(token)).execute();
}
