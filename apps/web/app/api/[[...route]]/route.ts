import { getApp } from '@/lib/app-instance';

/**
 * Browser-facing transport for the API. Forms and contextual actions post here;
 * the handler hands the request to the same Hono app the server components use.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * The intake cycle fetches a dozen feeds, so it needs more than a request
 * handler's default. This is the ceiling the platform allows on the free plan;
 * the cycle carries its own budget and stops cleanly inside it.
 */
export const maxDuration = 60;

const handler = (request: Request): Response | Promise<Response> => getApp().fetch(request);

export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
  handler as OPTIONS,
};
