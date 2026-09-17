import { randomUUID } from 'node:crypto';
import {
  AppError,
  awardFor,
  nextTrust,
  reputationDeltaFor,
  sanitizeUntrusted,
  scoreContribution,
  type ContributionKind,
  type ContributionSignals,
  type CreateContributionInput,
} from '@saveus/common';
import { json, type Db } from '@saveus/db';
import { loadSources, toAuthor, type AuthorDto, type SourceDto } from './serializers.js';
import { audit } from './hypotheses.js';
import { findOrCreateSource } from './sources.js';

/**
 * Contributions: the discussion layer, typed.
 *
 * A contribution is never a free-floating post. It has a kind, a target, a
 * problem, and a quality score derived from observable properties of the
 * contribution itself - which is what stops volume from being the path to
 * standing.
 */

export interface ContributionDto {
  id: string;
  kind: ContributionKind;
  targetType: string;
  targetId: string;
  problemId: string;
  body: string;
  score: number;
  signals: Record<string, number>;
  origin: string;
  createdAt: string;
  author: AuthorDto;
  sources: SourceDto[];
  endorsements: number;
  replies: { id: string; body: string; createdAt: string; author: AuthorDto }[];
}

export async function listContributions(
  db: Db,
  targetType: 'PROBLEM' | 'HYPOTHESIS' | 'EVIDENCE',
  targetId: string,
): Promise<ContributionDto[]> {
  const rows = await db
    .selectFrom('contributions as c')
    .innerJoin('users as u', 'u.id', 'c.author_id')
    .where('c.target_type', '=', targetType)
    .where('c.target_id', '=', targetId)
    .where('c.status', '=', 'ACTIVE')
    .selectAll('c')
    .select([
      'u.id as user_id',
      'u.handle',
      'u.display_name',
      'u.reputation',
      'u.is_anonymous',
      'u.origin as user_origin',
    ])
    .orderBy('c.created_at', 'asc')
    .execute();

  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);

  const [comments, endorsements, sources] = await Promise.all([
    db
      .selectFrom('comments as cm')
      .innerJoin('users as u', 'u.id', 'cm.author_id')
      .where('cm.contribution_id', 'in', ids)
      .select([
        'cm.id',
        'cm.contribution_id',
        'cm.body',
        'cm.created_at',
        'u.id as user_id',
        'u.handle',
        'u.display_name',
        'u.reputation',
        'u.is_anonymous',
        'u.origin as user_origin',
      ])
      .orderBy('cm.created_at', 'asc')
      .execute(),
    db
      .selectFrom('endorsements')
      .where('contribution_id', 'in', ids)
      .select(['contribution_id'])
      .execute(),
    loadSources(
      db,
      rows.flatMap((row) => row.source_ids),
    ),
  ]);

  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const endorsementCount = new Map<string, number>();
  for (const row of endorsements) {
    endorsementCount.set(row.contribution_id, (endorsementCount.get(row.contribution_id) ?? 0) + 1);
  }

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    targetType: row.target_type,
    targetId: row.target_id,
    problemId: row.problem_id,
    body: row.body,
    score: row.score,
    signals: row.signals,
    origin: row.origin,
    createdAt: row.created_at.toISOString(),
    author: toAuthor({
      id: row.user_id,
      handle: row.handle,
      display_name: row.display_name,
      reputation: row.reputation,
      is_anonymous: row.is_anonymous,
      origin: row.user_origin,
    }),
    sources: row.source_ids
      .map((id) => sourceById.get(id))
      .filter((source): source is SourceDto => Boolean(source)),
    endorsements: endorsementCount.get(row.id) ?? 0,
    replies: comments
      .filter((comment) => comment.contribution_id === row.id)
      .map((comment) => ({
        id: comment.id,
        body: comment.body,
        createdAt: comment.created_at.toISOString(),
        author: toAuthor({
          id: comment.user_id,
          handle: comment.handle,
          display_name: comment.display_name,
          reputation: comment.reputation,
          is_anonymous: comment.is_anonymous,
          origin: comment.user_origin,
        }),
      })),
  }));
}

export interface CreateContributionResult {
  contribution: ContributionDto;
  score: number;
  reputationDelta: number;
  newReputation: number;
}

export async function createContribution(
  db: Db,
  author: { id: string; trust: number },
  input: CreateContributionInput,
): Promise<CreateContributionResult> {
  const problemId = await resolveProblemId(db, input.targetType, input.targetId);

  const sanitized = sanitizeUntrusted(input.body, 8000);
  if (sanitized.text.trim().length < 20) {
    throw AppError.validation('A contribution needs at least 20 characters of substance');
  }

  const sourceIds = [...input.sourceIds];
  for (const raw of input.newSources) {
    const source = await findOrCreateSource(
      db,
      {
        title: raw.title,
        url: raw.url,
        publisher: raw.publisher,
        publicationDate: raw.publicationDate,
        authors: raw.authors,
        sourceType: raw.sourceType,
      },
      { addedById: author.id },
    );
    sourceIds.push(source.id);
  }

  const priorCount = await countPriorContributions(db, author.id, problemId);
  const signals = await deriveSignals(db, {
    kind: input.kind,
    body: sanitized.text,
    sourceIds,
    targetType: input.targetType,
    targetId: input.targetId,
    priorCount,
  });

  const score = scoreContribution(signals);
  const reputationDelta = reputationDeltaFor({
    kind: input.kind,
    signals,
    priorContributionsOnTarget: priorCount,
    authorTrust: author.trust,
  });

  const id = randomUUID();
  await db
    .insertInto('contributions')
    .values({
      id,
      kind: input.kind,
      target_type: input.targetType,
      target_id: input.targetId,
      problem_id: problemId,
      author_id: author.id,
      body: sanitized.text,
      source_ids: sourceIds,
      score,
      signals: json(signals),
      status: 'ACTIVE',
      origin: 'HUMAN',
    })
    .execute();

  await db
    .insertInto('reputation_events')
    .values({
      user_id: author.id,
      kind: 'CONTRIBUTION_SCORED',
      delta: reputationDelta,
      reason: `${input.kind} scored ${score.toFixed(1)}/100${
        priorCount > 0 ? ` (damped: ${priorCount} prior contribution(s) on this problem)` : ''
      }`,
      problem_id: problemId,
      contribution_id: id,
    })
    .execute();

  if (input.kind === 'EVIDENCE' && sourceIds.length > 0) {
    await db
      .insertInto('reputation_events')
      .values({
        user_id: author.id,
        kind: 'EVIDENCE_ACCEPTED',
        delta: awardFor('EVIDENCE_ACCEPTED'),
        reason: 'Evidence added to the research record',
        problem_id: problemId,
        contribution_id: id,
      })
      .execute();
  }

  const updated = await applyReputation(db, author.id, score);
  await audit(db, author.id, 'contribution.create', input.targetType, input.targetId, {
    kind: input.kind,
    score,
    reputationDelta,
    flags: sanitized.flags,
  });

  const all = await listContributions(db, input.targetType, input.targetId);
  const contribution = all.find((entry) => entry.id === id);
  if (!contribution)
    throw new AppError('INTERNAL', 'Contribution was written but could not be read back');

  return {
    contribution,
    score,
    reputationDelta:
      reputationDelta +
      (input.kind === 'EVIDENCE' && sourceIds.length > 0 ? awardFor('EVIDENCE_ACCEPTED') : 0),
    newReputation: updated,
  };
}

export async function endorseContribution(
  db: Db,
  userId: string,
  contributionId: string,
): Promise<{ endorsements: number }> {
  const contribution = await db
    .selectFrom('contributions')
    .where('id', '=', contributionId)
    .select(['author_id', 'problem_id', 'kind'])
    .executeTakeFirst();
  if (!contribution) throw AppError.notFound('Contribution');
  if (contribution.author_id === userId) {
    throw AppError.forbidden('You cannot endorse your own contribution');
  }

  const inserted = await db
    .insertInto('endorsements')
    .values({ contribution_id: contributionId, user_id: userId, kind: 'USEFUL' })
    .onConflict((oc) => oc.doNothing())
    .executeTakeFirst();

  if ((inserted.numInsertedOrUpdatedRows ?? 0n) > 0n) {
    await db
      .insertInto('reputation_events')
      .values({
        user_id: contribution.author_id,
        kind: contribution.kind === 'COUNTERARGUMENT' ? 'COUNTERARGUMENT_UPHELD' : 'PEER_ASSIST',
        delta: awardFor(
          contribution.kind === 'COUNTERARGUMENT' ? 'COUNTERARGUMENT_UPHELD' : 'PEER_ASSIST',
        ),
        reason: 'Another researcher marked this contribution as useful',
        problem_id: contribution.problem_id,
        contribution_id: contributionId,
      })
      .execute();
    await applyReputation(db, contribution.author_id, 70);
  }

  const count = await db
    .selectFrom('endorsements')
    .where('contribution_id', '=', contributionId)
    .select((eb) => eb.fn.countAll<string>().as('count'))
    .executeTakeFirst();

  return { endorsements: Number(count?.count ?? 0) };
}

async function applyReputation(db: Db, userId: string, qualityScore: number): Promise<number> {
  const events = await db
    .selectFrom('reputation_events')
    .where('user_id', '=', userId)
    .select((eb) => eb.fn.sum<string>('delta').as('total'))
    .executeTakeFirst();

  const current = await db
    .selectFrom('users')
    .where('id', '=', userId)
    .select('trust')
    .executeTakeFirstOrThrow();

  const reputation = Number(events?.total ?? 0);
  await db
    .updateTable('users')
    .set({
      reputation,
      trust: nextTrust({ currentTrust: current.trust, qualityScore, flagged: false }),
    })
    .where('id', '=', userId)
    .execute();

  return reputation;
}

async function resolveProblemId(
  db: Db,
  targetType: CreateContributionInput['targetType'],
  targetId: string,
): Promise<string> {
  if (targetType === 'PROBLEM') {
    const row = await db
      .selectFrom('problems')
      .where('id', '=', targetId)
      .select('id')
      .executeTakeFirst();
    if (!row) throw AppError.notFound('Problem');
    return row.id;
  }
  if (targetType === 'HYPOTHESIS') {
    const row = await db
      .selectFrom('hypotheses')
      .where('id', '=', targetId)
      .select('problem_id')
      .executeTakeFirst();
    if (!row) throw AppError.notFound('Hypothesis');
    return row.problem_id;
  }
  const row = await db
    .selectFrom('hypothesis_evidence as e')
    .innerJoin('hypotheses as h', 'h.id', 'e.hypothesis_id')
    .where('e.id', '=', targetId)
    .select('h.problem_id')
    .executeTakeFirst();
  if (!row) throw AppError.notFound('Evidence');
  return row.problem_id;
}

async function countPriorContributions(db: Db, userId: string, problemId: string): Promise<number> {
  const row = await db
    .selectFrom('contributions')
    .where('author_id', '=', userId)
    .where('problem_id', '=', problemId)
    .select((eb) => eb.fn.countAll<string>().as('count'))
    .executeTakeFirst();
  return Number(row?.count ?? 0);
}

/**
 * Heuristic signal derivation.
 *
 * Deliberately modular and deliberately crude: these are observable properties
 * of the contribution and its context, not a judgement of its content. When a
 * better model exists it replaces this function and nothing else.
 */
async function deriveSignals(
  db: Db,
  input: {
    kind: ContributionKind;
    body: string;
    sourceIds: string[];
    targetType: string;
    targetId: string;
    priorCount: number;
  },
): Promise<ContributionSignals> {
  const words = input.body.trim().split(/\s+/).length;
  const lengthQuality = Math.min(1, Math.max(0, (words - 15) / 160));

  const sources =
    input.sourceIds.length > 0
      ? await db
          .selectFrom('sources')
          .where('id', 'in', input.sourceIds)
          .select('reliability')
          .execute()
      : [];
  const reliabilityScore =
    sources.length === 0
      ? 0
      : sources.reduce(
          (total, source) =>
            total +
            (source.reliability === 'HIGH' ? 1 : source.reliability === 'MEDIUM' ? 0.6 : 0.25),
          0,
        ) / sources.length;

  // Novelty: does this thread already contain sources this contribution brings?
  const existing = await db
    .selectFrom('contributions')
    .where('target_type', '=', input.targetType as never)
    .where('target_id', '=', input.targetId)
    .select('source_ids')
    .execute();
  const seen = new Set(existing.flatMap((row) => row.source_ids));
  const newSources = input.sourceIds.filter((id) => !seen.has(id)).length;
  const novelty =
    input.sourceIds.length > 0 ? newSources / input.sourceIds.length : Math.min(0.6, lengthQuality);

  const mentionsMethod =
    /\b(sample|control|pre-?regist|measure|protocol|randomi|baseline|replicat)/i.test(input.body);
  const mentionsQuantity = /\d/.test(input.body);

  return {
    relevance: Math.min(1, 0.45 + lengthQuality * 0.4 + (input.sourceIds.length > 0 ? 0.15 : 0)),
    novelty: Math.min(1, novelty * 0.7 + (input.priorCount === 0 ? 0.2 : 0)),
    evidenceQuality: Math.min(1, reliabilityScore * 0.85 + (mentionsQuantity ? 0.15 : 0)),
    reproducibility: mentionsMethod ? Math.min(1, 0.5 + lengthQuality * 0.5) : lengthQuality * 0.3,
    // Starts at zero: the community has not seen it yet. Endorsements raise it
    // through reputation events rather than by rewriting the original score.
    communityValidation: 0,
    downstreamImpact:
      input.kind === 'COUNTERARGUMENT' || input.kind === 'MODIFICATION'
        ? Math.min(1, 0.35 + lengthQuality * 0.4)
        : input.kind === 'RESULT' || input.kind === 'EXPERIMENT'
          ? Math.min(1, 0.4 + lengthQuality * 0.4)
          : lengthQuality * 0.3,
  };
}
