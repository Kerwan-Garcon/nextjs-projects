import { randomUUID } from 'node:crypto';
import {
  AGENT_LIST,
  KIND_MULTIPLIER,
  VALIDATION_CRITERIA,
  awardFor,
  deriveStatusFromEvidence,
  normalizeSource,
  nextTrust,
  reputationDeltaFor,
  scoreContribution,
  type ContributionKind,
  type ContributionSignals,
  type DomainKey,
  type Reliability,
} from '@saveus/common';
import type { Insertable } from 'kysely';
import type { Db } from '../client.js';
import type { SourcesTable } from '../schema.js';
import { json } from '../json.js';
import { DOMAIN_REFERENCE } from './domains.js';
import { SEED_SOURCES } from './sources.js';
import { SEED_PROBLEMS } from './problems.js';
import { SEED_HYPOTHESES } from './hypotheses.js';
import { SEED_USERS } from './users.js';
import { renderContribution, type ContributionContext } from './contributions.js';

/**
 * Seed loader.
 *
 * Produces a database the application is immediately usable against: 20 real
 * problems, a source library of real publications, 50 structured hypotheses,
 * a discussion layer, agent runs, reputation history and an ingestion queue.
 *
 * Everything that is synthetic is stored with origin = DEMO_SEED, which is what
 * the interface reads to put a DEMO DATA marker on it. The source records are
 * the exception: those are real publications and are marked as such.
 */

export interface SeedSummary {
  domains: number;
  users: number;
  sources: number;
  problems: number;
  hypotheses: number;
  evidence: number;
  contributions: number;
  comments: number;
  agentRuns: number;
  findings: number;
  reputationEvents: number;
  validations: number;
  candidates: number;
}

/** Deterministic PRNG so a reseed produces the same database. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED_EPOCH = Date.UTC(2026, 1, 2, 9, 0, 0);
const DAY = 24 * 60 * 60 * 1000;

function daysAgo(days: number, hours = 0): Date {
  return new Date(SEED_EPOCH - days * DAY + hours * 60 * 60 * 1000);
}

const CONTRIBUTION_MIX: ContributionKind[] = [
  'COMMENT',
  'EVIDENCE',
  'COUNTERARGUMENT',
  'QUESTION',
  'COMMENT',
  'MODIFICATION',
  'EVIDENCE',
  'COUNTERARGUMENT',
  'EXPERIMENT',
  'RESULT',
];

export async function seed(db: Db): Promise<SeedSummary> {
  const random = mulberry32(20260202);
  const summary: SeedSummary = {
    domains: 0,
    users: 0,
    sources: 0,
    problems: 0,
    hypotheses: 0,
    evidence: 0,
    contributions: 0,
    comments: 0,
    agentRuns: 0,
    findings: 0,
    reputationEvents: 0,
    validations: 0,
    candidates: 0,
  };

  // ---------------------------------------------------------------- domains
  await db
    .insertInto('domains')
    .values(
      DOMAIN_REFERENCE.map((domain, index) => ({
        key: domain.key,
        label: domain.label,
        description: domain.description,
        accent: domain.accent,
        sort_order: index,
      })),
    )
    .execute();
  summary.domains = DOMAIN_REFERENCE.length;

  // ----------------------------------------------------------------- agents
  // Agent rows mirror the registry in @saveus/common: the database records the
  // permissions each agent actually holds, so an agent run can be audited
  // against what that agent was allowed to do.
  await db
    .insertInto('agents')
    .values(
      AGENT_LIST.map((agent) => ({
        role: agent.role,
        name: agent.name,
        mission: agent.mission,
        description: agent.description,
        tools: [...agent.tools],
        permissions: json(agent.permissions),
        enabled: true,
      })),
    )
    .execute();

  // ------------------------------------------------------------------ users
  const userIds = new Map<string, string>();
  const userRows = SEED_USERS.map((user) => {
    const id = randomUUID();
    userIds.set(user.handle, id);
    return {
      id,
      handle: user.handle,
      display_name: user.displayName,
      bio: user.bio,
      reputation: 0,
      trust: 0.5,
      is_anonymous: user.isAnonymous,
      origin: 'DEMO_SEED' as const,
      created_at: daysAgo(340 - Math.floor(random() * 120)),
    };
  });
  await db.insertInto('users').values(userRows).execute();
  await db
    .insertInto('user_domains')
    .values(
      SEED_USERS.flatMap((user) =>
        user.domains.map((domain) => ({
          user_id: userIds.get(user.handle) as string,
          domain_key: domain,
          weight: 0,
        })),
      ),
    )
    .execute();
  summary.users = userRows.length;

  const userIdByIndex = (index: number): string =>
    userIds.get(
      (SEED_USERS[index % SEED_USERS.length] as (typeof SEED_USERS)[number]).handle,
    ) as string;

  // ---------------------------------------------------------------- sources
  const sourceIds = new Map<string, string>();
  const sourceReliability = new Map<string, Reliability>();
  const sourceTitles = new Map<string, { title: string; publisher: string }>();
  const sourceRows: Insertable<SourcesTable>[] = [];

  for (const source of SEED_SOURCES) {
    const normalized = normalizeSource({
      title: source.title,
      url: source.url,
      publisher: source.publisher,
      publicationDate: source.publicationDate,
      authors: source.authors,
      sourceType: source.sourceType,
    });
    if (!normalized.ok) {
      throw new Error(
        `Seed source "${source.key}" failed normalisation: ${normalized.reason} ${normalized.detail}`,
      );
    }
    const id = randomUUID();
    sourceIds.set(source.key, id);
    sourceReliability.set(source.key, normalized.source.reliability);
    sourceTitles.set(source.key, {
      title: normalized.source.title,
      publisher: normalized.source.publisher,
    });
    sourceRows.push({
      id,
      title: normalized.source.title,
      authors: normalized.source.authors,
      publisher: normalized.source.publisher,
      publication_date: normalized.source.publicationDate,
      url: normalized.source.url,
      canonical_url: normalized.source.canonicalUrl,
      source_type: source.sourceType,
      domain: normalized.source.domain,
      reliability: normalized.source.reliability,
      reliability_note: normalized.source.reliabilityNote,
      content_hash: normalized.source.contentHash,
      // Real publications, catalogued for the demo corpus - not synthetic records.
      origin: 'INGESTED' as const,
      retrieved_at: daysAgo(200),
      created_at: daysAgo(200),
      flags: normalized.source.flags,
    });
  }
  await db.insertInto('sources').values(sourceRows).execute();
  summary.sources = sourceRows.length;

  // --------------------------------------------------------------- problems
  const problemIds = new Map<string, string>();
  for (const [index, problem] of SEED_PROBLEMS.entries()) {
    const id = randomUUID();
    problemIds.set(problem.key, id);

    const resolveStatements = (statements: typeof problem.whyItMatters) =>
      statements.map((statement) => ({
        text: statement.text,
        kind: statement.kind,
        sourceIds: statement.sourceKeys
          .map((key) => sourceIds.get(key))
          .filter((value): value is string => Boolean(value)),
        note: statement.note ?? null,
      }));

    await db
      .insertInto('problems')
      .values({
        id,
        ref: problem.ref,
        slug: problem.slug,
        title: problem.title,
        summary: problem.summary,
        description: problem.description,
        why_it_matters: json(resolveStatements(problem.whyItMatters)),
        constraints: json(problem.constraints),
        success_criteria: json(problem.successCriteria),
        current_knowledge: json(resolveStatements(problem.currentKnowledge)),
        open_questions: problem.openQuestions,
        geography_label: problem.geographyLabel,
        geography_scale: problem.geographyScale,
        country_code: problem.countryCode,
        difficulty: problem.difficulty,
        urgency: problem.urgency,
        status: problem.status,
        origin: 'DEMO_SEED',
        published_by_id: userIds.get('curator-01') ?? null,
        created_at: daysAgo(300 - index * 6),
        updated_at: daysAgo(30 - (index % 20)),
      })
      .execute();

    await db
      .insertInto('problem_domains')
      .values(
        problem.domains.map((domain, domainIndex) => ({
          problem_id: id,
          domain_key: domain as DomainKey,
          is_primary: domainIndex === 0,
        })),
      )
      .execute();

    await db
      .insertInto('problem_sources')
      .values(
        problem.sourceKeys
          .map((key) => sourceIds.get(key))
          .filter((value): value is string => Boolean(value))
          .map((sourceId) => ({
            id: randomUUID(),
            problem_id: id,
            source_id: sourceId,
            role: 'EVIDENCE',
            note: null,
            added_by_id: userIds.get('curator-01') ?? null,
            created_at: daysAgo(300 - index * 6),
          })),
      )
      .execute();
  }
  summary.problems = SEED_PROBLEMS.length;

  // ------------------------------------------------------------- hypotheses
  const hypothesisIds = new Map<string, string>();
  const reputationEvents: {
    id: string;
    user_id: string;
    kind:
      | 'CONTRIBUTION_SCORED'
      | 'EVIDENCE_ACCEPTED'
      | 'COUNTERARGUMENT_UPHELD'
      | 'VALIDATED_CONTRIBUTION'
      | 'HYPOTHESIS_IMPROVED'
      | 'ERROR_FOUND'
      | 'PEER_ASSIST';
    delta: number;
    reason: string;
    problem_id: string | null;
    contribution_id: string | null;
    created_at: Date;
  }[] = [];

  for (const [index, hypothesis] of SEED_HYPOTHESES.entries()) {
    const problemId = problemIds.get(hypothesis.problemKey);
    if (!problemId) throw new Error(`Hypothesis ${hypothesis.key} references unknown problem`);

    const id = randomUUID();
    hypothesisIds.set(hypothesis.key, id);
    const createdAt = daysAgo(220 - index * 3);

    await db
      .insertInto('hypotheses')
      .values({
        id,
        ref: hypothesis.ref,
        problem_id: problemId,
        author_id: hypothesis.authorIndex === null ? null : userIdByIndex(hypothesis.authorIndex),
        author_agent_role: hypothesis.authorAgentRole,
        title: hypothesis.title,
        claim: hypothesis.claim,
        mechanism: hypothesis.mechanism,
        expected_impact: hypothesis.expectedImpact,
        assumptions: hypothesis.assumptions,
        unknowns: hypothesis.unknowns,
        risks: hypothesis.risks,
        estimated_cost: hypothesis.estimatedCost,
        estimated_scalability: hypothesis.estimatedScalability,
        validation_method: hypothesis.validationMethod,
        status: hypothesis.status,
        epistemic_kind: hypothesis.authorAgentRole ? 'AI_HYPOTHESIS' : 'HUMAN_HYPOTHESIS',
        origin: 'DEMO_SEED',
        created_at: createdAt,
        updated_at: daysAgo(20 - (index % 18)),
      })
      .execute();

    const evidenceRows = hypothesis.evidence
      .map((entry, evidenceIndex) => {
        const sourceId = sourceIds.get(entry.sourceKey);
        if (!sourceId) return null;
        return {
          id: randomUUID(),
          hypothesis_id: id,
          source_id: sourceId,
          stance: entry.stance,
          claim: entry.claim,
          epistemic_kind: 'SOURCE_CLAIM' as const,
          strength: entry.strength,
          added_by_id:
            hypothesis.authorIndex === null
              ? userIdByIndex(index + evidenceIndex)
              : userIdByIndex(hypothesis.authorIndex + evidenceIndex),
          added_by_run_id: null,
          note: null,
          origin: 'DEMO_SEED' as const,
          created_at: new Date(createdAt.getTime() + (evidenceIndex + 1) * DAY),
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    if (evidenceRows.length > 0) {
      await db.insertInto('hypothesis_evidence').values(evidenceRows).execute();
      summary.evidence += evidenceRows.length;
    }

    // Contributors: whoever attached evidence is a contributor to the record.
    const contributorIds = [...new Set(evidenceRows.map((row) => row.added_by_id))].filter(
      (contributorId) =>
        contributorId !==
        (hypothesis.authorIndex === null ? null : userIdByIndex(hypothesis.authorIndex)),
    );
    if (contributorIds.length > 0) {
      await db
        .insertInto('hypothesis_contributors')
        .values(
          contributorIds.map((userId) => ({
            hypothesis_id: id,
            user_id: userId,
            role: 'CONTRIBUTOR',
          })),
        )
        .onConflict((oc) => oc.doNothing())
        .execute();
    }

    for (const [evidenceIndex, row] of evidenceRows.entries()) {
      reputationEvents.push({
        id: randomUUID(),
        user_id: row.added_by_id,
        kind: 'EVIDENCE_ACCEPTED',
        delta: awardFor('EVIDENCE_ACCEPTED'),
        reason: `Evidence attached to hypothesis #${hypothesis.ref}`,
        problem_id: problemId,
        contribution_id: null,
        created_at: new Date(createdAt.getTime() + (evidenceIndex + 1) * DAY),
      });
    }
  }
  summary.hypotheses = SEED_HYPOTHESES.length;

  // ------------------------------------------------------------ validations
  const curatorId = userIds.get('curator-01') as string;
  for (const hypothesis of SEED_HYPOTHESES) {
    if (hypothesis.status !== 'VALIDATED' && hypothesis.status !== 'REJECTED') continue;
    const hypothesisId = hypothesisIds.get(hypothesis.key) as string;
    const validated = hypothesis.status === 'VALIDATED';

    await db
      .insertInto('validations')
      .values({
        id: randomUUID(),
        hypothesis_id: hypothesisId,
        decision: validated ? 'VALIDATED' : 'REJECTED',
        criteria: json(
          VALIDATION_CRITERIA.map((criterion) => ({
            criterion,
            met: validated,
            note: validated
              ? null
              : 'The evidence record contradicts the central claim; see the attached contradicting sources.',
          })),
        ),
        rationale: validated
          ? 'Every validation criterion is addressed by the record: the claim is falsifiable as stated, the mechanism is consistent with the cited evidence, contradicting evidence was searched for, and the method is reproducible by a third party.'
          : 'The central claim is contradicted by the attached evidence on a quantitative basis. The record is kept rather than deleted: a rejected hypothesis with a clear reason is a result.',
        decided_by_id: curatorId,
        decided_at: daysAgo(25),
        origin: 'DEMO_SEED',
      })
      .execute();
    summary.validations += 1;

    if (validated && hypothesis.authorIndex !== null) {
      reputationEvents.push({
        id: randomUUID(),
        user_id: userIdByIndex(hypothesis.authorIndex),
        kind: 'VALIDATED_CONTRIBUTION',
        delta: awardFor('VALIDATED_CONTRIBUTION'),
        reason: `Hypothesis #${hypothesis.ref} passed validation against explicit criteria`,
        problem_id: problemIds.get(hypothesis.problemKey) ?? null,
        contribution_id: null,
        created_at: daysAgo(25),
      });
    }
  }

  // ---------------------------------------------------------- contributions
  let contributionCounter = 0;
  const contributionsPerAuthorPerProblem = new Map<string, number>();
  const commentRows: {
    id: string;
    contribution_id: string;
    author_id: string;
    parent_id: null;
    body: string;
    origin: 'DEMO_SEED';
    created_at: Date;
  }[] = [];
  const endorsementRows: {
    contribution_id: string;
    user_id: string;
    kind: string;
    created_at: Date;
  }[] = [];

  for (const [hypothesisIndex, hypothesis] of SEED_HYPOTHESES.entries()) {
    const problem = SEED_PROBLEMS.find((entry) => entry.key === hypothesis.problemKey);
    if (!problem) continue;
    const problemId = problemIds.get(problem.key) as string;
    const hypothesisId = hypothesisIds.get(hypothesis.key) as string;

    const supporting = hypothesis.evidence.filter((entry) => entry.stance === 'SUPPORTS');
    const contradicting = hypothesis.evidence.filter((entry) => entry.stance === 'CONTRADICTS');
    const firstSupporting = supporting[0] ?? hypothesis.evidence[0];
    const supportingMeta = firstSupporting
      ? sourceTitles.get(firstSupporting.sourceKey)
      : undefined;
    const contradictingMeta = contradicting[0]
      ? sourceTitles.get(contradicting[0].sourceKey)
      : undefined;

    const constraintEntries = Object.entries(problem.constraints).filter(([, value]) =>
      Boolean(value),
    );
    const constraint = constraintEntries[
      hypothesisIndex % Math.max(1, constraintEntries.length)
    ] ?? ['time', 'Not stated'];

    const context: ContributionContext = {
      problemTitle: problem.title,
      geography: problem.geographyLabel,
      openQuestion: problem.openQuestions[0] ?? 'What remains unresolved here?',
      secondOpenQuestion:
        problem.openQuestions[1] ?? problem.openQuestions[0] ?? 'What remains unresolved here?',
      constraintDimension: constraint[0] as string,
      constraintText: (constraint[1] as string) ?? 'Not stated',
      hypothesisTitle: hypothesis.title,
      claim: hypothesis.claim,
      assumption: hypothesis.assumptions[0] ?? 'Not stated',
      unknown: hypothesis.unknowns[0] ?? 'The effect size is not stated.',
      risk: hypothesis.risks[0] ?? 'Not stated',
      validationMethod: hypothesis.validationMethod,
      supportingSourceTitle: supportingMeta?.title ?? 'the attached source',
      supportingPublisher: supportingMeta?.publisher ?? 'the publisher',
      contradictingSourceTitle: contradictingMeta?.title ?? null,
      supportingCount: supporting.length,
      contradictingCount: contradicting.length,
    };

    const count = 3 + Math.floor(random() * 3); // 3-5 per hypothesis
    for (let i = 0; i < count; i += 1) {
      const kind = CONTRIBUTION_MIX[
        (hypothesisIndex + i) % CONTRIBUTION_MIX.length
      ] as ContributionKind;
      const authorIndex = (hypothesisIndex * 3 + i * 7 + 1) % SEED_USERS.length;
      const authorId = userIdByIndex(authorIndex);
      const body = renderContribution(kind, hypothesisIndex + i, context);

      const volumeKey = `${authorId}:${problemId}`;
      const prior = contributionsPerAuthorPerProblem.get(volumeKey) ?? 0;
      contributionsPerAuthorPerProblem.set(volumeKey, prior + 1);

      const signals = deriveSeedSignals(kind, hypothesis.evidence.length, random);
      const score = scoreContribution(signals);
      const delta = reputationDeltaFor({
        kind,
        signals,
        priorContributionsOnTarget: prior,
        authorTrust: 0.5 + 0.3 * random(),
      });

      const contributionId = randomUUID();
      const createdAt = daysAgo(180 - hypothesisIndex * 3 - i, i * 3);

      await db
        .insertInto('contributions')
        .values({
          id: contributionId,
          kind,
          target_type: 'HYPOTHESIS',
          target_id: hypothesisId,
          problem_id: problemId,
          author_id: authorId,
          body,
          source_ids:
            kind === 'EVIDENCE' && firstSupporting
              ? [sourceIds.get(firstSupporting.sourceKey) as string]
              : [],
          score,
          signals: json(signals),
          status: 'ACTIVE',
          origin: 'DEMO_SEED',
          created_at: createdAt,
        })
        .execute();
      contributionCounter += 1;

      reputationEvents.push({
        id: randomUUID(),
        user_id: authorId,
        kind: 'CONTRIBUTION_SCORED',
        delta,
        reason: `${kind} on hypothesis #${hypothesis.ref} scored ${score.toFixed(1)}/100`,
        problem_id: problemId,
        contribution_id: contributionId,
        created_at: createdAt,
      });

      if (kind === 'COUNTERARGUMENT' && random() > 0.45) {
        reputationEvents.push({
          id: randomUUID(),
          user_id: authorId,
          kind: 'COUNTERARGUMENT_UPHELD',
          delta: awardFor('COUNTERARGUMENT_UPHELD'),
          reason: `Counterargument on hypothesis #${hypothesis.ref} was upheld and the claim was narrowed`,
          problem_id: problemId,
          contribution_id: contributionId,
          created_at: new Date(createdAt.getTime() + 2 * DAY),
        });
      }

      // A reply, on some threads, so discussion is threaded rather than flat.
      if (random() > 0.55) {
        const replyAuthor = userIdByIndex(authorIndex + 4);
        commentRows.push({
          id: randomUUID(),
          contribution_id: contributionId,
          author_id: replyAuthor,
          parent_id: null,
          body:
            kind === 'COUNTERARGUMENT'
              ? 'Accepted. I have narrowed the claim rather than defending the broad version - the narrow one is what the evidence actually supports.'
              : 'Agreed on the substance. The part I would still push on is whether this is measurable within the horizon the problem sets.',
          origin: 'DEMO_SEED',
          created_at: new Date(createdAt.getTime() + DAY),
        });
      }

      const endorsers = Math.floor(random() * 4);
      for (let e = 0; e < endorsers; e += 1) {
        const endorserId = userIdByIndex(authorIndex + e + 1);
        if (endorserId === authorId) continue;
        endorsementRows.push({
          contribution_id: contributionId,
          user_id: endorserId,
          kind: kind === 'COUNTERARGUMENT' ? 'CHANGED_MY_MIND' : 'USEFUL',
          created_at: new Date(createdAt.getTime() + DAY),
        });
      }
    }
  }

  // Problem-level contributions so the problem page has its own discussion.
  for (const [index, problem] of SEED_PROBLEMS.entries()) {
    const problemId = problemIds.get(problem.key) as string;
    for (let i = 0; i < 2; i += 1) {
      const authorIndex = (index * 5 + i * 3) % SEED_USERS.length;
      const authorId = userIdByIndex(authorIndex);
      const kind: ContributionKind = i === 0 ? 'QUESTION' : 'EVIDENCE';
      const body =
        i === 0
          ? `Scoping question on the problem itself rather than on a hypothesis: ${problem.openQuestions[0]} Several of the hypotheses below assume an answer to this without saying which answer they assume.`
          : `The problem statement lists ${problem.sourceKeys.length} sources. Worth noting what is missing: nothing here is specific to ${problem.geographyLabel} at the resolution the success criteria require. That gap should be visible on the problem page, not discovered per-hypothesis.`;

      const signals = deriveSeedSignals(kind, problem.sourceKeys.length, random);
      const score = scoreContribution(signals);
      const contributionId = randomUUID();
      const createdAt = daysAgo(240 - index * 5 - i);

      await db
        .insertInto('contributions')
        .values({
          id: contributionId,
          kind,
          target_type: 'PROBLEM',
          target_id: problemId,
          problem_id: problemId,
          author_id: authorId,
          body,
          source_ids: [],
          score,
          signals: json(signals),
          status: 'ACTIVE',
          origin: 'DEMO_SEED',
          created_at: createdAt,
        })
        .execute();
      contributionCounter += 1;

      reputationEvents.push({
        id: randomUUID(),
        user_id: authorId,
        kind: 'CONTRIBUTION_SCORED',
        delta: reputationDeltaFor({
          kind,
          signals,
          priorContributionsOnTarget: 0,
          authorTrust: 0.6,
        }),
        reason: `${kind} on problem #${problem.ref} scored ${score.toFixed(1)}/100`,
        problem_id: problemId,
        contribution_id: contributionId,
        created_at: createdAt,
      });
    }
  }

  summary.contributions = contributionCounter;

  if (commentRows.length > 0) {
    await db.insertInto('comments').values(commentRows).execute();
    summary.comments = commentRows.length;
  }
  if (endorsementRows.length > 0) {
    await db
      .insertInto('endorsements')
      .values(endorsementRows)
      .onConflict((oc) => oc.doNothing())
      .execute();
  }

  // ------------------------------------------------------- reputation state
  await db.insertInto('reputation_events').values(reputationEvents).execute();
  summary.reputationEvents = reputationEvents.length;

  const totals = new Map<string, number>();
  for (const event of reputationEvents) {
    totals.set(event.user_id, (totals.get(event.user_id) ?? 0) + event.delta);
  }
  for (const [userId, total] of totals) {
    const trust = nextTrust({ currentTrust: 0.5, qualityScore: 60, flagged: false });
    await db
      .updateTable('users')
      .set({ reputation: total, trust })
      .where('id', '=', userId)
      .execute();
  }

  // -------------------------------------------------------- hypothesis state
  // Statuses that the evidence record implies are applied by the same rule the
  // running application uses, so the seed cannot contain an impossible state.
  for (const hypothesis of SEED_HYPOTHESES) {
    const hypothesisId = hypothesisIds.get(hypothesis.key) as string;
    const evidence = hypothesis.evidence.map((entry) => ({
      stance: entry.stance,
      strength: entry.strength,
      reliability: sourceReliability.get(entry.sourceKey) ?? ('UNKNOWN' as Reliability),
    }));
    const derived = deriveStatusFromEvidence(hypothesis.status, evidence);
    if (derived !== hypothesis.status) {
      await db
        .updateTable('hypotheses')
        .set({ status: derived })
        .where('id', '=', hypothesisId)
        .execute();
    }
  }

  return summary;
}

function deriveSeedSignals(
  kind: ContributionKind,
  evidenceCount: number,
  random: () => number,
): ContributionSignals {
  const base = 0.35 + 0.45 * random();
  const evidenceBoost = Math.min(0.4, evidenceCount * 0.07);
  const kindWeight = KIND_MULTIPLIER[kind];

  return {
    relevance: clamp(base + 0.15),
    novelty: clamp(0.25 + 0.5 * random()),
    evidenceQuality: clamp(
      kind === 'EVIDENCE' ? base + evidenceBoost : base * 0.7 + evidenceBoost * 0.5,
    ),
    reproducibility: clamp(kind === 'EXPERIMENT' || kind === 'RESULT' ? base + 0.2 : base * 0.5),
    communityValidation: clamp(0.2 + 0.4 * random()),
    downstreamImpact: clamp((kindWeight - 0.5) * 0.6 + 0.25 * random()),
  };
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, Math.round(value * 100) / 100));
}
