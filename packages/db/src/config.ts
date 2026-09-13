/** Database configuration, resolved once from the environment. */
export interface DbConfig {
  connectionString: string;
  maxPoolSize: number;
  ssl: boolean;
}

const DEFAULT_URL = 'postgres://saveus:saveus@127.0.0.1:5432/saveus';

export function resolveDbConfig(env: NodeJS.ProcessEnv = process.env): DbConfig {
  const connectionString = env.DATABASE_URL?.trim() || DEFAULT_URL;
  return {
    connectionString,
    maxPoolSize: Number(env.DATABASE_POOL_SIZE ?? 10),
    ssl: env.DATABASE_SSL === 'true',
  };
}
