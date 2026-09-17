import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  AUTHOR_SETTABLE_STATUSES,
  CreateHypothesisInput,
  EvidenceStance,
  HypothesisStatus,
  Id,
  SourceType,
} from '@saveus/common';
import { enforceWriteLimit, requireUser, type ApiEnv } from '../app.js';
import {
  attachEvidence,
  createHypothesis,
  getHypothesis,
  setAuthorStatus,
} from '../services/hypotheses.js';
import { listContributions } from '../services/contributions.js';
import { listRuns, listSessions } from '../services/research.js';

export function hypothesisRoutes() {
  const routes = new Hono<ApiEnv>();

  routes.get('/hypotheses/:id', async (c) => {
    const { db } = c.get('ctx');
    const id = c.req.param('id');
    const hypothesis = await getHypothesis(db, id);
    const [contributions, sessions, runs] = await Promise.all([
      listContributions(db, 'HYPOTHESIS', id),
      listSessions(db, { hypothesisId: id, limit: 10 }),
      listRuns(db, { hypothesisId: id, limit: 40 }),
    ]);
    return c.json({ hypothesis, contributions, sessions, runs });
  });

  routes.post('/hypotheses', zValidator('json', CreateHypothesisInput), async (c) => {
    const ctx = c.get('ctx');
    const user = requireUser(c.get('user'));
    await enforceWriteLimit(ctx, user.id);
    const hypothesis = await createHypothesis(ctx.db, user.id, c.req.valid('json'));
    return c.json({ hypothesis }, 201);
  });

  routes.post(
    '/hypotheses/:id/status',
    zValidator(
      'json',
      z.object({
        status: HypothesisStatus.refine(
          (value) => AUTHOR_SETTABLE_STATUSES.includes(value),
          'Validation-only statuses cannot be set by an author',
        ),
      }),
    ),
    async (c) => {
      const ctx = c.get('ctx');
      const user = requireUser(c.get('user'));
      await enforceWriteLimit(ctx, user.id);
      const status = await setAuthorStatus(
        ctx.db,
        user.id,
        c.req.param('id'),
        c.req.valid('json').status,
      );
      return c.json({ status });
    },
  );

  routes.post(
    '/hypotheses/:id/evidence',
    zValidator(
      'json',
      z
        .object({
          stance: EvidenceStance,
          claim: z.string().trim().min(10).max(1200),
          strength: z.number().int().min(1).max(5).default(3),
          sourceId: Id.optional(),
          newSource: z
            .object({
              title: z.string().trim().min(3).max(400),
              url: z.string().trim().url(),
              publisher: z.string().trim().min(1).max(200),
              sourceType: SourceType.default('OTHER'),
              publicationDate: z.string().trim().max(40).nullable().default(null),
              authors: z.array(z.string().trim().max(200)).max(60).default([]),
            })
            .optional(),
          agentRunId: Id.optional(),
        })
        .refine(
          (value) => Boolean(value.sourceId) !== Boolean(value.newSource),
          'Provide exactly one of sourceId or newSource',
        ),
    ),
    async (c) => {
      const ctx = c.get('ctx');
      const user = requireUser(c.get('user'));
      await enforceWriteLimit(ctx, user.id);

      const input = c.req.valid('json');
      const evidence = await attachEvidence(ctx.db, user.id, {
        hypothesisId: c.req.param('id'),
        stance: input.stance,
        claim: input.claim,
        strength: input.strength,
        ...(input.sourceId ? { sourceId: input.sourceId } : {}),
        ...(input.newSource ? { newSource: input.newSource } : {}),
        ...(input.agentRunId ? { agentRunId: input.agentRunId } : {}),
      });

      const hypothesis = await getHypothesis(ctx.db, c.req.param('id'));
      return c.json({ evidence, hypothesis }, 201);
    },
  );

  return routes;
}
