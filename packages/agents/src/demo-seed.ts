import type { ResearchAction } from '@saveus/common';
import type { Db } from '@saveus/db';
import { DeterministicProvider, type AIProvider } from './provider/index.js';
import { CorpusSearchProvider, ProblemScopedSearchProvider } from './search/corpus.js';
import { runResearchPipeline } from './pipeline.js';
import { runIngestion } from './ingestion/pipeline.js';
import { resolveConnectors } from './ingestion/registry.js';

/**
 * Research seeding.
 *
 * The agent runs that ship with the demo database are not hand-written rows -
 * they are produced by actually executing the pipeline against the seeded
 * corpus. That keeps the promise the rest of the system makes: every finding on
 * screen was computed from records that are in the database, by an agent whose
 * permissions are recorded, in a run you can open.
 */

const DEMO_RUNS: { hypothesisRef: string; action: ResearchAction; question: string }[] = [
  {
    hypothesisRef: '010401',
    action: 'FULL_REVIEW',
    question: 'Could reflective roofs significantly reduce heat mortality in Paris?',
  },
  {
    hypothesisRef: '010404',
    action: 'FIND_COUNTEREVIDENCE',
    question:
      'What undermines the claim that hydrogen is the only option for multi-day European shortfalls?',
  },
  {
    hypothesisRef: '010407',
    action: 'FIND_EVIDENCE',
    question: 'What evidence bears on calcined clay replacing a third of clinker?',
  },
  {
    hypothesisRef: '010440',
    action: 'COMPARE_WITH_EXISTING',
    question: 'How does physical speed reduction compare with enforcement on cost per life saved?',
  },
  {
    hypothesisRef: '010424',
    action: 'RED_TEAM',
    question: 'Under what conditions does restricting citations to a retrieval set fail?',
  },
];

export interface DemoResearchSummary {
  sessions: number;
  runs: number;
  findings: number;
  candidates: number;
}

export async function seedDemoResearch(
  db: Db,
  provider: AIProvider = new DeterministicProvider(),
): Promise<DemoResearchSummary> {
  const search = new ProblemScopedSearchProvider(db, new CorpusSearchProvider(db));
  const summary: DemoResearchSummary = { sessions: 0, runs: 0, findings: 0, candidates: 0 };

  const curator = await db
    .selectFrom('users')
    .where('handle', '=', 'curator-01')
    .select('id')
    .executeTakeFirst();

  for (const demo of DEMO_RUNS) {
    const hypothesis = await db
      .selectFrom('hypotheses')
      .where('ref', '=', demo.hypothesisRef)
      .select(['id', 'problem_id'])
      .executeTakeFirst();
    if (!hypothesis) continue;

    const result = await runResearchPipeline({
      db,
      provider,
      search,
      action: demo.action,
      question: demo.question,
      hypothesisId: hypothesis.id,
      problemId: hypothesis.problem_id,
      requestedById: curator?.id ?? null,
    });

    summary.sessions += 1;
    summary.runs += result.runs.length;
    summary.findings += result.runs.reduce((total, run) => total + run.findings.length, 0);
  }

  const ingestion = await runIngestion({ db, connectors: resolveConnectors(db), trigger: 'SEED' });
  summary.candidates = ingestion.reduce((total, stat) => total + stat.candidates, 0);

  return summary;
}
