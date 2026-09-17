import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { getApp } from './app-instance';

/**
 * Server-side data access. Requests are dispatched into the mounted Hono app
 * with the visitor's cookies forwarded, so a server component sees exactly what
 * the browser would see - including who is signed in.
 */

const ORIGIN = 'http://saveus.internal';

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

async function dispatch(path: string, init?: RequestInit): Promise<Response> {
  const jar = await cookies();
  const cookieHeader = jar
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ');

  const headers = new Headers(init?.headers);
  if (cookieHeader) headers.set('cookie', cookieHeader);

  return getApp().request(new Request(`${ORIGIN}${path}`, { ...init, headers }));
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await dispatch(path);
  if (response.ok) return (await response.json()) as T;

  const body = (await response.json().catch(() => null)) as {
    error?: { code?: string; message?: string };
  } | null;
  throw new ApiRequestError(
    response.status,
    body?.error?.code ?? 'INTERNAL',
    body?.error?.message ?? `Request to ${path} failed with ${response.status}`,
  );
}

/** Same as apiGet, but a 404 renders the Next not-found page. */
export async function apiGetOr404<T>(path: string): Promise<T> {
  try {
    return await apiGet<T>(path);
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) notFound();
    throw error;
  }
}

export async function apiGetOrNull<T>(path: string): Promise<T | null> {
  try {
    return await apiGet<T>(path);
  } catch {
    return null;
  }
}
