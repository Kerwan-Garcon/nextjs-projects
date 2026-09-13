import { randomUUID } from 'node:crypto';

/**
 * Queue abstraction.
 *
 * Ingestion and agent execution are asynchronous by design: the HTTP layer
 * enqueues, the worker executes. The in-memory driver keeps the app runnable
 * with no Redis; the Redis driver is the one used when REDIS_URL is set.
 */

export interface JobEnvelope<T = unknown> {
  id: string;
  name: string;
  payload: T;
  enqueuedAt: string;
  attempts: number;
}

export interface EnqueueOptions {
  /** Stable id makes an enqueue idempotent within a driver's dedup window. */
  idempotencyKey?: string;
  maxAttempts?: number;
}

export type JobHandler = (job: JobEnvelope) => Promise<void>;

export interface Queue {
  readonly driver: string;
  enqueue<T>(name: string, payload: T, options?: EnqueueOptions): Promise<string>;
  /** Pull a single job, or null if the queue is empty. */
  reserve(timeoutMs?: number): Promise<JobEnvelope | null>;
  complete(job: JobEnvelope): Promise<void>;
  fail(job: JobEnvelope, error: Error): Promise<void>;
  size(): Promise<number>;
  close(): Promise<void>;
}

export class InMemoryQueue implements Queue {
  readonly driver = 'memory';
  private readonly jobs: JobEnvelope[] = [];
  private readonly seen = new Set<string>();
  readonly dead: { job: JobEnvelope; error: string }[] = [];

  async enqueue<T>(name: string, payload: T, options: EnqueueOptions = {}): Promise<string> {
    if (options.idempotencyKey) {
      if (this.seen.has(options.idempotencyKey)) return options.idempotencyKey;
      this.seen.add(options.idempotencyKey);
    }
    const job: JobEnvelope<T> = {
      id: options.idempotencyKey ?? randomUUID(),
      name,
      payload,
      enqueuedAt: new Date().toISOString(),
      attempts: 0,
    };
    this.jobs.push(job as JobEnvelope);
    return job.id;
  }

  async reserve(): Promise<JobEnvelope | null> {
    const job = this.jobs.shift();
    if (!job) return null;
    return { ...job, attempts: job.attempts + 1 };
  }

  async complete(): Promise<void> {
    // Nothing to release: reserve() already removed the job.
  }

  async fail(job: JobEnvelope, error: Error): Promise<void> {
    if (job.attempts < 3) {
      this.jobs.push(job);
      return;
    }
    this.dead.push({ job, error: error.message });
  }

  async size(): Promise<number> {
    return this.jobs.length;
  }

  async close(): Promise<void> {
    this.jobs.length = 0;
  }
}

interface RedisLike {
  lpush(key: string, value: string): Promise<number>;
  rpop(key: string): Promise<string | null>;
  llen(key: string): Promise<number>;
  set(key: string, value: string, mode: 'EX', seconds: number, flag: 'NX'): Promise<unknown>;
  quit(): Promise<unknown>;
}

export class RedisQueue implements Queue {
  readonly driver = 'redis';

  constructor(
    private readonly redis: RedisLike,
    private readonly key = 'saveus:jobs',
  ) {}

  async enqueue<T>(name: string, payload: T, options: EnqueueOptions = {}): Promise<string> {
    if (options.idempotencyKey) {
      const set = await this.redis.set(
        `${this.key}:idem:${options.idempotencyKey}`,
        '1',
        'EX',
        3600,
        'NX',
      );
      if (set === null) return options.idempotencyKey;
    }
    const job: JobEnvelope<T> = {
      id: options.idempotencyKey ?? randomUUID(),
      name,
      payload,
      enqueuedAt: new Date().toISOString(),
      attempts: 0,
    };
    await this.redis.lpush(this.key, JSON.stringify(job));
    return job.id;
  }

  async reserve(): Promise<JobEnvelope | null> {
    const raw = await this.redis.rpop(this.key);
    if (!raw) return null;
    const job = JSON.parse(raw) as JobEnvelope;
    return { ...job, attempts: job.attempts + 1 };
  }

  async complete(): Promise<void> {
    // At-least-once: the job left the list on reserve().
  }

  async fail(job: JobEnvelope, error: Error): Promise<void> {
    const target = job.attempts < 3 ? this.key : `${this.key}:dead`;
    const payload = job.attempts < 3 ? job : { ...job, error: error.message };
    await this.redis.lpush(target, JSON.stringify(payload));
  }

  async size(): Promise<number> {
    return this.redis.llen(this.key);
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }
}

/** Job names are a closed set so the worker can reject anything unexpected. */
export const JOB_NAMES = {
  agentRun: 'agent.run',
  researchPipeline: 'research.pipeline',
  ingestionCycle: 'ingestion.cycle',
  rescoreProblem: 'problem.rescore',
} as const;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];

export function isKnownJobName(name: string): name is JobName {
  return Object.values(JOB_NAMES).includes(name as JobName);
}
