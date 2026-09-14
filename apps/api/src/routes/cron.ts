import { Hono } from 'hono';
import { runIngestionCycle, resolveConnectors, isLiveIntakeEnabled } from '@saveus/agents';
import { AppError, resolveScheduleHour, shouldRunDaily, timingSafeEqualString } from '@saveus/common';
import { lastScheduledIngestion } from '@saveus/db';
import type { ApiEnv } from '../app.js';

/**
 * Scheduled work, as HTTP.
 *
 * The worker process owns the clock when there is a worker process. On a
 * serverless host there is not one, so the platform's scheduler calls this
 * instead and the endpoint carries the two properties the worker had:
 *
 * It refuses anyone without the shared secret. An open endpoint that makes the
 * platform fetch a dozen other people's servers is a denial-of-service tool
 * pointed at publishers who never agreed to any of this.
 *
 * And it is idempotent for the day. Platform schedulers retry, overlap, and
 * fire twice across regions; the decision to run is taken from the last
 * recorded run in the database, exactly as the worker takes it.
 */

/** Leave room to finish the bookkeeping before the platform kills the call. */
const RESERVE_MS = 8_000;
const DEFAULT_BUDGET_MS = 55_000;

export function cronRoutes() {
  const routes = new Hono<ApiEnv>();

  routes.on(['GET', 'POST'], '/cron/intake', async (c) => {
    const { db, env } = c.get('ctx');

    if (!env.CRON_SECRET) {
      throw AppError.notFound('Scheduled intake (CRON_SECRET is not configured)');
    }

    // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`; other schedulers
    // are given the same shape, or a header, so neither needs the secret in a
    // URL where it would end up in access logs.
    const presented =
      c.req.header('authorization')?.replace(/^Bearer\s+/i, '') ?? c.req.header('x-cron-secret') ?? '';
    if (!timingSafeEqualString(presented, env.CRON_SECRET)) {
      throw AppError.unauthorized('Bad or missing cron credentials');
    }

    const hour = resolveScheduleHour();
    const force = c.req.query('force') === 'true';
    const lastRunAt = await lastScheduledIngestion(db);

    if (!force && !shouldRunDaily({ now: new Date(), lastRunAt, hour })) {
      return c.json({
        ran: false,
        reason: 'Already ingested today',
        lastRunAt: lastRunAt ? lastRunAt.toISOString() : null,
      });
    }

    const budgetMs = Number(process.env.INTAKE_BUDGET_MS ?? DEFAULT_BUDGET_MS);
    const startedAt = Date.now();

    const { stats, skipped } = await runIngestionCycle({
      db,
      connectors: resolveConnectors(db),
      trigger: 'SCHEDULED',
      deadlineAt: startedAt + Math.max(5_000, budgetMs - RESERVE_MS),
    });

    return c.json({
      ran: true,
      live: isLiveIntakeEnabled(),
      elapsedMs: Date.now() - startedAt,
      // Connectors are independent, so whatever the budget did not reach is
      // simply first in line tomorrow.
      skipped,
      connectors: stats.map((stat) => ({
        connector: stat.connector,
        fetched: stat.fetched,
        accepted: stat.accepted,
        weak: stat.weak,
        rejected: stat.rejected,
        duplicates: stat.duplicates,
        candidates: stat.candidates,
        deferred: stat.deferred,
        rejectionReasons: stat.rejectionReasons,
        errors: stat.errors.length,
      })),
    });
  });

  return routes;
}
