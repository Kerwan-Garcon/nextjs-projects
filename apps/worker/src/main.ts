import { isKnownJobName, JOB_NAMES, type JobEnvelope, type Queue } from '@saveus/common/queue';
import { InMemoryQueue, RedisQueue } from '@saveus/common/queue';
import {
  CorpusSearchProvider,
  DEFAULT_CONNECTORS,
  ProblemScopedSearchProvider,
  resolveProvider,
  runIngestion,
  runResearchPipeline,
} from '@saveus/agents';
import { createDb, type Db } from '@saveus/db';
import type { ResearchAction } from '@saveus/common';

/**
 * Background worker.
 *
 * Ingestion and agent execution are queue jobs, not request handlers: they are
 * slow, they cost money, and they must survive a browser tab closing. The API
 * enqueues; this process executes. With no Redis configured it still runs, on
 * an in-memory queue, so a single-machine deployment needs no extra service.
 */

const POLL_INTERVAL_MS = 1_000;

async function createQueue(): Promise<Queue> {
  const url = process.env.REDIS_URL?.trim();
  if (!url) {
    console.log('[worker] REDIS_URL is not set: running on the in-memory queue driver.');
    return new InMemoryQueue();
  }
  const { default: Redis } = await import('ioredis');
  console.log('[worker] using the Redis queue driver.');
  return new RedisQueue(new Redis(url));
}

async function handle(db: Db, job: JobEnvelope): Promise<void> {
  if (!isKnownJobName(job.name)) {
    throw new Error(
      `Unknown job name "${job.name}" - the worker refuses jobs it does not recognise`,
    );
  }

  const provider = resolveProvider(process.env);
  const search = new ProblemScopedSearchProvider(db, new CorpusSearchProvider(db));

  switch (job.name) {
    case JOB_NAMES.researchPipeline:
    case JOB_NAMES.agentRun: {
      const payload = job.payload as {
        action: ResearchAction;
        question: string;
        hypothesisId?: string | null;
        problemId?: string | null;
        requestedById?: string | null;
      };
      const result = await runResearchPipeline({
        db,
        provider,
        search,
        action: payload.action,
        question: payload.question,
        hypothesisId: payload.hypothesisId ?? null,
        problemId: payload.problemId ?? null,
        requestedById: payload.requestedById ?? null,
      });
      console.log(`[worker] research session ${result.sessionId}: ${result.runs.length} run(s)`);
      return;
    }

    case JOB_NAMES.ingestionCycle: {
      const stats = await runIngestion({ db, connectors: DEFAULT_CONNECTORS });
      for (const stat of stats) {
        console.log(
          `[worker] ingestion ${stat.connector}: fetched ${stat.fetched}, ${stat.candidates} candidate(s), ` +
            `${stat.duplicates} duplicate(s), ${stat.rejected.length} rejected`,
        );
      }
      return;
    }

    case JOB_NAMES.rescoreProblem:
      // Reserved: recomputing problem-level aggregates is a read model concern
      // and is currently derived on query rather than stored.
      return;
  }
}

async function main(): Promise<void> {
  const { db, pool } = createDb();
  const queue = await createQueue();
  let running = true;

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[worker] ${signal} received, draining.`);
    running = false;
    await queue.close().catch(() => undefined);
    await db.destroy();
    await pool.end().catch(() => undefined);
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  console.log('[worker] ready.');

  while (running) {
    const job = await queue.reserve();
    if (!job) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      continue;
    }

    try {
      await handle(db, job);
      await queue.complete(job);
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));
      console.error(`[worker] job ${job.name} failed (attempt ${job.attempts}):`, failure.message);
      await queue.fail(job, failure);
    }
  }
}

await main();
