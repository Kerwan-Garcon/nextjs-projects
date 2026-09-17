import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { DomainKey, Id } from '@saveus/common';
import { requireUser, type ApiEnv } from '../app.js';
import { getProfile, leaderboard, recentBreakthroughs, topProblems } from '../services/people.js';

export function peopleRoutes() {
  const routes = new Hono<ApiEnv>();

  routes.get(
    '/leaderboard',
    zValidator(
      'query',
      z.object({
        scope: z.enum(['global', 'weekly', 'domain', 'problem']).default('global'),
        domain: DomainKey.optional(),
        problemId: Id.optional(),
        limit: z.coerce.number().int().min(1).max(50).default(20),
      }),
    ),
    async (c) => {
      const { db } = c.get('ctx');
      const query = c.req.valid('query');
      const [entries, problems, breakthroughs] = await Promise.all([
        leaderboard(db, {
          scope: query.scope,
          ...(query.domain ? { domain: query.domain } : {}),
          ...(query.problemId ? { problemId: query.problemId } : {}),
          limit: query.limit,
        }),
        topProblems(db),
        recentBreakthroughs(db),
      ]);
      return c.json({ entries, topProblems: problems, breakthroughs });
    },
  );

  routes.get('/researchers/:handle', async (c) =>
    c.json({ profile: await getProfile(c.get('ctx').db, c.req.param('handle')) }),
  );

  routes.get('/my-work', async (c) => {
    const { db } = c.get('ctx');
    const user = requireUser(c.get('user'));

    const [profile, hypotheses, contributions, sessions] = await Promise.all([
      getProfile(db, user.handle),
      db
        .selectFrom('hypotheses as h')
        .innerJoin('problems as p', 'p.id', 'h.problem_id')
        .where('h.author_id', '=', user.id)
        .select([
          'h.id',
          'h.ref',
          'h.title',
          'h.status',
          'h.updated_at',
          'p.slug as problem_slug',
          'p.title as problem_title',
        ])
        .orderBy('h.updated_at', 'desc')
        .execute(),
      db
        .selectFrom('contributions as c')
        .innerJoin('problems as p', 'p.id', 'c.problem_id')
        .where('c.author_id', '=', user.id)
        .select([
          'c.id',
          'c.kind',
          'c.body',
          'c.score',
          'c.created_at',
          'c.target_type',
          'c.target_id',
          'p.slug as problem_slug',
          'p.title as problem_title',
        ])
        .orderBy('c.created_at', 'desc')
        .limit(40)
        .execute(),
      db
        .selectFrom('research_sessions')
        .where('requested_by_id', '=', user.id)
        .select(['id', 'title', 'question', 'action', 'status', 'created_at'])
        .orderBy('created_at', 'desc')
        .limit(20)
        .execute(),
    ]);

    return c.json({
      profile,
      hypotheses: hypotheses.map((row) => ({
        id: row.id,
        ref: row.ref,
        title: row.title,
        status: row.status,
        updatedAt: row.updated_at.toISOString(),
        problemSlug: row.problem_slug,
        problemTitle: row.problem_title,
      })),
      contributions: contributions.map((row) => ({
        id: row.id,
        kind: row.kind,
        body: row.body,
        score: row.score,
        createdAt: row.created_at.toISOString(),
        targetType: row.target_type,
        targetId: row.target_id,
        problemSlug: row.problem_slug,
        problemTitle: row.problem_title,
      })),
      sessions: sessions.map((row) => ({
        id: row.id,
        title: row.title,
        question: row.question,
        action: row.action,
        status: row.status,
        createdAt: row.created_at.toISOString(),
      })),
    });
  });

  return routes;
}
