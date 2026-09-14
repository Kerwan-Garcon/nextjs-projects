/**
 * Database configuration, resolved once from the environment.
 *
 * The defaults are shaped for the two places this runs, which want opposite
 * things. A long-lived server wants a generous pool it keeps warm. A serverless
 * function wants almost none: every concurrent invocation is its own process,
 * and a managed Postgres free tier counts connections, so a pool of ten there is
 * how a deployment runs out of them under mild traffic.
 */
export interface DbConfig {
  connectionString: string;
  maxPoolSize: number;
  ssl: boolean;
  /** Verify the server certificate. Off only where a provider requires it. */
  rejectUnauthorized: boolean;
}

const DEFAULT_URL = 'postgres://saveus:saveus@127.0.0.1:5432/saveus';

/** Hosts that are never reached over the public internet. */
function isLocal(connectionString: string): boolean {
  try {
    const host = new URL(connectionString).hostname;
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host.endsWith('.local') ||
      host.endsWith('.internal')
    );
  } catch {
    return false;
  }
}

/**
 * Serverless platforms all set this. It is the difference between "keep a pool"
 * and "this process may be one of two hundred".
 */
function isServerless(env: NodeJS.ProcessEnv): boolean {
  return Boolean(env.VERCEL || env.AWS_LAMBDA_FUNCTION_NAME || env.NETLIFY || env.FUNCTIONS_WORKER_RUNTIME);
}

export function resolveDbConfig(env: NodeJS.ProcessEnv = process.env): DbConfig {
  const connectionString = env.DATABASE_URL?.trim() || DEFAULT_URL;

  // Managed Postgres requires TLS and local Postgres usually has none, so the
  // host decides unless the environment says otherwise. Getting this wrong is
  // either a connection that refuses or one that is silently in clear text.
  const ssl =
    env.DATABASE_SSL === 'true'
      ? true
      : env.DATABASE_SSL === 'false'
        ? false
        : !isLocal(connectionString);

  const defaultPool = isServerless(env) ? 1 : 10;

  return {
    connectionString,
    maxPoolSize: Number(env.DATABASE_POOL_SIZE ?? defaultPool),
    ssl,
    // Providers that terminate TLS with their own CA (Neon, Supabase and
    // Render all do) need this relaxed. It is opt-out rather than opt-in
    // because refusing to connect is a worse first experience than a warning.
    rejectUnauthorized: env.DATABASE_SSL_STRICT === 'true',
  };
}
