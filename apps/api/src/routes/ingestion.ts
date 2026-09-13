import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { curateCandidate, DEFAULT_CONNECTORS } from '@saveus/agents';
import { requireUser, type ApiEnv } from '../app.js';

/**
 * Problem ingestion.
 *
 * The queue is public because the curation decision is part of the research
 * record: anyone can see what the pipeline proposed, which checks it failed,
 * and who decided. Publishing remains a human act.
 */
export function ingestionRoutes() {
  const routes = new Hono<ApiEnv>();

  routes.get('/ingestion/connectors', (c) =>
    c.json({
      connectors: DEFAULT_CONNECTORS.map((connector) => ({
        name: connector.name,
        description: connector.description,
        allowedHosts: [...connector.allowedHosts],
      })),
    }),
  );

  routes.get('/ingestion/candidates', async (c) => {
    const { db } = c.get('ctx');
    const rows = await db
      .selectFrom('problem_candidates as pc')
      .leftJoin('users as u', 'u.id', 'pc.curated_by_id')
      .selectAll('pc')
      .select(['u.handle as curator_handle'])
      .orderBy('pc.created_at', 'desc')
      .limit(50)
      .execute();

    return c.json({
      candidates: rows.map((row) => ({
        id: row.id,
        connector: row.connector,
        title: row.title,
        summary: row.summary,
        status: row.status,
        curationScore: row.curation_score,
        blocking: row.blocking,
        warnings: row.warnings,
        proposedDomains: row.proposed_domains,
        extractedClaims: row.extracted_claims,
        sourceIds: row.source_ids,
        curatorHandle: row.curator_handle,
        curatorNote: row.curator_note,
        createdAt: row.created_at.toISOString(),
      })),
    });
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

  return routes;
}
