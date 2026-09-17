import { randomUUID } from 'node:crypto';
import type { AgentRole, ResearchAction } from '@saveus/common';
import { json, type Db, type ResearchBrief, type ResearchBriefSection } from '@saveus/db';
import type { AIProvider } from './provider/index.js';
import type { ResearchSearchProvider } from './search/types.js';
import { runAgent, type RunAgentResult } from './runtime.js';
import type { SourceContext } from './provider/index.js';

/**
 * Research pipelines.
 *
 * Each contextual action on a hypothesis maps to a short, named sequence of
 * narrow agents. The flagship sequence is FULL_REVIEW:
 *
 *   RESEARCHER -> SKEPTIC -> ENGINEER -> SYNTHESIZER
 *
 * retrieve the literature, attack it, confront it with deployment reality,
 * then assemble one structured brief a human can act on. Every step is
 * recorded as its own run with its own findings, so the brief is never a
 * black box.
 */

export const ACTION_PIPELINES: Readonly<Record<ResearchAction, AgentRole[]>> = Object.freeze({
  FIND_EVIDENCE: ['RESEARCHER'],
  FIND_COUNTEREVIDENCE: ['RESEARCHER', 'SKEPTIC'],
  SEARCH_RELATED_RESEARCH: ['RESEARCHER'],
  FIND_EXISTING_SOLUTIONS: ['RESEARCHER', 'ENGINEER'],
  IDENTIFY_ASSUMPTIONS: ['SCIENTIST', 'SKEPTIC'],
  RED_TEAM: ['RED_TEAM', 'SKEPTIC'],
  GENERATE_TEST: ['ENGINEER', 'SIMULATOR'],
  COMPARE_WITH_EXISTING: ['RESEARCHER', 'ECONOMIST'],
  FULL_REVIEW: ['RESEARCHER', 'SKEPTIC', 'ENGINEER', 'SYNTHESIZER'],
});

export const ACTION_LABELS: Readonly<Record<ResearchAction, string>> = Object.freeze({
  FIND_EVIDENCE: 'Find evidence',
  FIND_COUNTEREVIDENCE: 'Find counterevidence',
  SEARCH_RELATED_RESEARCH: 'Search related research',
  FIND_EXISTING_SOLUTIONS: 'Find existing solutions',
  IDENTIFY_ASSUMPTIONS: 'Identify assumptions',
  RED_TEAM: 'Red team this',
  GENERATE_TEST: 'Generate a test',
  COMPARE_WITH_EXISTING: 'Compare with existing approaches',
  FULL_REVIEW: 'Full research review',
});

export const ACTION_DESCRIPTIONS: Readonly<Record<ResearchAction, string>> = Object.freeze({
  FIND_EVIDENCE: 'Retrieve corpus records that bear on the claim.',
  FIND_COUNTEREVIDENCE: 'Retrieve records, then look for what undermines the claim.',
  SEARCH_RELATED_RESEARCH: 'Find adjacent work that may already answer part of this.',
  FIND_EXISTING_SOLUTIONS: 'Look for deployments that already do something like this.',
  IDENTIFY_ASSUMPTIONS: 'Decompose the mechanism and expose what is being assumed.',
  RED_TEAM: 'Construct the conditions under which this fails.',
  GENERATE_TEST: 'Propose how this could be tested, and what model would be needed.',
  COMPARE_WITH_EXISTING: 'Set this against the alternatives, including cost.',
  FULL_REVIEW: 'Retrieve, attack, engineer-check, then synthesise into one brief.',
});

const SECTION_FOR_KIND: Record<string, string> = {
  EVIDENCE: 'Evidence',
  COUNTEREVIDENCE: 'Counterevidence',
  ASSUMPTION: 'Assumptions',
  RISK: 'Risks and weaknesses',
  UNKNOWN: 'Unknowns',
  EXISTING_SOLUTION: 'Existing approaches',
  TEST_DESIGN: 'Suggested next experiment',
  COMPARISON: 'Constraint check',
  SUMMARY: 'Summary',
};

const SECTION_ORDER = [
  'Summary',
  'Evidence',
  'Counterevidence',
  'Assumptions',
  'Risks and weaknesses',
  'Constraint check',
  'Existing approaches',
  'Suggested next experiment',
  'Unknowns',
];

export interface PipelineInput {
  db: Db;
  provider: AIProvider;
  search: ResearchSearchProvider;
  action: ResearchAction;
  question: string;
  hypothesisId?: string | null;
  problemId?: string | null;
  requestedById?: string | null;
}

export interface PipelineResult {
  sessionId: string;
  runs: RunAgentResult[];
  brief: ResearchBrief;
}

export async function runResearchPipeline(input: PipelineInput): Promise<PipelineResult> {
  const roles = ACTION_PIPELINES[input.action];
  const sessionId = randomUUID();

  await input.db
    .insertInto('research_sessions')
    .values({
      id: sessionId,
      problem_id: input.problemId ?? null,
      hypothesis_id: input.hypothesisId ?? null,
      title: ACTION_LABELS[input.action],
      question: input.question,
      action: input.action,
      status: 'RUNNING',
      requested_by_id: input.requestedById ?? null,
    })
    .execute();

  const runs: RunAgentResult[] = [];
  const priorFindings: { role: AgentRole; kind: string; statement: string; confidence: string }[] =
    [];
  let retrieved: SourceContext[] = [];

  for (const role of roles) {
    const result = await runAgent({
      db: input.db,
      provider: input.provider,
      search: input.search,
      role,
      action: input.action,
      question: input.question,
      problemId: input.problemId ?? null,
      hypothesisId: input.hypothesisId ?? null,
      sessionId,
      requestedById: input.requestedById ?? null,
      priorFindings: [...priorFindings],
      // The retrieval set travels down the pipeline so later agents reason
      // about exactly what the researcher found, not a different search.
      retrieved,
    });

    runs.push(result);
    if (retrieved.length === 0 && result.retrieved.length > 0) retrieved = result.retrieved;
    for (const finding of result.findings) {
      priorFindings.push({
        role,
        kind: finding.kind,
        statement: finding.statement,
        confidence: finding.confidence,
      });
    }
  }

  const brief = buildBrief(input.question, runs);

  await input.db
    .updateTable('research_sessions')
    .set({
      status: runs.every((run) => run.status === 'SUCCEEDED') ? 'SUCCEEDED' : 'FAILED',
      brief: json(brief),
      completed_at: new Date(),
    })
    .where('id', '=', sessionId)
    .execute();

  return { sessionId, runs, brief };
}

export function buildBrief(question: string, runs: readonly RunAgentResult[]): ResearchBrief {
  const buckets = new Map<string, ResearchBriefSection['items']>();

  for (const run of runs) {
    for (const finding of run.findings) {
      const heading = SECTION_FOR_KIND[finding.kind] ?? 'Other';
      const items = buckets.get(heading) ?? [];
      items.push({
        statement: finding.statement,
        epistemicKind:
          finding.epistemicKind as ResearchBriefSection['items'][number]['epistemicKind'],
        confidence: finding.confidence as ResearchBriefSection['items'][number]['confidence'],
        sourceIds: finding.sourceIds,
        reasoning: finding.reasoning,
        unresolved: finding.unresolved,
      });
      buckets.set(heading, items);
    }
  }

  const sections: ResearchBriefSection[] = [...buckets.entries()]
    .sort((a, b) => sectionRank(a[0]) - sectionRank(b[0]))
    .map(([heading, items]) => ({ heading, items }));

  const testItems = buckets.get('Suggested next experiment') ?? [];
  const openUnknowns = runs
    .flatMap((run) => run.findings)
    .map((finding) => finding.unresolved)
    .filter((value): value is string => Boolean(value));

  return {
    question,
    generatedAt: new Date().toISOString(),
    pipeline: runs.map((run) => ({
      role: run.role,
      runId: run.runId,
      findingCount: run.findings.length,
    })),
    sections,
    nextExperiment: testItems[0]?.statement ?? null,
    openUnknowns: [...new Set(openUnknowns)].slice(0, 12),
    disclaimer:
      'This brief was assembled by agent runs. Nothing in it is established fact: every item carries its epistemic kind, its confidence and its sources, and citations outside the retrieval set were rejected before this brief was written.',
  };
}

function sectionRank(heading: string): number {
  const index = SECTION_ORDER.indexOf(heading);
  return index === -1 ? SECTION_ORDER.length : index;
}
