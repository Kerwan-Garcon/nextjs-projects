import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { curateCandidate, isLiveIntakeEnabled, resolveConnectors, runIngestion } from '@saveus/agents';
import { AppError, INTAKE_THRESHOLDS } from '@saveus/common';
import { JOB_NAMES } from '@saveus/common/queue';
import { requireUser, type ApiEnv } from '../app.js';
import { loadSources } from '../services/serializers.js';
import { PublishProblemInput, publishProblem } from '../services/publish.js';

/**
 * Problem ingestion.
 *
 * The queue is public because the curation decision is part of the research
 * record: anyone can see what the pipeline proposed, what it threw out and why,
 * which checks a candidate failed, and who decided. Publishing remains a human
 * act, gated by the checklist.
 */
export function ingestionRoutes() {
  const routes = new Hono<ApiEnv>();

  routes.get('/ingestion/connectors', (c) => {
    const { db } = c.get('ctx');
    const live = isLiveIntakeEnabled();
    return c.json({
      live,
      thresholds: INTAKE_THRESHOLDS,
      connectors: resolveConnectors(db).map((connector) => ({
        name: connector.name,
        description: connector.description,
        allowedHosts: [...connector.allowedHosts],
      })),
    });
  });

  /** Intake health: what ran, what it fetched, and what it rejected. */
  routes.get('/ingestion/runs', async (c) => {
    const { db } = c.get('ctx');
    const runs = await db
      .selectFrom('ingestion_runs')
      .selectAll()
      .orderBy('started_at', 'desc')
      .limit(30)
      .execute();

    return c.json({
      runs: runs.map((run) => ({
        id: run.id,
        connector: run.connector,
        trigger: run.trigger,
        startedAt: run.started_at.toISOString(),
        finishedAt: run.finished_at ? run.finished_at.toISOString() : null,
        fetched: run.fetched,
        accepted: run.accepted,
        weak: run.weak,
        rejected: run.rejected,
        duplicates: run.duplicates,
        candidates: run.candidates,
        deferred: run.deferred,
        flagged: run.flagged,
        rejectionReasons: run.rejection_reasons,
        error: run.error,
      })),
    });
  });

  /** What the gate threw away. The queue is only half the story. */
  routes.get('/ingestion/rejected', async (c) => {
    const { db } = c.get('ctx');
    const rows = await db
      .selectFrom('raw_documents')
      .where('intake_verdict', '=', 'REJECT')
      .select([
        'id',
        'connector',
        'title',
        'url',
        'publisher',
        'published_at',
        'intake_score',
        'intake_code',
        'intake_reasons',
        'fetched_at',
      ])
      .orderBy('fetched_at', 'desc')
      .limit(40)
      .execute();

    return c.json({
      documents: rows.map((row) => ({
        id: row.id,
        connector: row.connector,
        title: row.title,
        url: row.url,
        publisher: row.publisher,
        publishedAt: row.published_at,
        score: row.intake_score,
        code: row.intake_code,
        reasons: row.intake_reasons,
        fetchedAt: row.fetched_at.toISOString(),
      })),
    });
  });

  routes.get('/ingestion/candidates', async (c) => {
    const { db } = c.get('ctx');
    const status = c.req.query('status');

    let query = candidateQuery(db).orderBy('pc.relevance_score', 'desc').limit(60);
    if (status) query = query.where('pc.status', '=', status as never);

    const rows = await query.execute();
    return c.json({ candidates: await serializeCandidates(db, rows) });
  });

  routes.get('/ingestion/candidates/:id', async (c) => {
    const { db } = c.get('ctx');
    const row = await candidateQuery(db).where('pc.id', '=', c.req.param('id')).executeTakeFirst();
    if (!row) throw AppError.notFound('Candidate');

    const [candidate] = await serializeCandidates(db, [row]);
    return c.json({ candidate });
  });

  routes.post(
    '/ingestion/candidates/:id/curate',
    zValidator(
      'json',
      z.object({
        decision: z.enum(['APPROVE', 'REJECT']),
        note: z.string().trim().max(600).nullable().default(null),
      }),
    ),
    async (c) => {
      const ctx = c.get('ctx');
      const user = requireUser(c.get('user'));
      const input = c.req.valid('json');

      const outcome = await curateCandidate(ctx.db, {
        candidateId: c.req.param('id'),
        curatorId: user.id,
        decision: input.decision,
        note: input.note,
      });

      return c.json({ outcome }, outcome.status === 'BLOCKED' ? 409 : 200);
    },
  );

  /**
   * The only path from the queue to the board. The checklist is re-evaluated
   * against what the curator wrote, so approval cannot buy a pass.
   */
  routes.post('/problems', zValidator('json', PublishProblemInput), async (c) => {
    const ctx = c.get('ctx');
    const user = requireUser(c.get('user'));
    const result = await publishProblem(ctx.db, user.id, c.req.valid('json'));
    return c.json(result, 201);
  });

  /** Run a cycle now. Queued, not executed inline: intake is slow by nature. */
  routes.post('/ingestion/run', async (c) => {
    const ctx = c.get('ctx');
    const user = requireUser(c.get('user'));

    const decision = await ctx.rateLimiter.check(`intake:${user.id}`, 3, 10 * 60_000);
    if (!decision.allowed) {
      throw new AppError(
        'RATE_LIMITED',
        'Intake cycles are limited to 3 per 10 minutes. Fetching other people’s servers is not free for them.',
        { retryAfterSeconds: Math.max(1, Math.ceil((decision.resetAt - Date.now()) / 1000)) },
      );
    }

    if (ctx.env.INLINE_AGENT_RUNS && ctx.queue.driver === 'memory') {
      // With no worker attached, run inline so the button is not a lie.
      const stats = await runIngestion({
        db: ctx.db,
        connectors: resolveConnectors(ctx.db),
        trigger: 'MANUAL',
      });
      return c.json({ mode: 'inline', stats });
    }

    const jobId = await ctx.queue.enqueue(JOB_NAMES.ingestionCycle, { trigger: 'MANUAL' });
    return c.json({ mode: 'queued', jobId }, 202);
  });

  return routes;
}

type CandidateRow = Awaited<ReturnType<ReturnType<typeof candidateQuery>['execute']>>[number];

function candidateQuery(db: ApiEnv['Variables']['ctx']['db']) {
  return db
    .selectFrom('problem_candidates as pc')
    .leftJoin('users as u', 'u.id', 'pc.curated_by_id')
    .leftJoin('problems as p', 'p.id', 'pc.published_problem_id')
    .selectAll('pc')
    .select(['u.handle as curator_handle', 'p.slug as published_slug'])
    .orderBy('pc.created_at', 'desc');
}

async function serializeCandidates(
  db: ApiEnv['Variables']['ctx']['db'],
  rows: readonly CandidateRow[],
) {
  const sources = await loadSources(
    db,
    rows.flatMap((row) => row.source_ids),
  );
  const sourceById = new Map(sources.map((source) => [source.id, source]));

  return rows.map((row) => ({
    id: row.id,
    connector: row.connector,
    title: row.title,
    summary: row.summary,
    status: row.status,
    curationScore: row.curation_score,
    relevanceScore: row.relevance_score,
    assessment: row.assessment,
    blocking: row.blocking,
    warnings: row.warnings,
    proposedDomains: row.proposed_domains,
    extractedClaims: row.extracted_claims,
    draft: row.draft,
    sources: row.source_ids.map((id) => sourceById.get(id)).filter(Boolean),
    curatorHandle: row.curator_handle,
    curatorNote: row.curator_note,
    publishedSlug: row.published_slug,
    createdAt: row.created_at.toISOString(),
  }));
}
