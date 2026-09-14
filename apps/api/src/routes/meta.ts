import { Hono } from 'hono';
import {
  CACHE_TTL,
  CONFIDENCE_DESCRIPTORS,
  EPISTEMIC_DESCRIPTORS,
  HypothesisStatus,
  REPUTATION_TIERS,
  SIGNAL_WEIGHTS,
} from '@saveus/common';
import type { ApiEnv } from '../app.js';
import { platformStats } from '../services/problems.js';
import { agentRegistry, researchActions } from '../services/research.js';

/**
 * Reference data the client needs to render the epistemic layer correctly.
 * Shipping the definitions from the server means the legend in the UI and the
 * rules in the domain layer cannot drift apart.
 */
export function metaRoutes() {
  const routes = new Hono<ApiEnv>();

  routes.get('/health', async (c) => {
    const { db } = c.get('ctx');
    try {
      await db.selectFrom('domains').select('key').limit(1).execute();
      return c.json({ status: 'ok', database: 'up' });
    } catch {
      return c.json({ status: 'degraded', database: 'down' }, 503);
    }
  });

  routes.get('/meta', async (c) => {
    const { db, provider, cache } = c.get('ctx');

    // These two are the reason this endpoint was expensive: six counts across
    // the whole database, and the reference tables, on every page render
    // because the header shows the counters. Both tolerate being a minute old;
    // neither is part of any claim the platform makes about evidence.
    const [domains, stats] = await Promise.all([
      cache.wrap('meta:domains', CACHE_TTL.reference, () =>
        db.selectFrom('domains').selectAll().orderBy('sort_order').execute(),
      ),
      cache.wrap('meta:stats', CACHE_TTL.platformStats, () => platformStats(db)),
    ]);

    // The board is public and identical for everybody, so a shared cache in
    // front of it absorbs the traffic the database would otherwise see.
    c.header(
      'Cache-Control',
      `public, max-age=0, s-maxage=${Math.round(CACHE_TTL.platformStats / 1000)}, stale-while-revalidate=300`,
    );

    return c.json({
      stats,
      domains: domains.map((domain) => ({
        key: domain.key,
        label: domain.label,
        description: domain.description,
        accent: domain.accent,
      })),
      epistemicKinds: Object.values(EPISTEMIC_DESCRIPTORS),
      confidenceLevels: Object.values(CONFIDENCE_DESCRIPTORS),
      hypothesisStatuses: HypothesisStatus.options,
      reputationTiers: REPUTATION_TIERS,
      scoringWeights: SIGNAL_WEIGHTS,
      researchActions: researchActions(),
      agents: agentRegistry(),
      ai: { provider: provider.name, model: provider.model },
    });
  });

  routes.get('/agents', (c) => c.json({ agents: agentRegistry() }));

  return routes;
}
