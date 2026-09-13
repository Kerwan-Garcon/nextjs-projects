import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { ProblemFilterInput } from '@saveus/common';
import type { ApiEnv } from '../app.js';
import { getProblem, listProblems, platformStats } from '../services/problems.js';
import { listHypothesesForProblem } from '../services/hypotheses.js';
import { listContributions } from '../services/contributions.js';
import { listSessions } from '../services/research.js';

export function problemRoutes() {
  const routes = new Hono<ApiEnv>();

  routes.get('/problems', zValidator('query', ProblemFilterInput), async (c) => {
    const { db } = c.get('ctx');
    const result = await listProblems(db, c.req.valid('query'));
    return c.json(result);
  });

  routes.get('/problems/:idOrSlug', async (c) => {
    const { db } = c.get('ctx');
    const problem = await getProblem(db, c.req.param('idOrSlug'));
    const [hypotheses, contributions, sessions] = await Promise.all([
      listHypothesesForProblem(db, problem.id),
      listContributions(db, 'PROBLEM', problem.id),
      listSessions(db, { problemId: problem.id, limit: 6 }),
    ]);
    return c.json({ problem, hypotheses, contributions, sessions });
  });

  routes.get('/stats', async (c) => c.json(await platformStats(c.get('ctx').db)));

  return routes;
}
