import { createApp, createContext, type ApiApp } from '@saveus/api';

/**
 * The API, in-process.
 *
 * The web app mounts the same Hono application the standalone API server runs.
 * Server components dispatch requests into it directly - no network hop, no
 * port, no duplicated data layer - and the browser talks to it over HTTP
 * through the catch-all route handler. One API, two transports.
 */
declare global {
  var __saveusApp: ApiApp | undefined;
}

export function getApp(): ApiApp {
  if (!globalThis.__saveusApp) {
    globalThis.__saveusApp = createApp(createContext());
  }
  return globalThis.__saveusApp;
}
