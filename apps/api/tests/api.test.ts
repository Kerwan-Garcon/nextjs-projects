import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolveConnectors, runIngestion } from '@saveus/agents';
import { createHarness, postJson, withCookie, type Harness } from './helpers.js';

let harness: Harness;
let problemId: string;
let problemSlug: string;
let hypothesisId: string;

beforeAll(async () => {
  harness = await createHarness();
  const board = await harness.json<{ problems: { id: string; slug: string }[] }>(
    '/api/problems?limit=1',
  );
  problemId = board.problems[0]!.id;
  problemSlug = board.problems[0]!.slug;

  const detail = await harness.json<{ hypotheses: { id: string }[] }>(
    `/api/problems/${problemSlug}`,
  );
  hypothesisId = detail.hypotheses[0]!.id;
}, 120_000);

afterAll(async () => {
  await harness?.close();
});

describe('health and reference data', () => {
  it('reports the database as up', async () => {
    const response = await harness.request('/api/health');
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'ok', database: 'up' });
  });

  it('serves the epistemic vocabulary the interface renders', async () => {
    const meta = await harness.json<{
      epistemicKinds: { kind: string }[];
      agents: unknown[];
      researchActions: unknown[];
      stats: { activeProblems: number };
    }>('/api/meta');

    expect(meta.epistemicKinds.map((kind) => kind.kind)).toEqual([
      'FACT',
      'SOURCE_CLAIM',
      'HUMAN_HYPOTHESIS',
      'AI_HYPOTHESIS',
      'INFERENCE',
      'UNKNOWN',
    ]);
    expect(meta.agents).toHaveLength(11);
    expect(meta.researchActions.length).toBeGreaterThanOrEqual(8);
    expect(meta.stats.activeProblems).toBeGreaterThan(15);
  });

  it('returns a typed error for an unknown endpoint', async () => {
    const response = await harness.request('/api/nope');
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });
});

describe('problem board', () => {
  it('filters by domain and returns aggregates', async () => {
    const result = await harness.json<{
      problems: { domains: { key: string }[]; evidenceCount: number }[];
      total: number;
    }>('/api/problems?domain=energy&limit=50');

    expect(result.problems.length).toBeGreaterThan(0);
    for (const problem of result.problems) {
      expect(problem.domains.map((domain) => domain.key)).toContain('energy');
      expect(problem.evidenceCount).toBeGreaterThan(0);
    }
  });

  it('filters by difficulty and urgency', async () => {
    const result = await harness.json<{ problems: { difficulty: number; urgency: number }[] }>(
      '/api/problems?minDifficulty=8&minUrgency=8&limit=50',
    );
    for (const problem of result.problems) {
      expect(problem.difficulty).toBeGreaterThanOrEqual(8);
      expect(problem.urgency).toBeGreaterThanOrEqual(8);
    }
  });

  it('rejects an out-of-range filter rather than silently clamping', async () => {
    const response = await harness.request('/api/problems?minDifficulty=99');
    expect(response.status).toBe(400);
  });

  it('resolves a problem by slug, by ref and by id, and 404s otherwise', async () => {
    expect((await harness.request(`/api/problems/${problemSlug}`)).status).toBe(200);
    expect((await harness.request(`/api/problems/${problemId}`)).status).toBe(200);
    expect((await harness.request('/api/problems/not-a-real-problem')).status).toBe(404);
  });

  it('returns every factual statement with its epistemic kind and sources', async () => {
    const { problem } = await harness.json<{
      problem: {
        whyItMatters: { kind: string; sourceIds: string[] }[];
        sources: { url: string }[];
      };
    }>(`/api/problems/${problemSlug}`);

    expect(problem.whyItMatters.length).toBeGreaterThan(0);
    for (const statement of problem.whyItMatters) {
      expect([
        'FACT',
        'SOURCE_CLAIM',
        'INFERENCE',
        'UNKNOWN',
        'HUMAN_HYPOTHESIS',
        'AI_HYPOTHESIS',
      ]).toContain(statement.kind);
      // A claim presented as coming from a source must carry one.
      if (statement.kind === 'SOURCE_CLAIM' || statement.kind === 'FACT') {
        expect(statement.sourceIds.length).toBeGreaterThan(0);
      }
    }
    for (const source of problem.sources) {
      expect(source.url.startsWith('https://')).toBe(true);
    }
  });
});

describe('authentication', () => {
  it('reports no user when unauthenticated', async () => {
    expect(await harness.json<{ user: null }>('/api/me')).toEqual({ user: null });
  });

  it('signs in a seeded identity and resolves the session from the cookie', async () => {
    const cookie = await harness.signIn('a-devi');
    const me = await harness.json<{ user: { handle: string } | null }>(
      '/api/me',
      withCookie(cookie),
    );
    expect(me.user?.handle).toBe('a-devi');
  });

  it('refuses an unknown handle', async () => {
    const response = await harness.request('/api/auth/login', postJson({ handle: 'nobody-here' }));
    expect(response.status).toBe(404);
  });

  it('registers an anonymous researcher and lets them contribute', async () => {
    const response = await harness.request(
      '/api/auth/register',
      postJson({ handle: 'anon-test-01', anonymous: true }),
    );
    expect(response.status).toBe(201);
    const body = (await response.json()) as { user: { isAnonymous: boolean; reputation: number } };
    expect(body.user.isAnonymous).toBe(true);
    expect(body.user.reputation).toBe(0);
  });

  it('refuses a duplicate handle', async () => {
    const response = await harness.request('/api/auth/register', postJson({ handle: 'a-devi' }));
    expect(response.status).toBe(409);
  });

  it('rejects a forged session cookie', async () => {
    const me = await harness.json<{ user: unknown }>(
      '/api/me',
      withCookie('saveus_session=forged.signature'),
    );
    expect(me.user).toBeNull();
  });
});

describe('sign-in providers', () => {
  it('advertises Google only when it is fully configured', async () => {
    const providers = await harness.json<{ handle: boolean; google: boolean }>(
      '/api/auth/providers',
    );
    expect(providers.handle).toBe(true);
    // The harness sets no Google credentials, so the button must not appear.
    expect(providers.google).toBe(false);
  });

  it('does not expose the Google endpoints when it is not configured', async () => {
    // Half-configured or unconfigured, the answer is the same: there is no
    // such door, rather than a door that leads to an error.
    for (const path of ['/api/auth/google/start', '/api/auth/google/callback?code=x&state=y']) {
      const response = await harness.request(path);
      expect(response.status).toBe(404);
    }
  });
});

describe('contributions', () => {
  it('requires authentication', async () => {
    const response = await harness.request(
      '/api/contributions',
      postJson({
        kind: 'COMMENT',
        targetType: 'HYPOTHESIS',
        targetId: hypothesisId,
        body: 'This is a contribution long enough to pass validation checks.',
      }),
    );
    expect(response.status).toBe(401);
  });

  it('rejects a contribution with no substance', async () => {
    const cookie = await harness.signIn('a-devi');
    const response = await harness.request(
      '/api/contributions',
      postJson(
        { kind: 'COMMENT', targetType: 'HYPOTHESIS', targetId: hypothesisId, body: 'too short' },
        cookie,
      ),
    );
    expect(response.status).toBe(400);
  });

  it('scores a contribution and records a reputation event', async () => {
    const cookie = await harness.signIn('j-morel');
    const before = await harness.json<{ user: { reputation: number } }>(
      '/api/me',
      withCookie(cookie),
    );

    const response = await harness.request(
      '/api/contributions',
      postJson(
        {
          kind: 'COUNTERARGUMENT',
          targetType: 'HYPOTHESIS',
          targetId: hypothesisId,
          body: 'The first assumption is load-bearing and unsourced: if the population at risk is not concentrated in this typology, the expected impact collapses. A pre-registered case-control design over past episodes would settle it.',
        },
        cookie,
      ),
    );

    expect(response.status).toBe(201);
    const body = (await response.json()) as {
      score: number;
      reputationDelta: number;
      newReputation: number;
      contribution: { kind: string; author: { handle: string } };
    };
    expect(body.score).toBeGreaterThan(0);
    expect(body.contribution.kind).toBe('COUNTERARGUMENT');
    expect(body.newReputation).not.toBe(before.user.reputation);
  });

  it('damps repeated contributions from the same author on the same problem', async () => {
    const cookie = await harness.signIn('w-osei');
    const body =
      'A substantive point about the mechanism, stated at enough length to be scored rather than rejected as noise.';

    const deltas: number[] = [];
    for (let index = 0; index < 3; index += 1) {
      const response = await harness.request(
        '/api/contributions',
        postJson(
          {
            kind: 'COMMENT',
            targetType: 'PROBLEM',
            targetId: problemId,
            body: `${body} Iteration ${index}.`,
          },
          cookie,
        ),
      );
      const payload = (await response.json()) as { reputationDelta: number };
      deltas.push(payload.reputationDelta);
    }

    expect(deltas[2]!).toBeLessThanOrEqual(deltas[0]!);
  });

  it('refuses to let an author endorse their own contribution', async () => {
    const cookie = await harness.signIn('h-tanaka');
    const created = await harness.request(
      '/api/contributions',
      postJson(
        {
          kind: 'QUESTION',
          targetType: 'PROBLEM',
          targetId: problemId,
          body: 'What observation would distinguish the two leading hypotheses on this problem?',
        },
        cookie,
      ),
    );
    const { contribution } = (await created.json()) as { contribution: { id: string } };

    const self = await harness.request(
      `/api/contributions/${contribution.id}/endorse`,
      withCookie(cookie, { method: 'POST' }),
    );
    expect(self.status).toBe(403);

    const other = await harness.signIn('p-raman');
    const response = await harness.request(
      `/api/contributions/${contribution.id}/endorse`,
      withCookie(other, { method: 'POST' }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ endorsements: 1 });
  });
});

describe('hypotheses', () => {
  it('creates a hypothesis as DRAFT regardless of what the author wants', async () => {
    const cookie = await harness.signIn('l-ferreira');
    const response = await harness.request(
      '/api/hypotheses',
      postJson(
        {
          problemId,
          title: 'A testable proposal about the binding constraint',
          claim:
            'The binding constraint is institutional rather than technical, and acting on it changes the outcome within one cycle.',
          mechanism:
            'The institutional step gates every technical step downstream, so removing it unblocks work that is already funded and specified.',
          expectedImpact: 'Shortens the deployment timeline; magnitude UNKNOWN.',
          assumptions: ['The technical steps are genuinely ready', 'The institution can be moved'],
          unknowns: ['How long the institutional step actually takes'],
          risks: ['Moving the institution may create a different bottleneck'],
          estimatedCost: null,
          estimatedScalability: null,
          validationMethod:
            'Compare timelines in comparable jurisdictions that changed the institutional step against those that did not.',
        },
        cookie,
      ),
    );

    expect(response.status).toBe(201);
    const { hypothesis } = (await response.json()) as {
      hypothesis: { id: string; status: string; epistemicKind: string; evidence: unknown[] };
    };
    expect(hypothesis.status).toBe('DRAFT');
    expect(hypothesis.epistemicKind).toBe('HUMAN_HYPOTHESIS');
    expect(hypothesis.evidence).toHaveLength(0);
  });

  it('refuses to let an author mark their own hypothesis validated', async () => {
    const cookie = await harness.signIn('l-ferreira');
    const created = await harness.request(
      '/api/hypotheses',
      postJson(
        {
          problemId,
          title: 'Another proposal, created to test the status gate',
          claim:
            'This claim exists so the validation gate can be exercised against a hypothesis the caller owns.',
          mechanism:
            'The mechanism text has to clear the minimum length, so it says what it does and why that matters.',
          expectedImpact: 'No impact claimed; this record exists to test the API.',
          assumptions: ['The test database is seeded'],
          unknowns: [],
          risks: [],
          estimatedCost: null,
          estimatedScalability: null,
          validationMethod: 'Not applicable: this record exists to exercise the status endpoint.',
        },
        cookie,
      ),
    );
    const { hypothesis } = (await created.json()) as { hypothesis: { id: string } };

    const forbidden = await harness.request(
      `/api/hypotheses/${hypothesis.id}/status`,
      postJson({ status: 'VALIDATED' }, cookie),
    );
    expect(forbidden.status).toBe(400);

    const allowed = await harness.request(
      `/api/hypotheses/${hypothesis.id}/status`,
      postJson({ status: 'UNDER_REVIEW' }, cookie),
    );
    expect(allowed.status).toBe(200);
    expect(await allowed.json()).toMatchObject({ status: 'UNDER_REVIEW' });
  });

  it('refuses a status change by someone who is not the author', async () => {
    const other = await harness.signIn('k-adeyemi');
    const response = await harness.request(
      `/api/hypotheses/${hypothesisId}/status`,
      postJson({ status: 'UNDER_REVIEW' }, other),
    );
    expect(response.status).toBe(403);
  });

  it('attaches evidence, normalises the source, and recomputes the status', async () => {
    const cookie = await harness.signIn('s-lindqvist');
    const created = await harness.request(
      '/api/hypotheses',
      postJson(
        {
          problemId,
          title: 'A proposal used to exercise evidence attachment end to end',
          claim:
            'Attaching contradicting evidence should move this hypothesis away from an unsupported state.',
          mechanism:
            'Evidence is attached to the hypothesis, and the status is derived from the balance and reliability of that evidence.',
          expectedImpact: 'No real-world impact claimed.',
          assumptions: ['The evidence engine runs on write'],
          unknowns: [],
          risks: [],
          estimatedCost: null,
          estimatedScalability: null,
          validationMethod: 'Read the status back from the API after attaching evidence.',
        },
        cookie,
      ),
    );
    const { hypothesis } = (await created.json()) as { hypothesis: { id: string; status: string } };
    expect(hypothesis.status).toBe('DRAFT');

    await harness.request(
      `/api/hypotheses/${hypothesis.id}/status`,
      postJson({ status: 'UNDER_REVIEW' }, cookie),
    );

    const attached = await harness.request(
      `/api/hypotheses/${hypothesis.id}/evidence`,
      postJson(
        {
          stance: 'CONTRADICTS',
          claim:
            'The IPCC assessment covers the general case and does not establish the specific quantity claimed.',
          strength: 4,
          newSource: {
            title: 'Climate Change 2022: Impacts, Adaptation and Vulnerability',
            url: 'https://www.ipcc.ch/report/ar6/wg2/?utm_source=test',
            publisher: 'IPCC',
            sourceType: 'UN',
            publicationDate: '2022-02',
            authors: [],
          },
        },
        cookie,
      ),
    );

    expect(attached.status).toBe(201);
    const body = (await attached.json()) as {
      evidence: { source: { reliability: string; url: string } }[];
      hypothesis: { status: string; confidence: string };
    };
    expect(body.evidence[0]?.source.reliability).toBe('HIGH');
    expect(body.hypothesis.status).not.toBe('DRAFT');
  });

  it('rejects evidence pointing at a private host', async () => {
    const cookie = await harness.signIn('s-lindqvist');
    const response = await harness.request(
      `/api/hypotheses/${hypothesisId}/evidence`,
      postJson(
        {
          stance: 'SUPPORTS',
          claim: 'An internal document that should never be accepted as a public source.',
          strength: 3,
          newSource: {
            title: 'Internal metadata service',
            url: 'http://169.254.169.254/latest/meta-data',
            publisher: 'internal',
            sourceType: 'OTHER',
            publicationDate: null,
            authors: [],
          },
        },
        cookie,
      ),
    );
    // A structurally valid request carrying an unacceptable source is a 422,
    // not a 400: the shape was fine, the content was refused.
    expect(response.status).toBe(422);
  });

  it('refuses evidence that names both an existing and a new source', async () => {
    const cookie = await harness.signIn('s-lindqvist');
    const response = await harness.request(
      `/api/hypotheses/${hypothesisId}/evidence`,
      postJson(
        {
          stance: 'SUPPORTS',
          claim: 'Ambiguous evidence request naming two sources at once.',
          sourceId: '11111111-1111-4111-8111-111111111111',
          newSource: {
            title: 'Some document',
            url: 'https://example.org/doc',
            publisher: 'Example',
            sourceType: 'OTHER',
            publicationDate: null,
            authors: [],
          },
        },
        cookie,
      ),
    );
    expect(response.status).toBe(400);
  });
});

describe('research actions', () => {
  it('requires authentication to spend compute', async () => {
    const response = await harness.request(
      '/api/research/run',
      postJson({
        action: 'FIND_EVIDENCE',
        question: 'What evidence bears on this claim?',
        hypothesisId,
      }),
    );
    expect(response.status).toBe(401);
  });

  it('runs the full review pipeline and records every agent run', async () => {
    const cookie = await harness.signIn('m-okonkwo');
    const response = await harness.request(
      '/api/research/run',
      postJson(
        {
          action: 'FULL_REVIEW',
          question:
            'Could this intervention significantly reduce the outcome the problem measures?',
          hypothesisId,
        },
        cookie,
      ),
    );

    expect(response.status).toBe(201);
    const { session } = (await response.json()) as {
      session: {
        status: string;
        runs: { agentRole: string; status: string; findings: { sources: { id: string }[] }[] }[];
        brief: { sections: { heading: string }[]; disclaimer: string } | null;
      };
    };

    expect(session.runs.map((run) => run.agentRole)).toEqual([
      'RESEARCHER',
      'SKEPTIC',
      'ENGINEER',
      'SYNTHESIZER',
    ]);
    expect(session.runs.every((run) => run.status === 'SUCCEEDED')).toBe(true);
    expect(session.brief?.sections.length).toBeGreaterThan(0);
    expect(session.brief?.disclaimer).toMatch(/nothing in it is established fact/i);
  });

  it('refuses a run that targets nothing', async () => {
    const cookie = await harness.signIn('m-okonkwo');
    const response = await harness.request(
      '/api/research/run',
      postJson({ action: 'FIND_EVIDENCE', question: 'A question with no target at all.' }, cookie),
    );
    expect(response.status).toBe(400);
  });

  it('rate-limits agent runs more strictly than ordinary writes', async () => {
    const cookie = await harness.signIn('nordwind');
    let limited = false;
    for (let index = 0; index < 15; index += 1) {
      const response = await harness.request(
        '/api/research/run',
        postJson(
          {
            action: 'FIND_EVIDENCE',
            question: `Retrieval probe number ${index} for rate limiting.`,
            hypothesisId,
          },
          cookie,
        ),
      );
      if (response.status === 429) {
        limited = true;
        break;
      }
    }
    expect(limited).toBe(true);
  }, 120_000);
});

describe('leaderboard and profiles', () => {
  it('ranks by reputation and exposes the underlying counts', async () => {
    const data = await harness.json<{
      entries: { rank: number; reputation: number }[];
      topProblems: unknown[];
      breakthroughs: { decision: string }[];
    }>('/api/leaderboard?scope=global&limit=10');

    expect(data.entries.length).toBeGreaterThan(0);
    expect(data.entries[0]!.rank).toBe(1);
    for (let index = 1; index < data.entries.length; index += 1) {
      expect(data.entries[index]!.reputation).toBeLessThanOrEqual(
        data.entries[index - 1]!.reputation,
      );
    }
    expect(data.topProblems.length).toBeGreaterThan(0);
  });

  it('serves a researcher profile with an auditable history', async () => {
    const { profile } = await harness.json<{
      profile: {
        handle: string;
        history: { delta: number; reason: string }[];
        stats: { contributions: number };
      };
    }>('/api/researchers/m-okonkwo');

    expect(profile.handle).toBe('m-okonkwo');
    expect(profile.stats.contributions).toBeGreaterThan(0);
    expect(profile.history.length).toBeGreaterThan(0);
    for (const event of profile.history) {
      expect(event.reason.length).toBeGreaterThan(0);
    }
  });

  it('404s for an unknown researcher', async () => {
    expect((await harness.request('/api/researchers/not-a-researcher')).status).toBe(404);
  });
});

describe('ingestion', () => {
  it('exposes the connectors and their host allowlists', async () => {
    const { connectors } = await harness.json<{
      connectors: { name: string; allowedHosts: string[] }[];
    }>('/api/ingestion/connectors');
    expect(connectors.length).toBeGreaterThan(0);
    for (const connector of connectors) {
      expect(connector.allowedHosts.length).toBeGreaterThan(0);
    }
  });

  it('never auto-publishes: the queue is the only output', async () => {
    const { candidates } = await harness.json<{ candidates: { status: string }[] }>(
      '/api/ingestion/candidates',
    );
    for (const candidate of candidates) {
      expect(candidate.status).not.toBe('PUBLISHED');
    }
  });

  it('reports what each cycle fetched and what it threw out', async () => {
    const { runs } = await harness.json<{ runs: { connector: string; fetched: number }[] }>(
      '/api/ingestion/runs',
    );
    expect(Array.isArray(runs)).toBe(true);

    const { documents } = await harness.json<{ documents: unknown[] }>('/api/ingestion/rejected');
    expect(Array.isArray(documents)).toBe(true);
  });
});

/**
 * Publishing from the queue.
 *
 * This is the only path from the automated half of the platform to the public
 * board, so the tests here are about what it refuses: an unapproved candidate,
 * a statement that fails the checklist, and a second attempt at something
 * already published.
 */
describe('publishing a problem from a candidate', () => {
  beforeAll(async () => {
    // The offline connectors, so the queue has something in it. Same pipeline
    // the live connectors go through; only the fetch step differs.
    await runIngestion({
      db: harness.db,
      connectors: resolveConnectors(harness.db, {}),
      trigger: 'SEED',
    });
  }, 60_000);

  const statement = {
    title: 'Night-time heat in Mediterranean cities is not covered by cooling-centre policy',
    summary:
      'Cooling centres close at night, when heat-related mortality in Mediterranean cities peaks.',
    description:
      'Heat-related mortality in southern European cities concentrates in the hours after midnight, when indoor temperatures in poorly insulated housing stay above outdoor temperatures. Municipal cooling-centre programmes in Barcelona, Athens and Naples operate during daytime hours only. The share of excess deaths occurring at night has been measured at over half in several city-level studies, but no evaluation exists of whether extending cooling-centre hours changes that share, and the cost of night operation has not been separated from the cost of daytime operation in any published programme budget.',
    whyItMatters: [
      {
        text: 'Around 70000 excess deaths were attributed to the 2003 European heatwave, concentrated in urban areas at night.',
        kind: 'SOURCE_CLAIM' as const,
      },
    ],
    currentKnowledge: [],
    constraints: {
      budget: 'Municipal budgets, typically under 2 MEUR per city per season.',
      time: 'Must be in place before the 2027 summer season.',
      geography: 'Mediterranean cities above 300000 inhabitants.',
      technology: null,
      political: null,
    },
    successCriteria: [
      {
        metric: 'Share of heat-related excess deaths occurring between 22:00 and 06:00',
        target: 'Reduced by 20%',
        horizon: '2030',
        measurement: 'City mortality registries',
      },
    ],
    openQuestions: [
      'Does extending cooling-centre hours change night-time mortality at all?',
      'What share of the affected population can physically reach a centre at night?',
    ],
    geographyLabel: 'Mediterranean cities',
    geographyScale: 'REGIONAL' as const,
    countryCode: null,
    difficulty: 6,
    urgency: 8,
    domains: ['health', 'cities'],
  };

  async function pendingCandidate(): Promise<{ id: string; sourceIds: string[] }> {
    const { candidates } = await harness.json<{
      candidates: { id: string; status: string; sources: { id: string }[] }[];
    }>('/api/ingestion/candidates');
    const candidate = candidates.find((entry) => entry.status === 'PENDING_CURATION');
    if (!candidate) throw new Error('The seed produced no pending candidate');
    return { id: candidate.id, sourceIds: candidate.sources.map((source) => source.id) };
  }

  it('refuses to publish a candidate no curator has approved', async () => {
    const cookie = await harness.signIn('m-okonkwo');
    const candidate = await pendingCandidate();

    const response = await harness.request(
      '/api/problems',
      postJson({ ...statement, candidateId: candidate.id, sourceIds: candidate.sourceIds }, cookie),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: 'FORBIDDEN' } });
  });

  it('refuses a statement that fails the publication checklist', async () => {
    const cookie = await harness.signIn('m-okonkwo');
    const candidate = await pendingCandidate();

    await harness.request(
      `/api/ingestion/candidates/${candidate.id}/curate`,
      postJson({ decision: 'APPROVE', note: null }, cookie),
    );

    const response = await harness.request(
      '/api/problems',
      postJson(
        {
          ...statement,
          candidateId: candidate.id,
          sourceIds: candidate.sourceIds,
          // No magnitude anywhere, and no measurable criterion.
          whyItMatters: [{ text: 'This is bad for people in cities.', kind: 'SOURCE_CLAIM' }],
          successCriteria: [{ metric: 'Things improve', target: 'a lot', horizon: 'soon' }],
        },
        cookie,
      ),
    );

    expect(response.status).toBe(422);
    const payload = (await response.json()) as { error: { details?: string[] } };
    expect(payload.error.details?.join(' ')).toContain('quantified');
  });

  it('publishes an approved candidate that passes, once and only once', async () => {
    const cookie = await harness.signIn('m-okonkwo');
    const candidate = await pendingCandidate();

    await harness.request(
      `/api/ingestion/candidates/${candidate.id}/curate`,
      postJson({ decision: 'APPROVE', note: 'Corroborated against the EEA assessment.' }, cookie),
    );

    const body = {
      ...statement,
      candidateId: candidate.id,
      sourceIds: candidate.sourceIds,
      whyItMatters: statement.whyItMatters.map((item) => ({
        ...item,
        sourceIds: candidate.sourceIds,
      })),
      // The checklist wants three distinct sources, at least one of high
      // reliability. The candidate brought one; corroborating it is part of
      // publishing it.
      newSources: [
        {
          title: 'Heat-related mortality in Europe during the summer of 2022',
          url: 'https://www.nature.com/articles/s41591-023-02419-z',
          publisher: 'Nature Medicine',
          sourceType: 'SCIENTIFIC_PAPER',
          publicationDate: '2023-07-10',
        },
        {
          title: 'Climate change: Heat and health',
          url: 'https://www.who.int/news-room/fact-sheets/detail/climate-change-heat-and-health',
          publisher: 'World Health Organization',
          sourceType: 'INSTITUTION',
          publicationDate: '2024-05-28',
        },
      ],
    };

    const response = await harness.request('/api/problems', postJson(body, cookie));
    expect(response.status).toBe(201);

    const published = (await response.json()) as { slug: string; ref: string };
    expect(published.slug.length).toBeGreaterThan(0);

    const detail = await harness.json<{ problem: { origin: string; title: string } }>(
      `/api/problems/${published.slug}`,
    );
    expect(detail.problem.origin).toBe('INGESTED');
    expect(detail.problem.title).toBe(statement.title);

    // The candidate is spent: a second attempt must not create a twin.
    const again = await harness.request('/api/problems', postJson(body, cookie));
    expect(again.status).toBe(409);
  });

  it('refuses an anonymous publisher', async () => {
    const response = await harness.request('/api/problems', postJson(statement));
    expect(response.status).toBe(401);
  });
});
