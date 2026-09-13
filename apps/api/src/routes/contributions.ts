import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { ContributionTargetType, CreateContributionInput, Id } from '@saveus/common';
import { enforceWriteLimit, requireUser, type ApiEnv } from '../app.js';
import {
  createContribution,
  endorseContribution,
  listContributions,
} from '../services/contributions.js';

export function contributionRoutes() {
  const routes = new Hono<ApiEnv>();

  routes.get(
    '/contributions',
    zValidator('query', z.object({ targetType: ContributionTargetType, targetId: Id })),
    async (c) => {
      const { db } = c.get('ctx');
      const { targetType, targetId } = c.req.valid('query');
      return c.json({ contributions: await listContributions(db, targetType, targetId) });
    },
  );

  routes.post('/contributions', zValidator('json', CreateContributionInput), async (c) => {
    const ctx = c.get('ctx');
    const user = requireUser(c.get('user'));
    await enforceWriteLimit(ctx, user.id);

    const result = await createContribution(
      ctx.db,
      { id: user.id, trust: user.trust },
      c.req.valid('json'),
    );
    return c.json(result, 201);
  });

  routes.post('/contributions/:id/endorse', async (c) => {
    const ctx = c.get('ctx');
    const user = requireUser(c.get('user'));
    await enforceWriteLimit(ctx, user.id);
    return c.json(await endorseContribution(ctx.db, user.id, c.req.param('id')));
  });

  return routes;
}
