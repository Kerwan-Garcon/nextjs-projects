import { z } from 'zod';

/**
 * Domain keys are stable identifiers. Adding a new research domain means adding
 * a key here and a row in the `domains` table (see docs in README).
 */
export const DomainKey = z.enum([
  'climate',
  'energy',
  'water',
  'food',
  'biodiversity',
  'health',
  'materials',
  'cities',
  'transport',
  'ai',
  'other',
]);
export type DomainKey = z.infer<typeof DomainKey>;

export const ProblemStatus = z.enum([
  'OPEN',
  'ACTIVE_RESEARCH',
  'NEEDS_EVIDENCE',
  'STALLED',
  'SOLUTION_CANDIDATE',
  'ARCHIVED',
]);
export type ProblemStatus = z.infer<typeof ProblemStatus>;

export const HypothesisStatus = z.enum([
  'DRAFT',
  'UNDER_REVIEW',
  'NEEDS_EVIDENCE',
  'CONTESTED',
  'TESTABLE',
  'SIMULATION',
  'PROMISING',
  'VALIDATED',
  'REJECTED',
]);
export type HypothesisStatus = z.infer<typeof HypothesisStatus>;

/** Statuses a human author may set on their own hypothesis. */
export const AUTHOR_SETTABLE_STATUSES: readonly HypothesisStatus[] = [
  'DRAFT',
  'UNDER_REVIEW',
  'NEEDS_EVIDENCE',
];

/** Statuses that may only be reached through a recorded Validation record. */
export const VALIDATION_ONLY_STATUSES: readonly HypothesisStatus[] = [
  'PROMISING',
  'VALIDATED',
  'REJECTED',
];

export const ContributionKind = z.enum([
  'COMMENT',
  'EVIDENCE',
  'COUNTERARGUMENT',
  'MODIFICATION',
  'QUESTION',
  'EXPERIMENT',
  'RESULT',
]);
export type ContributionKind = z.infer<typeof ContributionKind>;

export const ContributionTargetType = z.enum(['PROBLEM', 'HYPOTHESIS', 'EVIDENCE']);
export type ContributionTargetType = z.infer<typeof ContributionTargetType>;

export const SourceType = z.enum([
  'SCIENTIFIC_PAPER',
  'GOVERNMENT',
  'UN',
  'DATASET',
  'INSTITUTION',
  'NEWS',
  'PATENT',
  'REPORT',
  'OTHER',
]);
export type SourceType = z.infer<typeof SourceType>;

export const Reliability = z.enum(['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN']);
export type Reliability = z.infer<typeof Reliability>;

/**
 * How a statement should be read. This is deliberately first-class: the UI must
 * never render an inference or a model output with the same weight as a
 * measured fact carried by a source.
 */
export const EpistemicKind = z.enum([
  'FACT',
  'SOURCE_CLAIM',
  'HUMAN_HYPOTHESIS',
  'AI_HYPOTHESIS',
  'INFERENCE',
  'UNKNOWN',
]);
export type EpistemicKind = z.infer<typeof EpistemicKind>;

/** Strength of an agent finding. Never "true"/"false". */
export const ConfidenceLevel = z.enum([
  'SUPPORTED',
  'PLAUSIBLE',
  'UNCERTAIN',
  'CONTESTED',
  'REFUTED',
]);
export type ConfidenceLevel = z.infer<typeof ConfidenceLevel>;

export const EvidenceStance = z.enum(['SUPPORTS', 'CONTRADICTS', 'CONTEXT']);
export type EvidenceStance = z.infer<typeof EvidenceStance>;

export const AgentRole = z.enum([
  'SCOUT',
  'RESEARCHER',
  'SYNTHESIZER',
  'SCIENTIST',
  'ENGINEER',
  'ECONOMIST',
  'SKEPTIC',
  'RED_TEAM',
  'SIMULATOR',
  'EDITOR',
  'CURATOR',
]);
export type AgentRole = z.infer<typeof AgentRole>;

export const AgentRunStatus = z.enum(['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'BLOCKED']);
export type AgentRunStatus = z.infer<typeof AgentRunStatus>;

/** Contextual research actions offered on a hypothesis (never one "Ask AI" box). */
export const ResearchAction = z.enum([
  'FIND_EVIDENCE',
  'FIND_COUNTEREVIDENCE',
  'SEARCH_RELATED_RESEARCH',
  'FIND_EXISTING_SOLUTIONS',
  'IDENTIFY_ASSUMPTIONS',
  'RED_TEAM',
  'GENERATE_TEST',
  'COMPARE_WITH_EXISTING',
  'FULL_REVIEW',
]);
export type ResearchAction = z.infer<typeof ResearchAction>;

export const ValidationDecision = z.enum(['VALIDATED', 'REJECTED', 'INSUFFICIENT']);
export type ValidationDecision = z.infer<typeof ValidationDecision>;

export const ReputationEventKind = z.enum([
  'EVIDENCE_ACCEPTED',
  'COUNTERARGUMENT_UPHELD',
  'HYPOTHESIS_IMPROVED',
  'REPRODUCIBLE_RESULT',
  'VALIDATED_CONTRIBUTION',
  'CROSS_DOMAIN_LINK',
  'PEER_ASSIST',
  'ERROR_FOUND',
  'CONTRIBUTION_SCORED',
  'LOW_QUALITY_PENALTY',
  'SPAM_PENALTY',
]);
export type ReputationEventKind = z.infer<typeof ReputationEventKind>;

/**
 * Where a record came from. Seeded records are DEMO_SEED and are labelled
 * "DEMO DATA" everywhere in the UI so nothing synthetic can read as real work.
 */
export const Origin = z.enum(['HUMAN', 'AGENT', 'INGESTED', 'DEMO_SEED']);
export type Origin = z.infer<typeof Origin>;

export const CandidateStatus = z.enum([
  'NORMALIZED',
  'CLASSIFIED',
  'DRAFTED',
  'PENDING_CURATION',
  'APPROVED',
  'REJECTED',
  'PUBLISHED',
]);
export type CandidateStatus = z.infer<typeof CandidateStatus>;

export const GeographicScale = z.enum([
  'LOCAL',
  'CITY',
  'REGIONAL',
  'NATIONAL',
  'CONTINENTAL',
  'GLOBAL',
]);
export type GeographicScale = z.infer<typeof GeographicScale>;
