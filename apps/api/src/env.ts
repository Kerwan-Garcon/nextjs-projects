import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(3001),
  DATABASE_URL: z.string().default('postgres://saveus:saveus@127.0.0.1:5432/saveus'),
  REDIS_URL: z.string().optional(),
  /** Signs session cookies. Generated per-process in development. */
  APP_SECRET: z.string().min(16).default('dev-only-secret-change-me-please'),
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
  return parsed.data;
}
