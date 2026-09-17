import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { createContext } from './context.js';

/**
 * Standalone API server. The web app mounts the same Hono app in-process; this
 * entry point exists so other clients (a future desktop or mobile build) can
 * talk to the platform without Next.js in the path.
 */
const context = createContext();
const app = createApp(context);

serve({ fetch: app.fetch, port: context.env.PORT }, (info) => {
  console.log(`SAVE US API listening on http://localhost:${info.port}/api`);
  console.log(`  AI provider: ${context.provider.name} (${context.provider.model})`);
  console.log(`  Queue driver: ${context.queue.driver}`);
});
