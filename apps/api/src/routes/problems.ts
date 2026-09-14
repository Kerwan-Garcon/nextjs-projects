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

  /**
   * Public, identical for every visitor, and the page most traffic lands on.
   * A shared cache in front of it is what stops a burst reaching the database
   * at all; the numbers on a board tolerate being seconds old.
   */
  routes.get('/problems', zValidator('query', ProblemFilterInput), async (c) => {
    c.header('Cache-Control', 'public, max-age=0, s-maxage=30, stale-while-revalidate=300');
    const { db } = c.get('ctx');
    const result = await listProblems(db, c.req.valid('query'));
    return c.json(result);
  });

  routes.get('/problems/:idOrSlug', async (c) => {
    c.header('Cache-Control', 'public, max-age=0, s-maxage=30, stale-while-revalidate=300');
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
