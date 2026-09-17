/**
 * Client-side view of the API contract. These mirror the DTOs the services
 * return; the API owns the shape, the web app owns the rendering.
 */
export interface DomainRef {
  key: string;
  label: string;
  accent: string;
  isPrimary: boolean;
}

export interface ProblemCard {
  id: string;
  ref: string;
  slug: string;
  title: string;
  summary: string;
  geographyLabel: string;
  geographyScale: string;
  countryCode: string | null;
  difficulty: number;
  urgency: number;
  status: string;
  origin: string;
  domains: DomainRef[];
  evidenceCount: number;
  hypothesisCount: number;
  researcherCount: number;
  contributionCount: number;
  lastActivityAt: string | null;
  updatedAt: string;
}

export interface Source {
  id: string;
  title: string;
  authors: string[];
  publisher: string;
  publicationDate: string | null;
  url: string;
  sourceType: string;
  domain: string;
  reliability: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  reliabilityNote: string | null;
  retrievedAt: string;
  contentHash: string;
  origin: string;
}

export interface Statement {
  text: string;
  kind: 'FACT' | 'SOURCE_CLAIM' | 'HUMAN_HYPOTHESIS' | 'AI_HYPOTHESIS' | 'INFERENCE' | 'UNKNOWN';
  kindLabel: string;
  sourceIds: string[];
  note: string | null;
}

export interface ProblemDetail extends ProblemCard {
  description: string;
  whyItMatters: Statement[];
  currentKnowledge: Statement[];
  constraints: Record<string, string | null>;
  successCriteria: {
    metric: string;
    target: string;
    horizon: string;
    measurement: string | null;
  }[];
  openQuestions: string[];
  sources: Source[];
  createdAt: string;
}

export interface Author {
  id: string;
  handle: string;
  displayName: string;
  reputation: number;
  tier: string;
  isAnonymous: boolean;
  origin: string;
}

export interface HypothesisSummary {
  id: string;
  ref: string;
  problemId: string;
  title: string;
  claim: string;
  status: string;
  epistemicKind: string;
  origin: string;
  author: Author | null;
  authorAgentRole: string | null;
  supportingCount: number;
  contradictingCount: number;
  contributionCount: number;
  confidence: 'SUPPORTED' | 'PLAUSIBLE' | 'UNCERTAIN' | 'CONTESTED' | 'REFUTED';
  confidenceLabel: string;
  updatedAt: string;
}

export interface Evidence {
  id: string;
  stance: 'SUPPORTS' | 'CONTRADICTS' | 'CONTEXT';
  claim: string;
  epistemicKind: Statement['kind'];
  strength: number;
  note: string | null;
  origin: string;
  createdAt: string;
  source: Source;
  addedBy: Author | null;
  addedByRunId: string | null;
}

export interface HypothesisDetail extends HypothesisSummary {
  mechanism: string;
  expectedImpact: string;
  assumptions: string[];
  unknowns: string[];
  risks: string[];
  estimatedCost: string | null;
  estimatedScalability: string | null;
  validationMethod: string;
  createdAt: string;
  evidence: Evidence[];
  contributors: Author[];
  validation: {
    decision: string;
    rationale: string;
    criteria: { criterion: string; met: boolean; note: string | null }[];
    decidedAt: string;
    decidedBy: Author | null;
  } | null;
  problem: { id: string; ref: string; slug: string; title: string; geographyLabel: string };
}

export interface Contribution {
  id: string;
  kind:
    | 'COMMENT'
    | 'EVIDENCE'
    | 'COUNTERARGUMENT'
    | 'MODIFICATION'
    | 'QUESTION'
    | 'EXPERIMENT'
    | 'RESULT';
  targetType: string;
  targetId: string;
  problemId: string;
  body: string;
  score: number;
  signals: Record<string, number>;
  origin: string;
  createdAt: string;
  author: Author;
  sources: Source[];
  endorsements: number;
  replies: { id: string; body: string; createdAt: string; author: Author }[];
}

export interface AgentFinding {
  id: string;
  kind: string;
  statement: string;
  epistemicKind: Statement['kind'];
  confidence: HypothesisSummary['confidence'];
  reasoning: string;
  unresolved: string | null;
  sources: Source[];
}

export interface AgentRun {
  id: string;
  agentRole: string;
  agentName: string;
  action: string;
  status: string;
  provider: string;
  model: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  tokensIn: number | null;
  tokensOut: number | null;
  error: string | null;
  inputDigest: string;
  findings: AgentFinding[];
}

export interface ResearchBrief {
  question: string;
  generatedAt: string;
  pipeline: { role: string; runId: string; findingCount: number }[];
  sections: {
    heading: string;
    items: {
      statement: string;
      epistemicKind: Statement['kind'];
      confidence: HypothesisSummary['confidence'];
      sourceIds: string[];
      reasoning: string;
      unresolved: string | null;
    }[];
  }[];
  nextExperiment: string | null;
  openUnknowns: string[];
  disclaimer: string;
}

export interface ResearchSession {
  id: string;
  title: string;
  question: string;
  action: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  brief: ResearchBrief | null;
  requestedBy: Author | null;
  hypothesis: { id: string; ref: string; title: string } | null;
  problem: { id: string; ref: string; slug: string; title: string } | null;
  runs: AgentRun[];
}

export interface ResearchActionDef {
  action: string;
  label: string;
  description: string;
  pipeline: { role: string; name: string; mission: string }[];
}

export interface PlatformStats {
  activeProblems: number;
  activeResearchers: number;
  hypotheses: number;
  validatedContributions: number;
  sources: number;
  agentRuns: number;
}

export interface Meta {
  stats: PlatformStats;
  domains: { key: string; label: string; description: string; accent: string }[];
  epistemicKinds: {
    kind: Statement['kind'];
    label: string;
    short: string;
    definition: string;
    requiresSource: boolean;
  }[];
  confidenceLevels: { level: string; label: string; definition: string; rank: number }[];
  hypothesisStatuses: string[];
  reputationTiers: { key: string; label: string; min: number }[];
  scoringWeights: Record<string, number>;
  researchActions: ResearchActionDef[];
  agents: {
    role: string;
    name: string;
    mission: string;
    description: string;
    tools: string[];
    permissions: Record<string, unknown>;
  }[];
  ai: { provider: string; model: string };
}

export interface SessionUser {
  id: string;
  handle: string;
  displayName: string;
  reputation: number;
  trust: number;
  isAnonymous: boolean;
}

/* ------------------------------------------------------------------ */
/* Intake                                                              */
/* ------------------------------------------------------------------ */

export interface IntakeAssessmentView {
  verdict: 'ACCEPT' | 'WEAK' | 'REJECT';
  score: number;
  code: string | null;
  matched: string[];
  reasons: string[];
}

export interface CandidateDraftView {
  title: string;
  summary: string;
  description: string;
  whyItMatters: { text: string; sourceIds: string[] }[];
  openQuestions: string[];
}

export interface IntakeCandidate {
  id: string;
  connector: string;
  title: string;
  summary: string;
  status: string;
  curationScore: number;
  relevanceScore: number;
  assessment: IntakeAssessmentView | null;
  blocking: string[];
  warnings: string[];
  proposedDomains: string[];
  extractedClaims: { text: string; epistemicKind: string; sourceIds: string[] }[];
  draft: CandidateDraftView | null;
  sources: Source[];
  curatorHandle: string | null;
  curatorNote: string | null;
  publishedSlug: string | null;
  createdAt: string;
}

export interface IngestionRun {
  id: string;
  connector: string;
  trigger: string;
  startedAt: string;
  finishedAt: string | null;
  fetched: number;
  accepted: number;
  weak: number;
  rejected: number;
  duplicates: number;
  candidates: number;
  deferred: number;
  flagged: number;
  rejectionReasons: Record<string, number>;
  error: string | null;
}

export interface RejectedDocument {
  id: string;
  connector: string;
  title: string;
  url: string;
  publisher: string;
  publishedAt: string | null;
  score: number;
  code: string | null;
  reasons: string[];
  fetchedAt: string;
}

/* ------------------------------------------------------------------ */
/* Courses                                                             */
/* ------------------------------------------------------------------ */

export type LessonBlockView =
  | { kind: 'PROSE'; text: string }
  | {
      kind: 'STATEMENT';
      text: string;
      epistemicKind: Statement['kind'];
      kindLabel: string;
      sources: Source[];
    }
  | { kind: 'CALLOUT'; title: string; text: string }
  | {
      kind: 'COMPARE';
      caption: string;
      wrong: { label: string; text: string };
      right: { label: string; text: string };
    }
  | { kind: 'CHECKLIST'; title: string; items: string[] };

export interface CourseSummary {
  id: string;
  slug: string;
  title: string;
  summary: string;
  outcome: string;
  track: string;
  domainKey: string | null;
  estimatedMinutes: number;
  lessonCount: number;
  completedCount: number;
}

export interface LessonSummary {
  id: string;
  slug: string;
  title: string;
  hook: string;
  minutes: number;
  completedAt: string | null;
}

export interface CourseDetail extends CourseSummary {
  lessons: LessonSummary[];
}

export interface LessonQuestion {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface LessonDetail {
  id: string;
  slug: string;
  title: string;
  hook: string;
  minutes: number;
  blocks: LessonBlockView[];
  questions: LessonQuestion[];
  problems: {
    ref: string;
    slug: string;
    title: string;
    summary: string;
    difficulty: number;
    urgency: number;
  }[];
  completedAt: string | null;
  answers: number[];
  course: { slug: string; title: string; track: string };
  previous: { slug: string; title: string } | null;
  next: { slug: string; title: string } | null;
}

export interface LearningProgress {
  lessonsCompleted: number;
  lessonsTotal: number;
  coursesCompleted: number;
  coursesTotal: number;
  nextLesson: { courseSlug: string; courseTitle: string; slug: string; title: string } | null;
}
