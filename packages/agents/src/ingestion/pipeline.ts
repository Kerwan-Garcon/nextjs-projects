import { randomUUID } from 'node:crypto';
import {
  checkUrl,
  dedupeSources,
  evaluateProblemCandidate,
  hostOf,
  normalizeSource,
  sanitizeUntrusted,
  sha256Hex,
  type DomainKey,
  type NormalizedSource,
} from '@saveus/common';
import { json, type Db } from '@saveus/db';
import type { RawDocument, SourceConnector } from './connector.js';

/**
 * Ingestion pipeline.
 *
 *   FETCH -> NORMALIZE -> DEDUPLICATE -> CLASSIFY -> EXTRACT CLAIMS
 *         -> IDENTIFY OPEN PROBLEMS -> GENERATE CANDIDATE -> CURATE -> (human) PUBLISH
 *
 * The last arrow is the important one. Nothing here publishes: the pipeline
 * produces candidates with a checklist attached, and a human curator decides.
 * `publishCandidate` refuses a candidate that has not been approved by a person.
 */

export interface IngestionStats {
  connector: string;
  fetched: number;
  rejected: { externalId: string; reason: string }[];
  duplicates: number;
  candidates: number;
  flagged: number;
}

const DOMAIN_KEYWORDS: Readonly<Record<DomainKey, readonly string[]>> = Object.freeze({
  climate: ['climate', 'warming', 'emission', 'carbon', 'greenhouse', 'adaptation'],
  energy: ['energy', 'electricity', 'grid', 'power', 'renewable', 'nuclear', 'storage', 'hydrogen'],
  water: ['water', 'drinking', 'sanitation', 'basin', 'aquifer', 'drought', 'groundwater'],
  food: ['food', 'agriculture', 'crop', 'harvest', 'nutrition', 'soil', 'farming', 'fisheries'],
  biodiversity: [
    'biodiversity',
    'species',
    'ecosystem',
    'forest',
    'invasive',
    'habitat',
    'pollinator',
  ],
  health: ['health', 'mortality', 'disease', 'antimicrobial', 'patient', 'hospital', 'epidemi'],
  materials: ['material', 'cement', 'steel', 'mineral', 'recycling', 'concrete', 'battery'],
  cities: ['city', 'cities', 'urban', 'housing', 'building', 'municipal', 'neighbourhood'],
  transport: ['transport', 'mobility', 'vehicle', 'shipping', 'aviation', 'freight', 'road'],
  ai: [
    'artificial intelligence',
    'machine learning',
    'model',
    'algorithm',
    'data centre',
    'compute',
  ],
  other: [],
});

/** Signals that a document reports an unresolved gap rather than a finished result. */
const OPEN_PROBLEM_MARKERS: readonly RegExp[] = [
  /\bnot (?:yet )?(?:resolved|settled|established|separated|captured)\b/i,
  /\bremains? (?:unresolved|open|unclear|unknown)\b/i,
  /\bopen gap\b/i,
  /\bis not (?:known|quantified|understood)\b/i,
  /\bunevenly\b/i,
];

export function classifyDomains(document: RawDocument): DomainKey[] {
  const haystack = `${document.title} ${document.body}`.toLowerCase();
  const scored = (Object.entries(DOMAIN_KEYWORDS) as [DomainKey, readonly string[]][])
    .map(
      ([key, keywords]) =>
        [key, keywords.filter((word) => haystack.includes(word)).length] as const,
    )
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
    .slice(0, 8)
    .map((sentence) => ({
      text: sentence,
      epistemicKind: OPEN_PROBLEM_MARKERS.some((pattern) => pattern.test(sentence))
        ? ('UNKNOWN' as const)
        : ('SOURCE_CLAIM' as const),
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
    whyItMatters: gaps
      .slice(0, 3)
      .map((claim) => ({ text: claim.text, sourceIds: claim.sourceIds })),
    openQuestions: gaps.map((claim) => claim.text).slice(0, 5),
    // Deliberately empty: the pipeline does not invent constraints or targets.
    constraints: { budget: null, time: null, geography: null, technology: null, political: null },
    successCriteria: [],
  };
}

export interface RunIngestionInput {
  db: Db;
  connectors: readonly SourceConnector[];
}

export async function runIngestion(input: RunIngestionInput): Promise<IngestionStats[]> {
  const stats: IngestionStats[] = [];

  for (const connector of input.connectors) {
    const stat: IngestionStats = {
      connector: connector.name,
      fetched: 0,
      rejected: [],
      duplicates: 0,
      candidates: 0,
      flagged: 0,
    };

    // FETCH
    const documents = await connector.fetch();
    stat.fetched = documents.length;

    // NORMALIZE (+ host allowlist: a connector may not smuggle in other hosts)
    const normalized: { document: RawDocument; source: NormalizedSource }[] = [];
    for (const document of documents) {
      const urlCheck = checkUrl(document.url);
      if (!urlCheck.ok) {
        stat.rejected.push({ externalId: document.externalId, reason: urlCheck.reason });
        continue;
      }
      const host = hostOf(document.url);
      if (
        !connector.allowedHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))
      ) {
        stat.rejected.push({ externalId: document.externalId, reason: `HOST_NOT_ALLOWED:${host}` });
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
        stat.rejected.push({ externalId: document.externalId, reason: result.reason });
        continue;
      }
      if (result.source.flags.length > 0) stat.flagged += 1;
      normalized.push({ document, source: result.source });
    }

    // DEDUPLICATE (within the batch, then against what is already stored)
    const { unique, duplicates } = dedupeSources(normalized.map((entry) => entry.source));
    stat.duplicates = duplicates.length;
    const uniqueHashes = new Set(unique.map((source) => source.contentHash));

    for (const { document, source } of normalized) {
      if (!uniqueHashes.has(source.contentHash)) continue;

      const bodyResult = sanitizeUntrusted(document.body, 8000);
      const existingRaw = await input.db
        .selectFrom('raw_documents')
        .where('connector', '=', connector.name)
        .where('external_id', '=', document.externalId)
        .select('id')
        .executeTakeFirst();

      let rawId = existingRaw?.id;
      if (!rawId) {
        rawId = randomUUID();
        await input.db
          .insertInto('raw_documents')
          .values({
            id: rawId,
            connector: connector.name,
            external_id: document.externalId,
            title: source.title,
            url: source.canonicalUrl,
            publisher: source.publisher,
            published_at: document.publishedAt,
            body: bodyResult.text,
            content_hash: sha256Hex(bodyResult.text),
            flags: [...new Set([...source.flags, ...bodyResult.flags])],
          })
          .execute();
      }

      // Store or reuse the source record.
      // Same identity rule as the API: canonical URL first, content hash
      // second. A connector re-titling a document must not create a second row.
      const existingSource = await input.db
        .selectFrom('sources')
        .where((eb) =>
          eb.or([
            eb('content_hash', '=', source.contentHash),
            eb('canonical_url', '=', source.canonicalUrl),
          ]),
        )
        .select('id')
        .executeTakeFirst();

      let sourceId = existingSource?.id;
      if (!sourceId) {
        sourceId = randomUUID();
        await input.db
          .insertInto('sources')
          .values({
            id: sourceId,
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
      }

      // CLASSIFY -> EXTRACT CLAIMS -> IDENTIFY OPEN PROBLEMS
      const domains = classifyDomains(document);
      const claims = extractClaims(document, sourceId);
      if (!identifiesOpenProblem(claims)) continue;

      // GENERATE CANDIDATE
      const draft = generateCandidateDraft(document, claims);

      // CURATE (checklist only - this decides eligibility, never publication)
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
      if (existingCandidate) continue;

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
          blocking: report.blocking,
          warnings: report.warnings,
        })
        .execute();

      stat.candidates += 1;
    }

    stats.push(stat);
  }

  return stats;
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
  input: {
    candidateId: string;
    curatorId: string;
    decision: 'APPROVE' | 'REJECT';
    note?: string | null;
  },
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

  if (input.decision === 'APPROVE' && candidate.blocking.length > 0) {
    return {
      status: 'BLOCKED',
      candidateId: candidate.id,
      blocking: candidate.blocking,
      reason: 'The candidate still fails blocking publication checks.',
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
