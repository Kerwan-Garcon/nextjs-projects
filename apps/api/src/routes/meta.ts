import { Hono } from 'hono';
import {
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
    const { db, provider } = c.get('ctx');
    const [domains, stats] = await Promise.all([
      db.selectFrom('domains').selectAll().orderBy('sort_order').execute(),
      platformStats(db),
    ]);

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
