import { z } from 'zod';

const DEV_SECRET = 'dev-only-secret-change-me-please';

/**
 * Every session secret this repository has ever published.
 *
 * Checking only the schema default was not enough, and the gap was the one that
 * mattered: `.env.example` tells you to replace a *different* placeholder, so
 * copying that file and deploying it passed the guard while signing sessions
 * with a value printed in the repository. A secret is only a secret if it is
 * not in the source tree, so all of them are refused.
 */
const PUBLISHED_SECRETS = new Set([DEV_SECRET, 'change-me-to-a-long-random-string', 'change-me']);

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(3001),
  DATABASE_URL: z.string().default('postgres://saveus:saveus@127.0.0.1:5432/saveus'),
  REDIS_URL: z.string().optional(),
  /** Signs session cookies. Refused at its default value in production. */
  APP_SECRET: z.string().min(16).default(DEV_SECRET),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().optional(),
  AI_PROVIDER: z.enum(['anthropic', 'deterministic']).optional(),
  /** Allows the API to run agent pipelines inline instead of via the worker. */
  INLINE_AGENT_RUNS: z.coerce.boolean().default(true),
  /**
   * Google sign-in. Optional: with no client id and secret the provider is
   * simply absent from the sign-in page, and handle sign-in keeps working.
   */
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  /**
   * Public origin of the web app, used to build the OAuth redirect URI and to
   * bound where a sign-in may return to.
   */
  PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  /**
   * Authorises the scheduled intake endpoint. Without it the endpoint refuses
   * every request, which is the correct behaviour for a deployment that has not
   * set one: an unauthenticated cron endpoint is a way for anyone to make the
   * platform fetch other people's servers on demand.
   */
  CRON_SECRET: z.string().min(16).optional(),
  /**
   * Where rate-limit counters live. Postgres by default, because a counter in
   * process memory is not a limit on any deployment with more than one process.
   * Only set this to `memory` for a single-process server that wants to avoid
   * the round trip.
   */
  RATE_LIMIT_DRIVER: z.enum(['postgres', 'memory']).optional(),
});

export type AppEnv = z.infer<typeof EnvSchema>;

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/**
 * The Google configuration, or null when it is not fully set. Half-configured
 * is treated as unconfigured: a sign-in button that leads to an error is worse
 * than no button.
 */
export function googleConfig(env: AppEnv): GoogleOAuthConfig | null {
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;

  return {
    clientId,
    clientSecret,
    redirectUri: new URL('/api/auth/google/callback', env.PUBLIC_APP_URL).toString(),
  };
}

export function readEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Invalid environment:\n  ${issues.join('\n  ')}`);
  }

  const env = parsed.data;

  // A deployment signing sessions with a key printed in this repository is one
  // anybody can mint a session for. Refusing to boot is the only safe response:
  // a warning in a log nobody reads is not one.
  if (env.NODE_ENV === 'production' && PUBLISHED_SECRETS.has(env.APP_SECRET.trim())) {
    throw new Error(
      'APP_SECRET is still a placeholder published in this repository. Set a real one before deploying: openssl rand -base64 32',
    );
  }

  return env;
}
