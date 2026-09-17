import { randomUUID } from 'node:crypto';
import {
  AppError,
  CONFIDENCE_DESCRIPTORS,
  checkStatusChange,
  confidenceFromEvidence,
  deriveStatusFromEvidence,
  sanitizeUntrusted,
  type ConfidenceLevel,
  type CreateHypothesisInput,
  type EvidenceStance,
  type HypothesisStatus,
  type Reliability,
} from '@saveus/common';
import { json, type Db } from '@saveus/db';
import { loadSources, toAuthor, type AuthorDto, type SourceDto } from './serializers.js';
import { findOrCreateSource } from './sources.js';

/**
 * Hypotheses: the structured research object at the centre of the product.
 *
 * The rules that matter live here rather than in the route: status is derived
 * from the evidence record, validation-only statuses are unreachable by an
 * author, and evidence is always attached to a normalised source.
 */

export interface EvidenceDto {
  id: string;
  stance: EvidenceStance;
  claim: string;
  epistemicKind: string;
  strength: number;
  note: string | null;
  origin: string;
  createdAt: string;
  source: SourceDto;
  addedBy: AuthorDto | null;
  addedByRunId: string | null;
}

export interface HypothesisSummaryDto {
  id: string;
  ref: string;
  problemId: string;
  title: string;
  claim: string;
  status: HypothesisStatus;
  epistemicKind: string;
  origin: string;
  author: AuthorDto | null;
  authorAgentRole: string | null;
  supportingCount: number;
  contradictingCount: number;
  contributionCount: number;
  confidence: ConfidenceLevel;
  confidenceLabel: string;
  updatedAt: string;
}

export interface HypothesisDetailDto extends HypothesisSummaryDto {
  mechanism: string;
  expectedImpact: string;
  assumptions: string[];
  unknowns: string[];
  risks: string[];
  estimatedCost: string | null;
  estimatedScalability: string | null;
  validationMethod: string;
  createdAt: string;
  evidence: EvidenceDto[];
  contributors: AuthorDto[];
  validation: {
    decision: string;
    rationale: string;
    criteria: { criterion: string; met: boolean; note: string | null }[];
    decidedAt: string;
    decidedBy: AuthorDto | null;
  } | null;
  problem: { id: string; ref: string; slug: string; title: string; geographyLabel: string };
}

export async function listHypothesesForProblem(
  db: Db,
  problemId: string,
): Promise<HypothesisSummaryDto[]> {
  const rows = await db
    .selectFrom('hypotheses as h')
    .leftJoin('users as u', 'u.id', 'h.author_id')
    .where('h.problem_id', '=', problemId)
    .select([
      'h.id',
      'h.ref',
      'h.problem_id',
      'h.title',
      'h.claim',
      'h.status',
      'h.epistemic_kind',
      'h.origin',
      'h.author_agent_role',
      'h.updated_at',
      'u.id as user_id',
      'u.handle',
      'u.display_name',
      'u.reputation',
      'u.is_anonymous',
      'u.origin as user_origin',
    ])
    .orderBy('h.updated_at', 'desc')
    .execute();

  return Promise.all(rows.map((row) => toSummary(db, row)));
}

export async function getHypothesis(db: Db, id: string): Promise<HypothesisDetailDto> {
  const row = await db
    .selectFrom('hypotheses as h')
    .leftJoin('users as u', 'u.id', 'h.author_id')
    .where('h.id', '=', id)
    .selectAll('h')
    .select([
      'u.id as user_id',
      'u.handle',
      'u.display_name',
      'u.reputation',
      'u.is_anonymous',
      'u.origin as user_origin',
    ])
    .executeTakeFirst();

  if (!row) throw AppError.notFound('Hypothesis');

  const [summary, evidence, contributors, validation, problem] = await Promise.all([
    toSummary(db, row),
    listEvidence(db, id),
    listContributors(db, id),
    latestValidation(db, id),
    db
      .selectFrom('problems')
      .where('id', '=', row.problem_id)
      .select(['id', 'ref', 'slug', 'title', 'geography_label'])
      .executeTakeFirstOrThrow(),
  ]);

  return {
    ...summary,
    mechanism: row.mechanism,
    expectedImpact: row.expected_impact,
    assumptions: row.assumptions,
    unknowns: row.unknowns,
    risks: row.risks,
    estimatedCost: row.estimated_cost,
    estimatedScalability: row.estimated_scalability,
    validationMethod: row.validation_method,
    createdAt: row.created_at.toISOString(),
    evidence,
    contributors,
    validation,
    problem: {
      id: problem.id,
      ref: problem.ref,
      slug: problem.slug,
      title: problem.title,
      geographyLabel: problem.geography_label,
    },
  };
}

export async function listEvidence(db: Db, hypothesisId: string): Promise<EvidenceDto[]> {
  const rows = await db
    .selectFrom('hypothesis_evidence as e')
    .leftJoin('users as u', 'u.id', 'e.added_by_id')
    .where('e.hypothesis_id', '=', hypothesisId)
    .selectAll('e')
    .select([
      'u.id as user_id',
      'u.handle',
      'u.display_name',
      'u.reputation',
      'u.is_anonymous',
      'u.origin as user_origin',
    ])
    .orderBy('e.stance')
    .orderBy('e.strength', 'desc')
    .execute();

  const sources = await loadSources(
    db,
    rows.map((row) => row.source_id),
  );
  const byId = new Map(sources.map((source) => [source.id, source]));

  return rows
    .filter((row) => byId.has(row.source_id))
    .map((row) => ({
      id: row.id,
      stance: row.stance,
      claim: row.claim,
      epistemicKind: row.epistemic_kind,
      strength: row.strength,
      note: row.note,
      origin: row.origin,
      createdAt: row.created_at.toISOString(),
      source: byId.get(row.source_id) as SourceDto,
      addedBy:
        row.user_id && row.handle
          ? toAuthor({
              id: row.user_id,
              handle: row.handle,
              display_name: row.display_name as string,
              reputation: row.reputation as number,
              is_anonymous: row.is_anonymous as boolean,
              origin: row.user_origin as string,
            })
          : null,
      addedByRunId: row.added_by_run_id,
    }));
}

async function listContributors(db: Db, hypothesisId: string): Promise<AuthorDto[]> {
  const rows = await db
    .selectFrom('hypothesis_contributors as hc')
    .innerJoin('users as u', 'u.id', 'hc.user_id')
    .where('hc.hypothesis_id', '=', hypothesisId)
    .select(['u.id', 'u.handle', 'u.display_name', 'u.reputation', 'u.is_anonymous', 'u.origin'])
    .execute();
  return rows.map(toAuthor);
}

async function latestValidation(
  db: Db,
  hypothesisId: string,
): Promise<HypothesisDetailDto['validation']> {
  const row = await db
    .selectFrom('validations as v')
    .leftJoin('users as u', 'u.id', 'v.decided_by_id')
    .where('v.hypothesis_id', '=', hypothesisId)
    .selectAll('v')
    .select([
      'u.id as user_id',
      'u.handle',
      'u.display_name',
      'u.reputation',
      'u.is_anonymous',
      'u.origin as user_origin',
    ])
    .orderBy('v.decided_at', 'desc')
    .executeTakeFirst();

  if (!row) return null;
  return {
    decision: row.decision,
    rationale: row.rationale,
    criteria: row.criteria,
    decidedAt: row.decided_at.toISOString(),
    decidedBy:
      row.user_id && row.handle
        ? toAuthor({
            id: row.user_id,
            handle: row.handle,
            display_name: row.display_name as string,
            reputation: row.reputation as number,
            is_anonymous: row.is_anonymous as boolean,
            origin: row.user_origin as string,
          })
        : null,
  };
}

export async function createHypothesis(
  db: Db,
  authorId: string,
  input: CreateHypothesisInput,
): Promise<HypothesisDetailDto> {
  const problem = await db
    .selectFrom('problems')
    .where('id', '=', input.problemId)
    .select('id')
    .executeTakeFirst();
  if (!problem) throw AppError.notFound('Problem');

  const id = randomUUID();
  const ref = await nextRef(db);

  await db
    .insertInto('hypotheses')
    .values({
      id,
      ref,
      problem_id: input.problemId,
      author_id: authorId,
      author_agent_role: null,
      title: sanitizeUntrusted(input.title, 200).text,
      claim: sanitizeUntrusted(input.claim, 1200).text,
      mechanism: sanitizeUntrusted(input.mechanism, 4000).text,
      expected_impact: sanitizeUntrusted(input.expectedImpact, 2000).text,
      assumptions: input.assumptions.map((value) => sanitizeUntrusted(value, 400).text),
      unknowns: input.unknowns.map((value) => sanitizeUntrusted(value, 400).text),
      risks: input.risks.map((value) => sanitizeUntrusted(value, 400).text),
      estimated_cost: input.estimatedCost,
      estimated_scalability: input.estimatedScalability,
      validation_method: sanitizeUntrusted(input.validationMethod, 2000).text,
      // A new hypothesis starts as a draft with no evidence. It cannot start
      // anywhere else: status is a property of the record, not of the author.
      status: 'DRAFT',
      epistemic_kind: 'HUMAN_HYPOTHESIS',
      origin: 'HUMAN',
    })
    .execute();

  await audit(db, authorId, 'hypothesis.create', 'HYPOTHESIS', id, { problemId: input.problemId });
  return getHypothesis(db, id);
}

export interface AttachEvidenceInput {
  hypothesisId: string;
  stance: EvidenceStance;
  claim: string;
  strength: number;
  sourceId?: string;
  newSource?: {
    title: string;
    url: string;
    publisher: string;
    sourceType: string;
    publicationDate: string | null;
    authors: string[];
  };
  agentRunId?: string | null;
}

export async function attachEvidence(
  db: Db,
  userId: string | null,
  input: AttachEvidenceInput,
): Promise<EvidenceDto[]> {
  const hypothesis = await db
    .selectFrom('hypotheses')
    .where('id', '=', input.hypothesisId)
    .select(['id', 'status'])
    .executeTakeFirst();
  if (!hypothesis) throw AppError.notFound('Hypothesis');

  const sourceId =
    input.sourceId ??
    (input.newSource
      ? (
          await findOrCreateSource(
            db,
            {
              title: input.newSource.title,
              url: input.newSource.url,
              publisher: input.newSource.publisher,
              publicationDate: input.newSource.publicationDate,
              authors: input.newSource.authors,
              sourceType: input.newSource.sourceType as never,
            },
            { addedById: userId },
          )
        ).id
      : null);
  if (!sourceId) throw AppError.validation('Evidence must reference a source');

  const existing = await db
    .selectFrom('hypothesis_evidence')
    .where('hypothesis_id', '=', input.hypothesisId)
    .where('source_id', '=', sourceId)
    .where('stance', '=', input.stance)
    .select('id')
    .executeTakeFirst();
  if (existing) throw AppError.conflict('That source is already attached with this stance');

  await db
    .insertInto('hypothesis_evidence')
    .values({
      hypothesis_id: input.hypothesisId,
      source_id: sourceId,
      stance: input.stance,
      claim: sanitizeUntrusted(input.claim, 1200).text,
      epistemic_kind: 'SOURCE_CLAIM',
      strength: Math.min(5, Math.max(1, Math.round(input.strength))),
      added_by_id: userId,
      added_by_run_id: input.agentRunId ?? null,
      origin: userId ? 'HUMAN' : 'AGENT',
    })
    .execute();

  if (userId) {
    await db
      .insertInto('hypothesis_contributors')
      .values({ hypothesis_id: input.hypothesisId, user_id: userId, role: 'CONTRIBUTOR' })
      .onConflict((oc) => oc.doNothing())
      .execute();
  }

  await refreshDerivedStatus(db, input.hypothesisId);
  await audit(db, userId, 'evidence.attach', 'HYPOTHESIS', input.hypothesisId, {
    sourceId,
    stance: input.stance,
  });

  return listEvidence(db, input.hypothesisId);
}

/**
 * Status follows the evidence. Called after every evidence change so the board
 * never shows a status the record does not support.
 */
export async function refreshDerivedStatus(
  db: Db,
  hypothesisId: string,
): Promise<HypothesisStatus> {
  const hypothesis = await db
    .selectFrom('hypotheses')
    .where('id', '=', hypothesisId)
    .select(['status'])
    .executeTakeFirstOrThrow();

  const evidence = await evidenceForConfidence(db, hypothesisId);
  const next = deriveStatusFromEvidence(hypothesis.status, evidence);

  if (next !== hypothesis.status) {
    const check = checkStatusChange({ current: hypothesis.status, next, actor: 'SYSTEM' });
    if (check.ok) {
      await db
        .updateTable('hypotheses')
        .set({ status: next, updated_at: new Date() })
        .where('id', '=', hypothesisId)
        .execute();
      return next;
    }
  }
  await db
    .updateTable('hypotheses')
    .set({ updated_at: new Date() })
    .where('id', '=', hypothesisId)
    .execute();
  return hypothesis.status;
}

export async function setAuthorStatus(
  db: Db,
  userId: string,
  hypothesisId: string,
  next: HypothesisStatus,
): Promise<HypothesisStatus> {
  const hypothesis = await db
    .selectFrom('hypotheses')
    .where('id', '=', hypothesisId)
    .select(['status', 'author_id'])
    .executeTakeFirst();
  if (!hypothesis) throw AppError.notFound('Hypothesis');
  if (hypothesis.author_id !== userId) {
    throw AppError.forbidden('Only the author can move this hypothesis out of draft');
  }

  const check = checkStatusChange({ current: hypothesis.status, next, actor: 'AUTHOR' });
  if (!check.ok) throw AppError.forbidden(check.reason);

  await db
    .updateTable('hypotheses')
    .set({ status: next, updated_at: new Date() })
    .where('id', '=', hypothesisId)
    .execute();
  await audit(db, userId, 'hypothesis.status', 'HYPOTHESIS', hypothesisId, {
    from: hypothesis.status,
    to: next,
  });
  return next;
}

async function evidenceForConfidence(
  db: Db,
  hypothesisId: string,
): Promise<{ stance: EvidenceStance; strength: number; reliability: Reliability }[]> {
  const rows = await db
    .selectFrom('hypothesis_evidence as e')
    .innerJoin('sources as s', 's.id', 'e.source_id')
    .where('e.hypothesis_id', '=', hypothesisId)
    .select(['e.stance', 'e.strength', 's.reliability'])
    .execute();
  return rows;
}

async function toSummary(
  db: Db,
  row: {
    id: string;
    ref: string;
    problem_id: string;
    title: string;
    claim: string;
    status: HypothesisStatus;
    epistemic_kind: string;
    origin: string;
    author_agent_role: string | null;
    updated_at: Date;
    user_id: string | null;
    handle: string | null;
    display_name: string | null;
    reputation: number | null;
    is_anonymous: boolean | null;
    user_origin: string | null;
  },
): Promise<HypothesisSummaryDto> {
  const evidence = await evidenceForConfidence(db, row.id);
  const confidence = confidenceFromEvidence(evidence);

  const counts = await db
    .selectFrom('contributions')
    .where('target_type', '=', 'HYPOTHESIS')
    .where('target_id', '=', row.id)
    .select((eb) => eb.fn.countAll<string>().as('count'))
    .executeTakeFirst();

  return {
    id: row.id,
    ref: row.ref,
    problemId: row.problem_id,
    title: row.title,
    claim: row.claim,
    status: row.status,
    epistemicKind: row.epistemic_kind,
    origin: row.origin,
    author:
      row.user_id && row.handle
        ? toAuthor({
            id: row.user_id,
            handle: row.handle,
            display_name: row.display_name as string,
            reputation: row.reputation as number,
            is_anonymous: row.is_anonymous as boolean,
            origin: row.user_origin as string,
          })
        : null,
    authorAgentRole: row.author_agent_role,
    supportingCount: evidence.filter((entry) => entry.stance === 'SUPPORTS').length,
    contradictingCount: evidence.filter((entry) => entry.stance === 'CONTRADICTS').length,
    contributionCount: Number(counts?.count ?? 0),
    confidence,
    confidenceLabel: CONFIDENCE_DESCRIPTORS[confidence].label,
    updatedAt: row.updated_at.toISOString(),
  };
}

async function nextRef(db: Db): Promise<string> {
  const row = await db
    .selectFrom('hypotheses')
    .select((eb) => eb.fn.max<string>('ref').as('max'))
    .executeTakeFirst();
  const next = Number(row?.max ?? '010400') + 1;
  return String(next).padStart(6, '0');
}

export async function audit(
  db: Db,
  actorId: string | null,
  action: string,
  targetType: string,
  targetId: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await db
    .insertInto('audit_log')
    .values({
      actor_type: actorId ? 'USER' : 'SYSTEM',
      actor_id: actorId,
      action,
      target_type: targetType,
      target_id: targetId,
      metadata: json(metadata),
    })
    .execute();
}
