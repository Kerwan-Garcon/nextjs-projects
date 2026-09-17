import { randomUUID } from 'node:crypto';
import {
  assessIntake,
  checkUrl,
  dedupeSources,
  evaluateProblemCandidate,
  hostOf,
  GAP_PATTERNS,
  normalizeSource,
  sanitizeUntrusted,
  sha256Hex,
  type DomainKey,
  type IntakeAssessment,
  type IntakeRejection,
  type NormalizedSource,
} from '@saveus/common';
import { json, type Db } from '@saveus/db';
import type { RawDocument, SourceConnector } from './connector.js';

/**
 * Ingestion pipeline.
 *
 *   FETCH -> NORMALIZE -> DEDUPLICATE -> ASSESS RELEVANCE -> CLASSIFY
 *         -> EXTRACT CLAIMS -> IDENTIFY OPEN PROBLEMS -> GENERATE CANDIDATE
 *         -> CURATE -> (human) PUBLISH
 *
 * Two rules shape the whole thing.
 *
 * Nothing here publishes. The pipeline produces candidates with a checklist
 * attached, and a human curator decides.
 *
 * And the relevance gate runs before anything is written, because the way an
 * automated problem feed fails is not by fetching too little - it is by filling
 * the board with announcements that look like problems. Everything fetched is
 * kept with the verdict it received, so the filter can be tuned against what it
 * actually discarded rather than against a guess.
 *
 * Only ACCEPT reaches the human queue. WEAK is recorded in full, with its score
 * and the signals that fired, and is visible in the intake health panel - but a
 * curator's queue is a scarce resource and filling it with things the gate
 * itself already doubts is how it stops being read.
 */

/**
 * The most candidates one connector may add to the curation queue in a cycle.
 * A day's literature can be large; a curator's attention cannot. When more pass
 * the gate than this, the highest-scoring ones are queued and the rest are kept
 * as assessed documents for the next cycle to reconsider.
 */
export const MAX_CANDIDATES_PER_RUN = 10;

export interface IngestionStats {
  connector: string;
  runId: string;
  fetched: number;
  accepted: number;
  weak: number;
  rejected: number;
  duplicates: number;
  candidates: number;
  /** Passed the gate but over the per-run cap; left for the next cycle. */
  deferred: number;
  flagged: number;
  rejectionReasons: Record<string, number>;
  errors: { externalId: string; reason: string }[];
}

const DOMAIN_KEYWORDS: Readonly<Record<DomainKey, readonly string[]>> = Object.freeze({
  climate: ['climate', 'warming', 'emission', 'carbon', 'greenhouse', 'adaptation', 'heatwave'],
  energy: ['energy', 'electricity', 'grid', 'power', 'renewable', 'nuclear', 'storage', 'hydrogen'],
  water: ['water', 'drinking', 'sanitation', 'basin', 'aquifer', 'drought', 'groundwater'],
  food: ['food', 'agriculture', 'crop', 'harvest', 'nutrition', 'soil', 'farming', 'fisheries'],
  biodiversity: ['biodiversity', 'species', 'ecosystem', 'forest', 'invasive', 'habitat', 'pollinator'],
  health: ['health', 'mortality', 'disease', 'antimicrobial', 'patient', 'hospital', 'epidemi', 'clinical'],
  materials: ['material', 'cement', 'steel', 'mineral', 'recycling', 'concrete', 'battery'],
  cities: ['city', 'cities', 'urban', 'housing', 'building', 'municipal', 'neighbourhood'],
  transport: ['transport', 'mobility', 'vehicle', 'shipping', 'aviation', 'freight', 'road'],
  ai: ['artificial intelligence', 'machine learning', 'algorithm', 'data centre', 'compute', 'neural'],
  other: [],
});

/**
 * A sentence states a gap if it uses the same language the intake gate looks
 * for. One definition, shared: a gate that admits a document and an extractor
 * that then finds nothing quotable in it disagree about what a gap is, and the
 * document is lost between them.
 */
function statesGap(sentence: string): boolean {
  return GAP_PATTERNS.some((entry) => entry.pattern.test(sentence));
}

export function classifyDomains(document: RawDocument): DomainKey[] {
  const haystack = `${document.title} ${document.body}`.toLowerCase();
  const scored = (Object.entries(DOMAIN_KEYWORDS) as [DomainKey, readonly string[]][])
    .map(([key, keywords]) => [key, keywords.filter((word) => haystack.includes(word)).length] as const)
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([key]) => key);

  const suggested = document.suggestedDomains.filter((key) => key !== 'other');
  const merged = [...new Set([...suggested, ...scored])].slice(0, 3);
  return merged.length > 0 ? merged : ['other'];
}

export interface ExtractedClaim {
  text: string;
  epistemicKind: 'SOURCE_CLAIM' | 'UNKNOWN';
  sourceIds: string[];
}

/**
 * Claim extraction is deliberately conservative: it splits the intake text into
 * sentences and attributes each one to the document, marking the ones that
 * announce a gap as UNKNOWN. It never rewrites a sentence into a stronger claim.
 */
export function extractClaims(document: RawDocument, sourceId: string): ExtractedClaim[] {
  const { text } = sanitizeUntrusted(document.body, 4000);
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 40)
    .slice(0, 10)
    .map((sentence) => ({
      text: sentence,
      epistemicKind: statesGap(sentence) ? ('UNKNOWN' as const) : ('SOURCE_CLAIM' as const),
      sourceIds: [sourceId],
    }));
}

export function identifiesOpenProblem(claims: readonly ExtractedClaim[]): boolean {
  return claims.some((claim) => claim.epistemicKind === 'UNKNOWN');
}

export interface CandidateDraft {
  title: string;
  summary: string;
  description: string;
  whyItMatters: { text: string; sourceIds: string[] }[];
  openQuestions: string[];
  constraints: {
    budget: string | null;
    time: string | null;
    geography: string | null;
    technology: string | null;
    political: string | null;
  };
  successCriteria: { metric: string; target: string; horizon: string }[];
}

export function generateCandidateDraft(
  document: RawDocument,
  claims: readonly ExtractedClaim[],
): CandidateDraft {
  const gaps = claims.filter((claim) => claim.epistemicKind === 'UNKNOWN');
  const context = claims.filter((claim) => claim.epistemicKind === 'SOURCE_CLAIM');

  return {
    title: `Open question raised by: ${document.title}`,
    summary: gaps[0]?.text ?? `Intake candidate derived from ${document.title}.`,
    description: [
      `Candidate derived automatically from "${document.title}" (${document.publisher}).`,
      '',
      'CONTEXT AS RECORDED AT INTAKE',
      ...context.map((claim) => `- ${claim.text}`),
      '',
      'GAPS FLAGGED AT INTAKE',
      ...gaps.map((claim) => `- ${claim.text}`),
      '',
      'This text was produced by the ingestion pipeline. It is not a problem statement yet: a human curator must write the factual description, the quantified consequences, the constraints and the success criteria before this can be published.',
    ].join('\n'),
    whyItMatters: gaps.slice(0, 3).map((claim) => ({ text: claim.text, sourceIds: claim.sourceIds })),
    openQuestions: gaps.map((claim) => claim.text).slice(0, 5),
    // Deliberately empty: the pipeline does not invent constraints or targets.
    constraints: { budget: null, time: null, geography: null, technology: null, political: null },
    successCriteria: [],
  };
}

export interface RunIngestionInput {
  db: Db;
  connectors: readonly SourceConnector[];
  trigger?: 'MANUAL' | 'SCHEDULED' | 'SEED';
  now?: Date;
  /**
   * Stop starting new work after this moment (epoch milliseconds).
   *
   * A long-running worker has all day. A serverless function has whatever its
   * platform allows, and being killed mid-cycle leaves an ingestion_runs row
   * open forever with no record of why. With a budget the cycle stops between
   * connectors, finishes its bookkeeping, and reports what it did not reach -
   * which the next run picks up, because every connector is independent.
   */
  deadlineAt?: number;
}

export interface IngestionOutcome {
  stats: IngestionStats[];
  /** Connectors the time budget did not allow. Not an error; a fact to report. */
  skipped: string[];
}

export async function runIngestion(input: RunIngestionInput): Promise<IngestionStats[]> {
  return (await runIngestionCycle(input)).stats;
}

/** Same cycle, with the budget outcome the caller may want to report. */
export async function runIngestionCycle(input: RunIngestionInput): Promise<IngestionOutcome> {
  const stats: IngestionStats[] = [];
  const skipped: string[] = [];
  const outOfTime = (): boolean =>
    input.deadlineAt !== undefined && Date.now() >= input.deadlineAt;

  // Titles already on the board or in the queue, for near-duplicate rejection.
  const existingTitles = await loadExistingTitles(input.db);

  for (const connector of input.connectors) {
    if (outOfTime()) {
      skipped.push(connector.name);
      continue;
    }
    const runId = randomUUID();
    const stat: IngestionStats = {
      connector: connector.name,
      runId,
      fetched: 0,
      accepted: 0,
      weak: 0,
      rejected: 0,
      duplicates: 0,
      candidates: 0,
      deferred: 0,
      flagged: 0,
      rejectionReasons: {},
      errors: [],
    };

    await input.db
      .insertInto('ingestion_runs')
      .values({
        id: runId,
        connector: connector.name,
        trigger: input.trigger ?? 'MANUAL',
        rejection_reasons: json({}),
      })
      .execute();

    try {
      // FETCH
      const documents = await connector.fetch();
      stat.fetched = documents.length;

      // NORMALIZE (+ host allowlist: a connector may not smuggle in other hosts)
      const normalized: { document: RawDocument; source: NormalizedSource }[] = [];
      for (const document of documents) {
        const urlCheck = checkUrl(document.url);
        if (!urlCheck.ok) {
          stat.errors.push({ externalId: document.externalId, reason: urlCheck.reason });
          continue;
        }
        const host = hostOf(document.url);
        if (!connector.allowedHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) {
          stat.errors.push({ externalId: document.externalId, reason: `HOST_NOT_ALLOWED:${host}` });
          continue;
        }
        const result = normalizeSource({
          title: document.title,
          url: document.url,
          publisher: document.publisher,
          publicationDate: document.publishedAt,
          abstract: document.body,
        });
        if (!result.ok) {
          stat.errors.push({ externalId: document.externalId, reason: result.reason });
          continue;
        }
        if (result.source.flags.length > 0) stat.flagged += 1;
        normalized.push({ document, source: result.source });
      }

      // DEDUPLICATE within the batch
      const { unique, duplicates } = dedupeSources(normalized.map((entry) => entry.source));
      stat.duplicates = duplicates.length;
      const uniqueHashes = new Set(unique.map((source) => source.contentHash));

      // ASSESS RELEVANCE - the gate. Everything fetched is recorded with its
      // verdict, so the filter can be tuned against what it actually threw out.
      // Assessment is separated from queueing because the queue is capped: the
      // cap has to keep the best of the batch, which is not knowable until the
      // whole batch has been scored.
      const passed: { document: RawDocument; source: NormalizedSource; rawId: string; domains: DomainKey[]; assessment: IntakeAssessment }[] = [];

      for (const { document, source } of normalized) {
        if (!uniqueHashes.has(source.contentHash)) continue;

        // CLASSIFY (needed by the relevance gate)
        const domains = classifyDomains(document);

        const assessment = assessIntake(
          {
            title: document.title,
            body: document.body,
            publisher: source.publisher,
            url: source.canonicalUrl,
            publishedAt: document.publishedAt,
          },
          {
            reliability: source.reliability,
            existingTitles,
            domains,
            ...(input.now ? { now: input.now } : {}),
          },
        );

        const rawId = await storeRawDocument(input.db, connector.name, runId, document, source, assessment);

        if (assessment.verdict === 'REJECT') {
          stat.rejected += 1;
          countRejection(stat, assessment.code ?? 'BELOW_FLOOR');
          continue;
        }
        if (assessment.verdict === 'WEAK') {
          // Recorded, visible in the health panel, not queued.
          stat.weak += 1;
          continue;
        }

        stat.accepted += 1;
        passed.push({ document, source, rawId, domains, assessment });
      }

      // Best first, so the cap keeps the strongest rather than the earliest.
      passed.sort((a, b) => b.assessment.score - a.assessment.score);

      for (const entry of passed) {
        // Everything fetched is already stored with its verdict, so stopping
        // here loses nothing but the queueing, which the next cycle redoes.
        if (stat.candidates >= MAX_CANDIDATES_PER_RUN || outOfTime()) {
          stat.deferred += 1;
          continue;
        }

        const { document, source, rawId, domains, assessment } = entry;

        // Store or reuse the source record.
        const sourceId = await ensureSourceRow(input.db, source);

        // EXTRACT CLAIMS -> IDENTIFY OPEN PROBLEMS
        const claims = extractClaims(document, sourceId);
        if (!identifiesOpenProblem(claims)) {
          // The gate scores the document as a whole; this asks for a specific
          // sentence to quote. A candidate with no quotable gap is not one.
          stat.accepted -= 1;
          stat.rejected += 1;
          countRejection(stat, 'NO_SENTENCE_LEVEL_GAP');
          await input.db
            .updateTable('raw_documents')
            .set({
              intake_verdict: 'REJECT',
              intake_code: 'NO_SENTENCE_LEVEL_GAP',
              intake_reasons: ['Relevance passed, but no individual sentence states a gap'],
            })
            .where('id', '=', rawId)
            .execute();
          continue;
        }

        // GENERATE CANDIDATE
        const draft = generateCandidateDraft(document, claims);

        // CURATE (checklist only - eligibility, never publication)
        const report = evaluateProblemCandidate({
          ...draft,
          domains,
          sources: [{ id: sourceId, reliability: source.reliability, sourceType: source.sourceType }],
        });

        const existingCandidate = await input.db
          .selectFrom('problem_candidates')
          .where('connector', '=', connector.name)
          .where('title', '=', draft.title)
          .select('id')
          .executeTakeFirst();
        if (existingCandidate) {
          stat.accepted -= 1;
          stat.duplicates += 1;
          continue;
        }

        await input.db
          .insertInto('problem_candidates')
          .values({
            id: randomUUID(),
            connector: connector.name,
            raw_document_id: rawId,
            title: draft.title,
            summary: draft.summary.slice(0, 400),
            draft: json(draft),
            proposed_domains: domains,
            extracted_claims: json(claims),
            source_ids: [sourceId],
            status: 'PENDING_CURATION',
            curation_score: report.score,
            relevance_score: assessment.score,
            assessment: json(assessment),
            blocking: report.blocking,
            warnings: report.warnings,
          })
          .execute();

        stat.candidates += 1;
        // A newly queued candidate is itself a duplicate target for the rest of
        // this cycle and for every cycle after it.
        existingTitles.push(draft.title);
      }

      await input.db
        .updateTable('ingestion_runs')
        .set({
          finished_at: new Date(),
          fetched: stat.fetched,
          accepted: stat.accepted,
          weak: stat.weak,
          rejected: stat.rejected,
          duplicates: stat.duplicates,
          candidates: stat.candidates,
          deferred: stat.deferred,
          flagged: stat.flagged,
          rejection_reasons: json(stat.rejectionReasons),
        })
        .where('id', '=', runId)
        .execute();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      stat.errors.push({ externalId: 'connector', reason: message });
      await input.db
        .updateTable('ingestion_runs')
        .set({ finished_at: new Date(), error: message.slice(0, 500) })
        .where('id', '=', runId)
        .execute();
    }

    stats.push(stat);
  }

  return { stats, skipped };
}

async function loadExistingTitles(db: Db): Promise<string[]> {
  const [problems, candidates] = await Promise.all([
    db.selectFrom('problems').select('title').execute(),
    db.selectFrom('problem_candidates').select('title').execute(),
  ]);
  return [...problems.map((row) => row.title), ...candidates.map((row) => row.title)];
}

async function storeRawDocument(
  db: Db,
  connector: string,
  runId: string,
  document: RawDocument,
  source: NormalizedSource,
  assessment: IntakeAssessment,
): Promise<string> {
  const bodyResult = sanitizeUntrusted(document.body, 8000);
  const existing = await db
    .selectFrom('raw_documents')
    .where('connector', '=', connector)
    .where('external_id', '=', document.externalId)
    .select('id')
    .executeTakeFirst();

  if (existing) {
    await db
      .updateTable('raw_documents')
      .set({
        intake_verdict: assessment.verdict,
        intake_score: assessment.score,
        intake_code: assessment.code,
        intake_reasons: assessment.reasons,
        intake_matched: assessment.matched,
        ingestion_run_id: runId,
        fetched_at: new Date(),
      })
      .where('id', '=', existing.id)
      .execute();
    return existing.id;
  }

  const id = randomUUID();
  await db
    .insertInto('raw_documents')
    .values({
      id,
      connector,
      external_id: document.externalId,
      title: source.title,
      url: source.canonicalUrl,
      publisher: source.publisher,
      published_at: document.publishedAt,
      body: bodyResult.text,
      content_hash: sha256Hex(bodyResult.text),
      flags: [...new Set([...source.flags, ...bodyResult.flags])],
      intake_verdict: assessment.verdict,
      intake_score: assessment.score,
      intake_code: assessment.code,
      intake_reasons: assessment.reasons,
      intake_matched: assessment.matched,
      ingestion_run_id: runId,
    })
    .execute();
  return id;
}

async function ensureSourceRow(db: Db, source: NormalizedSource): Promise<string> {
  // Same identity rule as the API: canonical URL first, content hash second.
  const existing = await db
    .selectFrom('sources')
    .where((eb) =>
      eb.or([
        eb('content_hash', '=', source.contentHash),
        eb('canonical_url', '=', source.canonicalUrl),
      ]),
    )
    .select('id')
    .executeTakeFirst();
  if (existing) return existing.id;

  const id = randomUUID();
  await db
    .insertInto('sources')
    .values({
      id,
      title: source.title,
      authors: source.authors,
      publisher: source.publisher,
      publication_date: source.publicationDate,
      url: source.url,
      canonical_url: source.canonicalUrl,
      source_type: source.sourceType,
      domain: source.domain,
      reliability: source.reliability,
      reliability_note: source.reliabilityNote,
      content_hash: source.contentHash,
      origin: 'INGESTED',
      flags: source.flags,
    })
    .execute();
  return id;
}

/**
 * The histogram counts stable codes, not sentences. The human-readable reason
 * carries a threshold or a character count, and tallying those would split one
 * cause across a dozen rows.
 */
function countRejection(stat: IngestionStats, code: IntakeRejection): void {
  stat.rejectionReasons[code] = (stat.rejectionReasons[code] ?? 0) + 1;
}

/**
 * Curation decision.
 *
 * A candidate never becomes a public problem on its own. A named human curator
 * either rejects it, or approves it - and approval only unlocks the problem
 * editor, where the curator still has to write the factual description, the
 * quantified consequences, the constraints and the success criteria.
 */
export type CurationOutcome =
  | { status: 'REJECTED'; candidateId: string }
  | { status: 'APPROVED'; candidateId: string; blocking: string[] }
  | { status: 'BLOCKED'; candidateId: string; blocking: string[]; reason: string };

export async function curateCandidate(
  db: Db,
  input: { candidateId: string; curatorId: string; decision: 'APPROVE' | 'REJECT'; note?: string | null },
): Promise<CurationOutcome> {
  const candidate = await db
    .selectFrom('problem_candidates')
    .where('id', '=', input.candidateId)
    .selectAll()
    .executeTakeFirst();

  if (!candidate) {
    return {
      status: 'BLOCKED',
      candidateId: input.candidateId,
      blocking: [],
      reason: 'Candidate not found',
    };
  }

  if (candidate.status === 'PUBLISHED') {
    return {
      status: 'BLOCKED',
      candidateId: candidate.id,
      blocking: [],
      reason: 'This candidate has already been published as a problem.',
    };
  }

  const status = input.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
  await db
    .updateTable('problem_candidates')
    .set({
      status,
      curated_by_id: input.curatorId,
      curator_note: input.note ?? null,
      updated_at: new Date(),
    })
    .where('id', '=', candidate.id)
    .execute();

  await db
    .insertInto('audit_log')
    .values({
      actor_type: 'USER',
      actor_id: input.curatorId,
      action: `candidate.${input.decision.toLowerCase()}`,
      target_type: 'PROBLEM_CANDIDATE',
      target_id: candidate.id,
      metadata: json({ connector: candidate.connector, note: input.note ?? null }),
    })
    .execute();

  return input.decision === 'APPROVE'
    ? { status: 'APPROVED', candidateId: candidate.id, blocking: candidate.blocking }
    : { status: 'REJECTED', candidateId: candidate.id };
}
