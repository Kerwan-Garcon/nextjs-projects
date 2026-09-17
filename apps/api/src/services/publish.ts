import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  AppError,
  DomainKey,
  EpistemicKind,
  GeographicScale,
  Id,
  RawSourceSchema,
  evaluateProblemCandidate,
  sanitizeUntrusted,
  type CurationReport,
} from '@saveus/common';
import { json, type Db } from '@saveus/db';
import { findOrCreateSource } from './sources.js';

/**
 * Publishing a candidate as a problem.
 *
 * This is the one place the automated pipeline connects to the public board,
 * and it is deliberately narrow. The pipeline can put a candidate in the queue.
 * Only a named human, writing the problem statement themselves, can turn it
 * into a problem - and only if the publication checklist has nothing blocking.
 *
 * The checklist is re-evaluated here against what the curator actually wrote,
 * not against what the candidate scored at intake. A curator cannot approve
 * their way past a missing success criterion.
 */

export const PublishProblemInput = z.object({
  candidateId: Id.optional(),
  title: z.string().trim().min(20).max(200),
  summary: z.string().trim().min(20).max(400),
  description: z.string().trim().min(300),
  whyItMatters: z
    .array(
      z.object({
        text: z.string().trim().min(10).max(1200),
        kind: EpistemicKind.default('SOURCE_CLAIM'),
        sourceIds: z.array(Id).max(20).default([]),
      }),
    )
    .min(1),
  currentKnowledge: z
    .array(
      z.object({
        text: z.string().trim().min(10).max(1200),
        kind: EpistemicKind.default('SOURCE_CLAIM'),
        sourceIds: z.array(Id).max(20).default([]),
      }),
    )
    .default([]),
  constraints: z.object({
    budget: z.string().trim().max(600).nullable().default(null),
    time: z.string().trim().max(600).nullable().default(null),
    geography: z.string().trim().max(600).nullable().default(null),
    technology: z.string().trim().max(600).nullable().default(null),
    political: z.string().trim().max(600).nullable().default(null),
  }),
  successCriteria: z
    .array(
      z.object({
        metric: z.string().trim().min(5).max(240),
        target: z.string().trim().min(1).max(160),
        horizon: z.string().trim().min(1).max(80),
        measurement: z.string().trim().max(400).nullable().default(null),
      }),
    )
    .min(1),
  openQuestions: z.array(z.string().trim().min(5).max(400)).default([]),
  geographyLabel: z.string().trim().min(2).max(80),
  geographyScale: GeographicScale,
  countryCode: z.string().trim().length(2).nullable().default(null),
  difficulty: z.number().int().min(0).max(10),
  urgency: z.number().int().min(0).max(10),
  domains: z.array(DomainKey).min(1).max(4),
  sourceIds: z.array(Id).max(40).default([]),
  /**
   * Sources the curator adds while writing. The checklist wants two distinct
   * sources and at least one of high reliability, and an intake candidate
   * arrives with one - so corroborating a candidate is part of publishing it,
   * not a separate errand.
   */
  newSources: z.array(RawSourceSchema).max(10).default([]),
});
export type PublishProblemInput = z.infer<typeof PublishProblemInput>;

export interface PublishResult {
  problemId: string;
  ref: string;
  slug: string;
  report: CurationReport;
}

export async function publishProblem(
  db: Db,
  curatorId: string,
  input: PublishProblemInput,
): Promise<PublishResult> {
  // The candidate gate comes first. Telling a curator which checklist items
  // their draft fails is useless when they are not allowed to publish it at
  // all, and it would create sources for a submission that can never land.
  const candidate = input.candidateId
    ? await db
        .selectFrom('problem_candidates')
        .where('id', '=', input.candidateId)
        .select(['id', 'status', 'published_problem_id'])
        .executeTakeFirst()
    : undefined;

  if (input.candidateId && !candidate) throw AppError.notFound('Candidate');
  if (candidate?.published_problem_id) {
    throw AppError.conflict('That candidate has already been published');
  }
  if (candidate && candidate.status !== 'APPROVED') {
    throw AppError.forbidden('A candidate must be approved by a curator before it can be published');
  }

  const created: string[] = [];
  for (const raw of input.newSources) {
    const source = await findOrCreateSource(db, raw, {
      addedById: curatorId,
      origin: 'HUMAN',
    });
    created.push(source.id);
  }

  const sourceIds = [...new Set([...input.sourceIds, ...created])];
  if (sourceIds.length === 0) {
    throw AppError.validation('A problem needs at least one source');
  }

  const sources = await db
    .selectFrom('sources')
    .where('id', 'in', sourceIds)
    .select(['id', 'reliability', 'source_type'])
    .execute();

  if (sources.length !== sourceIds.length) {
    throw AppError.validation('One or more of the supplied sources does not exist');
  }

  const existingTitles = await db.selectFrom('problems').select('title').execute();

  // The gate. Evaluated against what the curator wrote, every time.
  const report = evaluateProblemCandidate({
    title: input.title,
    summary: input.summary,
    description: input.description,
    whyItMatters: input.whyItMatters,
    successCriteria: input.successCriteria,
    constraints: input.constraints,
    openQuestions: input.openQuestions,
    domains: input.domains,
    sources: sources.map((source) => ({
      id: source.id,
      reliability: source.reliability,
      sourceType: source.source_type,
    })),
    existingTitles: existingTitles.map((row) => row.title),
  });

  if (!report.eligibleForCuration) {
    throw AppError.validation(
      'The problem statement does not pass the publication checklist yet',
      report.blocking,
    );
  }

  const id = randomUUID();
  const ref = await nextRef(db);
  const slug = await uniqueSlug(db, input.title);

  await db.transaction().execute(async (trx) => {
    await trx
      .insertInto('problems')
      .values({
        id,
        ref,
        slug,
        title: sanitizeUntrusted(input.title, 200).text,
        summary: sanitizeUntrusted(input.summary, 400).text,
        description: sanitizeUntrusted(input.description, 20_000).text,
        why_it_matters: json(
          input.whyItMatters.map((statement) => ({
            text: statement.text,
            kind: statement.sourceIds.length === 0 ? 'UNKNOWN' : statement.kind,
            sourceIds: statement.sourceIds,
            note: null,
          })),
        ),
        constraints: json(input.constraints),
        success_criteria: json(input.successCriteria),
        current_knowledge: json(
          input.currentKnowledge.map((statement) => ({
            text: statement.text,
            kind: statement.sourceIds.length === 0 ? 'UNKNOWN' : statement.kind,
            sourceIds: statement.sourceIds,
            note: null,
          })),
        ),
        open_questions: input.openQuestions,
        geography_label: input.geographyLabel,
        geography_scale: input.geographyScale,
        country_code: input.countryCode ? input.countryCode.toUpperCase() : null,
        difficulty: input.difficulty,
        urgency: input.urgency,
        status: 'OPEN',
        origin: candidate ? 'INGESTED' : 'HUMAN',
        published_by_id: curatorId,
        source_candidate_id: candidate?.id ?? null,
      })
      .execute();

    await trx
      .insertInto('problem_domains')
      .values(
        input.domains.map((domain, index) => ({
          problem_id: id,
          domain_key: domain,
          is_primary: index === 0,
        })),
      )
      .execute();

    await trx
      .insertInto('problem_sources')
      .values(
        sourceIds.map((sourceId) => ({
          id: randomUUID(),
          problem_id: id,
          source_id: sourceId,
          role: 'EVIDENCE',
          note: null,
          added_by_id: curatorId,
        })),
      )
      .execute();

    if (candidate) {
      await trx
        .updateTable('problem_candidates')
        .set({ status: 'PUBLISHED', published_problem_id: id, updated_at: new Date() })
        .where('id', '=', candidate.id)
        .execute();
    }

    await trx
      .insertInto('audit_log')
      .values({
        actor_type: 'USER',
        actor_id: curatorId,
        action: 'problem.publish',
        target_type: 'PROBLEM',
        target_id: id,
        metadata: json({
          candidateId: candidate?.id ?? null,
          checklistScore: report.score,
          warnings: report.warnings,
        }),
      })
      .execute();
  });

  return { problemId: id, ref, slug, report };
}

async function nextRef(db: Db): Promise<string> {
  const row = await db
    .selectFrom('problems')
    .select((eb) => eb.fn.max<string>('ref').as('max'))
    .executeTakeFirst();
  return String(Number(row?.max ?? '004820') + 1).padStart(6, '0');
}

async function uniqueSlug(db: Db, title: string): Promise<string> {
  const base = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .split('-')
    .slice(0, 10)
    .join('-')
    .slice(0, 110);

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const clash = await db.selectFrom('problems').where('slug', '=', slug).select('id').executeTakeFirst();
    if (!clash) return slug;
  }
  return `${base}-${Date.now().toString(36)}`;
}
