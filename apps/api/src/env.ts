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
});

export type AppEnv = z.infer<typeof EnvSchema>;

export function readEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Invalid environment:\n  ${issues.join('\n  ')}`);
  }
  return parsed.data;
}
