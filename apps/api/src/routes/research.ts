import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { AppError, Id, RATE_LIMITS, ResearchAction, sanitizeUntrusted } from '@saveus/common';
import { requireUser, type ApiEnv } from '../app.js';
import {
  getSession,
  listRuns,
  listSessions,
  researchActions,
  runResearch,
} from '../services/research.js';

/**
 * Contextual research actions.
 *
 * There is no general "ask AI" endpoint here on purpose: an action names the
 * pipeline it runs, and the pipeline names the agents. Rate limiting is
 * stricter than for ordinary writes because an agent run costs real money and
 * real time.
 */
export function researchRoutes() {
  const routes = new Hono<ApiEnv>();

  routes.get('/research/actions', (c) => c.json({ actions: researchActions() }));

  routes.get('/research/sessions', async (c) => {
    const { db } = c.get('ctx');
    const limit = Number(c.req.query('limit') ?? 20);
    return c.json({
      sessions: await listSessions(db, { limit: Math.min(50, Math.max(1, limit)) }),
    });
  });

  routes.get('/research/sessions/:id', async (c) =>
    c.json({ session: await getSession(c.get('ctx').db, c.req.param('id')) }),
  );

  routes.get('/agent-runs', async (c) => {
    const { db } = c.get('ctx');
    const limit = Number(c.req.query('limit') ?? 30);
    return c.json({ runs: await listRuns(db, { limit: Math.min(100, Math.max(1, limit)) }) });
  });

  routes.post(
    '/research/run',
    zValidator(
      'json',
      z
        .object({
          action: ResearchAction,
          question: z.string().trim().min(10).max(400),
          hypothesisId: Id.optional(),
          problemId: Id.optional(),
        })
        .refine(
          (value) => Boolean(value.hypothesisId) || Boolean(value.problemId),
          'A research action must target a hypothesis or a problem',
        ),
    ),
    async (c) => {
      const ctx = c.get('ctx');
      const user = requireUser(c.get('user'));

      const decision = await ctx.rateLimiter.check(
        `agent:${user.id}`,
        RATE_LIMITS.agentRun.limit,
        RATE_LIMITS.agentRun.windowMs,
      );
      if (!decision.allowed) {
        throw new AppError(
          'RATE_LIMITED',
          `Agent runs are limited to ${decision.limit} per minute. This one costs compute; queue it again shortly.`,
          { retryAfterSeconds: Math.max(1, Math.ceil((decision.resetAt - Date.now()) / 1000)) },
        );
      }

      const input = c.req.valid('json');
      const session = await runResearch({
        db: ctx.db,
        provider: ctx.provider,
        search: ctx.search,
        action: input.action,
        question: sanitizeUntrusted(input.question, 400).text,
        hypothesisId: input.hypothesisId ?? null,
        problemId: input.problemId ?? null,
        requestedById: user.id,
      });

      return c.json({ session }, 201);
    },
  );

  return routes;
}
