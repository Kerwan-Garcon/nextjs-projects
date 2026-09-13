import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely';
import type {
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
  ProblemConstraints,
  ProblemStatus,
  Reliability,
  ReputationEventKind,
  SourceType,
  Statement,
  SuccessCriterion,
  ValidationDecision,
} from '@saveus/common';

/**
 * JSONB columns are written as strings (use `json()` from ./json) and read back
 * as parsed values. Being explicit here avoids node-postgres turning a JS array
 * into a Postgres array literal instead of JSON.
 */
type Json<T> = ColumnType<T, string, string>;
type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>;
type RequiredTimestamp = ColumnType<Date, Date | string, Date | string>;
type NullableTimestamp = ColumnType<
  Date | null,
  Date | string | null | undefined,
  Date | string | null
>;

export interface DomainsTable {
  key: DomainKey;
  label: string;
  description: string;
  accent: string;
  sort_order: number;
}

export interface UsersTable {
  id: Generated<string>;
  handle: string;
  display_name: string;
  bio: string | null;
  reputation: Generated<number>;
  trust: Generated<number>;
  is_anonymous: Generated<boolean>;
  origin: Generated<Origin>;
  created_at: Timestamp;
}

export interface UserDomainsTable {
  user_id: string;
  domain_key: DomainKey;
  weight: Generated<number>;
}

export interface AuthSessionsTable {
  id: Generated<string>;
  user_id: string;
  token_hash: string;
  created_at: Timestamp;
  expires_at: RequiredTimestamp;
}

export interface SourcesTable {
  id: Generated<string>;
  title: string;
  authors: string[];
  publisher: string;
  publication_date: string | null;
  url: string;
  canonical_url: string;
  source_type: SourceType;
  domain: string;
  reliability: Reliability;
  reliability_note: string | null;
  retrieved_at: Timestamp;
  content_hash: string;
  origin: Generated<Origin>;
  added_by_id: string | null;
  flags: Generated<string[]>;
  created_at: Timestamp;
}

export interface ProblemsTable {
  id: Generated<string>;
  ref: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  why_it_matters: Json<Statement[]>;
  constraints: Json<ProblemConstraints>;
  success_criteria: Json<SuccessCriterion[]>;
  current_knowledge: Json<Statement[]>;
  open_questions: string[];
  geography_label: string;
  geography_scale: GeographicScale;
  country_code: string | null;
  difficulty: number;
  urgency: number;
  status: Generated<ProblemStatus>;
  origin: Generated<Origin>;
  published_by_id: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface ProblemDomainsTable {
  problem_id: string;
  domain_key: DomainKey;
  is_primary: Generated<boolean>;
}

export interface ProblemSourcesTable {
  id: Generated<string>;
  problem_id: string;
  source_id: string;
  role: Generated<string>;
  note: string | null;
  added_by_id: string | null;
  created_at: Timestamp;
}

export interface HypothesesTable {
  id: Generated<string>;
  ref: string;
  problem_id: string;
  author_id: string | null;
  author_agent_role: AgentRole | null;
  title: string;
  claim: string;
  mechanism: string;
  expected_impact: string;
  assumptions: string[];
  unknowns: Generated<string[]>;
  risks: Generated<string[]>;
  estimated_cost: string | null;
  estimated_scalability: string | null;
  validation_method: string;
  status: Generated<HypothesisStatus>;
  epistemic_kind: Generated<'HUMAN_HYPOTHESIS' | 'AI_HYPOTHESIS'>;
  origin: Generated<Origin>;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface HypothesisContributorsTable {
  hypothesis_id: string;
  user_id: string;
  role: Generated<string>;
}

export interface HypothesisEvidenceTable {
  id: Generated<string>;
  hypothesis_id: string;
  source_id: string;
  stance: EvidenceStance;
  claim: string;
  epistemic_kind: Generated<EpistemicKind>;
  strength: Generated<number>;
  added_by_id: string | null;
  added_by_run_id: string | null;
  note: string | null;
  origin: Generated<Origin>;
  created_at: Timestamp;
}

export interface ContributionsTable {
  id: Generated<string>;
  kind: ContributionKind;
  target_type: ContributionTargetType;
  target_id: string;
  problem_id: string;
  author_id: string;
  body: string;
  source_ids: Generated<string[]>;
  score: Generated<number>;
  signals: Json<Record<string, number>>;
  status: Generated<'ACTIVE' | 'WITHDRAWN' | 'FLAGGED'>;
  origin: Generated<Origin>;
  created_at: Timestamp;
}

export interface CommentsTable {
  id: Generated<string>;
  contribution_id: string;
  author_id: string;
  parent_id: string | null;
  body: string;
  origin: Generated<Origin>;
  created_at: Timestamp;
}

export interface EndorsementsTable {
  contribution_id: string;
  user_id: string;
  kind: Generated<string>;
  created_at: Timestamp;
}

export interface AgentsTable {
  role: AgentRole;
  name: string;
  mission: string;
  description: string;
  tools: string[];
  permissions: Json<Record<string, boolean>>;
  enabled: Generated<boolean>;
}

export interface ResearchSessionsTable {
  id: Generated<string>;
  problem_id: string | null;
  hypothesis_id: string | null;
  title: string;
  question: string;
  action: string;
  status: Generated<AgentRunStatus>;
  requested_by_id: string | null;
  brief: Json<ResearchBrief> | null;
  created_at: Timestamp;
  completed_at: NullableTimestamp;
}

export interface ResearchBriefSection {
  heading: string;
  items: {
    statement: string;
    epistemicKind: EpistemicKind;
    confidence: ConfidenceLevel;
    sourceIds: string[];
    reasoning: string;
    unresolved: string | null;
  }[];
}

export interface ResearchBrief {
  question: string;
  generatedAt: string;
  pipeline: { role: AgentRole; runId: string; findingCount: number }[];
  sections: ResearchBriefSection[];
  nextExperiment: string | null;
  openUnknowns: string[];
  disclaimer: string;
}

export interface AgentRunsTable {
  id: Generated<string>;
  agent_role: AgentRole;
  session_id: string | null;
  problem_id: string | null;
  hypothesis_id: string | null;
  action: string;
  status: Generated<AgentRunStatus>;
  provider: string;
  model: string;
  input_digest: string;
  prompt_summary: Generated<string>;
  started_at: Timestamp;
  finished_at: NullableTimestamp;
  duration_ms: number | null;
  tokens_in: number | null;
  tokens_out: number | null;
  error: string | null;
  requested_by_id: string | null;
}

export interface AgentFindingsTable {
  id: Generated<string>;
  run_id: string;
  kind: string;
  statement: string;
  epistemic_kind: EpistemicKind;
  confidence: ConfidenceLevel;
  source_ids: Generated<string[]>;
  reasoning: string;
  unresolved: string | null;
  sort_order: Generated<number>;
  created_at: Timestamp;
}

export interface ValidationsTable {
  id: Generated<string>;
  hypothesis_id: string;
  decision: ValidationDecision;
  criteria: Json<{ criterion: string; met: boolean; note: string | null }[]>;
  rationale: string;
  decided_by_id: string | null;
  decided_at: Timestamp;
  origin: Generated<Origin>;
}

export interface ReputationEventsTable {
  id: Generated<string>;
  user_id: string;
  kind: ReputationEventKind;
  delta: number;
  reason: string;
  problem_id: string | null;
  contribution_id: string | null;
  created_at: Timestamp;
}

export interface RawDocumentsTable {
  id: Generated<string>;
  connector: string;
  external_id: string;
  title: string;
  url: string;
  publisher: string;
  published_at: string | null;
  body: string;
  content_hash: string;
  flags: Generated<string[]>;
  fetched_at: Timestamp;
}

export interface ProblemCandidatesTable {
  id: Generated<string>;
  connector: string;
  raw_document_id: string | null;
  title: string;
  summary: string;
  draft: Json<Record<string, unknown>>;
  proposed_domains: DomainKey[];
  extracted_claims: Json<{ text: string; epistemicKind: EpistemicKind; sourceIds: string[] }[]>;
  source_ids: Generated<string[]>;
  status: Generated<CandidateStatus>;
  curation_score: Generated<number>;
  blocking: Generated<string[]>;
  warnings: Generated<string[]>;
  curator_note: string | null;
  curated_by_id: string | null;
  published_problem_id: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface AuditLogTable {
  id: Generated<string>;
  actor_type: 'USER' | 'AGENT' | 'SYSTEM' | 'ANONYMOUS';
  actor_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Json<Record<string, unknown>>;
  created_at: Timestamp;
}

export interface Database {
  domains: DomainsTable;
  users: UsersTable;
  user_domains: UserDomainsTable;
  auth_sessions: AuthSessionsTable;
  sources: SourcesTable;
  problems: ProblemsTable;
  problem_domains: ProblemDomainsTable;
  problem_sources: ProblemSourcesTable;
  hypotheses: HypothesesTable;
  hypothesis_contributors: HypothesisContributorsTable;
  hypothesis_evidence: HypothesisEvidenceTable;
  contributions: ContributionsTable;
  comments: CommentsTable;
  endorsements: EndorsementsTable;
  agents: AgentsTable;
  research_sessions: ResearchSessionsTable;
  agent_runs: AgentRunsTable;
  agent_findings: AgentFindingsTable;
  validations: ValidationsTable;
  reputation_events: ReputationEventsTable;
  raw_documents: RawDocumentsTable;
  problem_candidates: ProblemCandidatesTable;
  audit_log: AuditLogTable;
}

export type UserRow = Selectable<UsersTable>;
export type NewUser = Insertable<UsersTable>;
export type UserUpdate = Updateable<UsersTable>;

export type ProblemRow = Selectable<ProblemsTable>;
export type NewProblem = Insertable<ProblemsTable>;

export type SourceRow = Selectable<SourcesTable>;
export type NewSource = Insertable<SourcesTable>;

export type HypothesisRow = Selectable<HypothesesTable>;
export type NewHypothesis = Insertable<HypothesesTable>;

export type ContributionRow = Selectable<ContributionsTable>;
export type NewContribution = Insertable<ContributionsTable>;

export type AgentRunRow = Selectable<AgentRunsTable>;
export type AgentFindingRow = Selectable<AgentFindingsTable>;
export type ResearchSessionRow = Selectable<ResearchSessionsTable>;
export type HypothesisEvidenceRow = Selectable<HypothesisEvidenceTable>;
export type ReputationEventRow = Selectable<ReputationEventsTable>;
export type ProblemCandidateRow = Selectable<ProblemCandidatesTable>;
