import { z } from 'zod';
import {
  AgentRole,
  AgentRunStatus,
  CandidateStatus,
  ConfidenceLevel,
  ContributionKind,
  ContributionTargetType,
  DomainKey,
  EpistemicKind,
  EvidenceStance,
  GeographicScale,
  HypothesisStatus,
  Origin,
  ProblemStatus,
  Reliability,
  ReputationEventKind,
  SourceType,
  ValidationDecision,
} from './enums.js';

export const Id = z.string().uuid();
export const Handle = z
  .string()
  .min(3)
  .max(32)
  .regex(/^[a-z0-9][a-z0-9_-]*$/, 'lowercase letters, digits, "_" and "-" only');

export const Iso = z.string().datetime({ offset: true });

/** 0..10 integer scales used for difficulty / urgency bars. */
export const Scale10 = z.number().int().min(0).max(10);

export const UserSchema = z.object({
  id: Id,
  handle: Handle,
  displayName: z.string().min(1).max(80),
  bio: z.string().max(600).nullable(),
  reputation: z.number().int(),
  trust: z.number().min(0).max(1),
  isAnonymous: z.boolean(),
  origin: Origin,
  createdAt: Iso,
});
export type User = z.infer<typeof UserSchema>;

export const SourceSchema = z.object({
  id: Id,
  title: z.string().min(3).max(400),
  authors: z.array(z.string().max(200)).max(60),
  publisher: z.string().min(1).max(200),
  publicationDate: z.string().nullable(),
  url: z.string().url(),
  canonicalUrl: z.string().url(),
  sourceType: SourceType,
  domain: z.string().min(1).max(120),
  reliability: Reliability,
  reliabilityNote: z.string().max(400).nullable(),
  retrievedAt: Iso,
  contentHash: z.string().length(64),
  origin: Origin,
});
export type Source = z.infer<typeof SourceSchema>;

export const ProblemConstraintsSchema = z.object({
  budget: z.string().max(600).nullable(),
  time: z.string().max(600).nullable(),
  geography: z.string().max(600).nullable(),
  technology: z.string().max(600).nullable(),
  political: z.string().max(600).nullable(),
});
export type ProblemConstraints = z.infer<typeof ProblemConstraintsSchema>;

export const SuccessCriterionSchema = z.object({
  metric: z.string().min(3).max(240),
  target: z.string().min(1).max(160),
  horizon: z.string().min(1).max(80),
  measurement: z.string().max(400).nullable(),
});
export type SuccessCriterion = z.infer<typeof SuccessCriterionSchema>;

export const StatementSchema = z.object({
  text: z.string().min(3).max(1200),
  kind: EpistemicKind,
  sourceIds: z.array(Id).max(20).default([]),
  note: z.string().max(400).nullable().default(null),
});
export type Statement = z.infer<typeof StatementSchema>;

export const ProblemSchema = z.object({
  id: Id,
  ref: z.string().regex(/^\d{6}$/),
  slug: z.string().min(3).max(120),
  title: z.string().min(10).max(200),
  summary: z.string().min(20).max(400),
  description: z.string().min(80),
  whyItMatters: z.array(StatementSchema).min(1),
  constraints: ProblemConstraintsSchema,
  successCriteria: z.array(SuccessCriterionSchema).min(1),
  currentKnowledge: z.array(StatementSchema),
  openQuestions: z.array(z.string().min(5).max(400)),
  geographyLabel: z.string().min(2).max(80),
  geographyScale: GeographicScale,
  countryCode: z.string().length(2).nullable(),
  difficulty: Scale10,
  urgency: Scale10,
  status: ProblemStatus,
  origin: Origin,
  createdAt: Iso,
  updatedAt: Iso,
});
export type Problem = z.infer<typeof ProblemSchema>;

export const HypothesisSchema = z.object({
  id: Id,
  ref: z.string().regex(/^\d{6}$/),
  problemId: Id,
  authorId: Id.nullable(),
  authorAgentRole: AgentRole.nullable(),
  title: z.string().min(10).max(200),
  claim: z.string().min(20).max(1200),
  mechanism: z.string().min(20),
  expectedImpact: z.string().min(10),
  assumptions: z.array(z.string().min(5).max(400)).min(1),
  unknowns: z.array(z.string().min(5).max(400)),
  risks: z.array(z.string().min(5).max(400)),
  estimatedCost: z.string().max(400).nullable(),
  estimatedScalability: z.string().max(400).nullable(),
  validationMethod: z.string().min(10),
  status: HypothesisStatus,
  epistemicKind: z.enum(['HUMAN_HYPOTHESIS', 'AI_HYPOTHESIS']),
  origin: Origin,
  createdAt: Iso,
  updatedAt: Iso,
});
export type Hypothesis = z.infer<typeof HypothesisSchema>;

export const HypothesisEvidenceSchema = z.object({
  id: Id,
  hypothesisId: Id,
  sourceId: Id,
  stance: EvidenceStance,
  claim: z.string().min(10).max(1200),
  epistemicKind: EpistemicKind,
  strength: z.number().int().min(1).max(5),
  addedById: Id.nullable(),
  addedByAgentRunId: Id.nullable(),
  note: z.string().max(800).nullable(),
  origin: Origin,
  createdAt: Iso,
});
export type HypothesisEvidence = z.infer<typeof HypothesisEvidenceSchema>;

export const ContributionSchema = z.object({
  id: Id,
  kind: ContributionKind,
  targetType: ContributionTargetType,
  targetId: Id,
  problemId: Id,
  authorId: Id,
  body: z.string().min(1),
  sourceIds: z.array(Id).max(20),
  score: z.number().min(0).max(100),
  signals: z.record(z.number()),
  status: z.enum(['ACTIVE', 'WITHDRAWN', 'FLAGGED']),
  origin: Origin,
  createdAt: Iso,
});
export type Contribution = z.infer<typeof ContributionSchema>;

export const AgentFindingSchema = z.object({
  id: Id,
  runId: Id,
  kind: z.enum([
    'EVIDENCE',
    'COUNTEREVIDENCE',
    'ASSUMPTION',
    'RISK',
    'UNKNOWN',
    'EXISTING_SOLUTION',
    'TEST_DESIGN',
    'COMPARISON',
    'SUMMARY',
  ]),
  statement: z.string().min(5),
  epistemicKind: EpistemicKind,
  confidence: ConfidenceLevel,
  sourceIds: z.array(Id),
  reasoning: z.string(),
  unresolved: z.string().nullable(),
  createdAt: Iso,
});
export type AgentFinding = z.infer<typeof AgentFindingSchema>;

export const AgentRunSchema = z.object({
  id: Id,
  agentRole: AgentRole,
  sessionId: Id.nullable(),
  problemId: Id.nullable(),
  hypothesisId: Id.nullable(),
  action: z.string(),
  status: AgentRunStatus,
  provider: z.string(),
  model: z.string(),
  inputDigest: z.string(),
  startedAt: Iso,
  finishedAt: Iso.nullable(),
  durationMs: z.number().int().nullable(),
  tokensIn: z.number().int().nullable(),
  tokensOut: z.number().int().nullable(),
  error: z.string().nullable(),
  requestedById: Id.nullable(),
});
export type AgentRun = z.infer<typeof AgentRunSchema>;

export const ValidationSchema = z.object({
  id: Id,
  hypothesisId: Id,
  decision: ValidationDecision,
  criteria: z.array(
    z.object({
      criterion: z.string(),
      met: z.boolean(),
      note: z.string().nullable(),
    }),
  ),
  rationale: z.string().min(20),
  decidedById: Id.nullable(),
  decidedAt: Iso,
  origin: Origin,
});
export type Validation = z.infer<typeof ValidationSchema>;

export const ReputationEventSchema = z.object({
  id: Id,
  userId: Id,
  kind: ReputationEventKind,
  delta: z.number().int(),
  reason: z.string(),
  problemId: Id.nullable(),
  contributionId: Id.nullable(),
  createdAt: Iso,
});
export type ReputationEvent = z.infer<typeof ReputationEventSchema>;

/* ------------------------------------------------------------------ */
/* Input schemas (what the API accepts)                                */
/* ------------------------------------------------------------------ */

export const CreateContributionInput = z.object({
  kind: ContributionKind,
  targetType: ContributionTargetType,
  targetId: Id,
  body: z
    .string()
    .trim()
    .min(20, 'A contribution needs at least 20 characters of substance')
    .max(8000),
  sourceIds: z.array(Id).max(20).default([]),
  newSources: z
    .array(
      z.object({
        title: z.string().trim().min(3).max(400),
        url: z.string().trim().url(),
        publisher: z.string().trim().min(1).max(200),
        sourceType: SourceType,
        publicationDate: z.string().max(40).nullable().default(null),
        authors: z.array(z.string().max(200)).max(60).default([]),
      }),
    )
    .max(5)
    .default([]),
});
export type CreateContributionInput = z.infer<typeof CreateContributionInput>;

export const CreateHypothesisInput = z.object({
  problemId: Id,
  title: z.string().trim().min(10).max(200),
  claim: z.string().trim().min(40).max(1200),
  mechanism: z.string().trim().min(40).max(4000),
  expectedImpact: z.string().trim().min(20).max(2000),
  assumptions: z.array(z.string().trim().min(5).max(400)).min(1).max(12),
  unknowns: z.array(z.string().trim().min(5).max(400)).max(12).default([]),
  risks: z.array(z.string().trim().min(5).max(400)).max(12).default([]),
  estimatedCost: z.string().trim().max(400).nullable().default(null),
  estimatedScalability: z.string().trim().max(400).nullable().default(null),
  validationMethod: z.string().trim().min(20).max(2000),
});
export type CreateHypothesisInput = z.infer<typeof CreateHypothesisInput>;

export const ProblemFilterInput = z.object({
  domain: DomainKey.optional(),
  status: ProblemStatus.optional(),
  scale: GeographicScale.optional(),
  country: z.string().length(2).optional(),
  minDifficulty: z.coerce.number().int().min(0).max(10).optional(),
  maxDifficulty: z.coerce.number().int().min(0).max(10).optional(),
  minUrgency: z.coerce.number().int().min(0).max(10).optional(),
  q: z.string().trim().max(120).optional(),
  sort: z.enum(['urgency', 'difficulty', 'activity', 'recent']).default('urgency'),
  limit: z.coerce.number().int().min(1).max(60).default(30),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ProblemFilterInput = z.infer<typeof ProblemFilterInput>;

export const CandidateSchema = z.object({
  id: Id,
  connector: z.string(),
  externalId: z.string(),
  title: z.string(),
  summary: z.string(),
  proposedDomains: z.array(DomainKey),
  status: CandidateStatus,
  curationScore: z.number().min(0).max(100),
  blocking: z.array(z.string()),
  warnings: z.array(z.string()),
  sourceIds: z.array(Id),
  createdAt: Iso,
});
export type Candidate = z.infer<typeof CandidateSchema>;
