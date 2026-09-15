import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { callerIdentity, enforceWriteLimit, requireUser, type ApiEnv } from '../app.js';
import {
  completeLesson,
  getCourse,
  getLesson,
  learningProgress,
  listCourses,
} from '../services/courses.js';

const Slug = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'A slug is lowercase letters, digits and hyphens.');

/**
 * Courses are readable by anyone, signed in or not. Progress needs an identity
 * because it belongs to somebody; nothing else here does.
 */
export function courseRoutes() {
  const routes = new Hono<ApiEnv>();

  routes.get('/courses', async (c) => {
    const { db } = c.get('ctx');
    const user = c.get('user');
    return c.json({ courses: await listCourses(db, user?.id ?? null) });
  });

  routes.get('/courses/:course', zValidator('param', z.object({ course: Slug })), async (c) => {
    const { db } = c.get('ctx');
    const user = c.get('user');
    return c.json({ course: await getCourse(db, c.req.valid('param').course, user?.id ?? null) });
  });

  routes.get(
    '/courses/:course/lessons/:lesson',
    zValidator('param', z.object({ course: Slug, lesson: Slug })),
    async (c) => {
      const { db } = c.get('ctx');
      const user = c.get('user');
      const { course, lesson } = c.req.valid('param');
      return c.json({ lesson: await getLesson(db, course, lesson, user?.id ?? null) });
    },
  );

  routes.post(
    '/courses/:course/lessons/:lesson/complete',
    zValidator('param', z.object({ course: Slug, lesson: Slug })),
    zValidator(
      'json',
      z.object({
        // One entry per question, in order; -1 for a question left unanswered.
        answers: z.array(z.number().int().min(-1).max(16)).max(32).default([]),
      }),
    ),
    async (c) => {
      const context = c.get('ctx');
      const user = requireUser(c.get('user'));
      await enforceWriteLimit(context, callerIdentity(c));

      const { course, lesson } = c.req.valid('param');
      const { answers } = c.req.valid('json');
      const result = await completeLesson(context.db, user.id, course, lesson, answers);

      // No reputation event, by design. Finishing a lesson is not a research
      // contribution and this endpoint must never become a way to earn standing.
      return c.json({ completedAt: result.completedAt });
    },
  );

  routes.get('/my-learning', async (c) => {
    const { db } = c.get('ctx');
    const user = requireUser(c.get('user'));
    return c.json({ progress: await learningProgress(db, user.id) });
  });

  return routes;
}
