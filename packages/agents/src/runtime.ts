import { randomUUID } from 'node:crypto';
import { sanitizeUntrusted, sha256Hex, type AgentRole } from '@saveus/common';
import { json, type Db } from '@saveus/db';
import { assertTool, getAgent } from './registry.js';
import type {
  AIProvider,
  AgentContextPayload,
  HypothesisContext,
  ProblemContext,
  SourceContext,
} from './provider/index.js';
import type { ResearchSearchProvider } from './search/types.js';

/**
 * Agent runtime.
 *
 * One place where an agent is allowed to touch the database. It loads the
 * context, enforces the agent's declared tool permissions, calls the provider,
 * validates what comes back, and records the run whether it succeeded or not -
 * a failed agent run is part of the research record, not something to hide.
 */

export interface RunAgentInput {
  db: Db;
  provider: AIProvider;
  search: ResearchSearchProvider;
  role: AgentRole;
  action: string;
  question: string;
  problemId?: string | null;
  hypothesisId?: string | null;
  sessionId?: string | null;
  requestedById?: string | null;
  priorFindings?: AgentContextPayload['priorFindings'];
  /** Reuse a retrieval set instead of searching again. */
  retrieved?: SourceContext[];
}

export interface RunAgentResult {
  runId: string;
  role: AgentRole;
  status: 'SUCCEEDED' | 'FAILED';
  findings: {
    id: string;
    kind: string;
    statement: string;
    epistemicKind: string;
    confidence: string;
    sourceIds: string[];
    reasoning: string;
    unresolved: string | null;
  }[];
  retrieved: SourceContext[];
  provider: string;
  model: string;
  durationMs: number;
  rejectedCitations: string[];
  error: string | null;
}

export async function loadProblemContext(
  db: Db,
  problemId: string,
): Promise<ProblemContext | null> {
  const problem = await db
    .selectFrom('problems')
    .where('id', '=', problemId)
    .selectAll()
    .executeTakeFirst();
  if (!problem) return null;

  const domains = await db
    .selectFrom('problem_domains')
    .where('problem_id', '=', problemId)
    .select('domain_key')
    .execute();

  return {
    id: problem.id,
    ref: problem.ref,
    title: problem.title,
    summary: problem.summary,
    geographyLabel: problem.geography_label,
    domains: domains.map((row) => row.domain_key),
    constraints: problem.constraints as unknown as Record<string, string | null>,
    successCriteria: problem.success_criteria.map((criterion) => ({
      metric: criterion.metric,
      target: criterion.target,
      horizon: criterion.horizon,
    })),
    openQuestions: problem.open_questions,
  };
}

export async function loadHypothesisContext(
  db: Db,
  hypothesisId: string,
): Promise<HypothesisContext | null> {
  const hypothesis = await db
    .selectFrom('hypotheses')
    .where('id', '=', hypothesisId)
    .selectAll()
    .executeTakeFirst();
  if (!hypothesis) return null;

  const evidence = await db
    .selectFrom('hypothesis_evidence')
    .where('hypothesis_id', '=', hypothesisId)
    .select(['source_id', 'stance', 'claim', 'strength'])
    .execute();

  return {
    id: hypothesis.id,
    ref: hypothesis.ref,
    title: hypothesis.title,
    claim: hypothesis.claim,
    mechanism: hypothesis.mechanism,
    expectedImpact: hypothesis.expected_impact,
    assumptions: hypothesis.assumptions,
    unknowns: hypothesis.unknowns,
    risks: hypothesis.risks,
    estimatedCost: hypothesis.estimated_cost,
    estimatedScalability: hypothesis.estimated_scalability,
    validationMethod: hypothesis.validation_method,
    status: hypothesis.status,
    supporting: evidence
      .filter((row) => row.stance === 'SUPPORTS')
      .map((row) => ({ sourceId: row.source_id, claim: row.claim, strength: row.strength })),
    contradicting: evidence
      .filter((row) => row.stance === 'CONTRADICTS')
      .map((row) => ({ sourceId: row.source_id, claim: row.claim, strength: row.strength })),
  };
}

async function retrieveSources(
  db: Db,
  search: ResearchSearchProvider,
  query: string,
  problemId: string | null,
  extraIds: readonly string[],
): Promise<SourceContext[]> {
  const results = await search.search(query, { limit: 8, ...(problemId ? { problemId } : {}) });
  const ids = new Set<string>(extraIds);
  for (const result of results) if (result.sourceId) ids.add(result.sourceId);
  if (ids.size === 0) return [];

  const rows = await db
    .selectFrom('sources')
    .where('id', 'in', [...ids])
    .select([
      'id',
      'title',
      'publisher',
      'publication_date',
      'source_type',
      'reliability',
      'reliability_note',
      'url',
    ])
    .execute();

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    publisher: row.publisher,
    publicationDate: row.publication_date,
    sourceType: row.source_type,
    reliability: row.reliability,
    url: row.url,
    excerpt: row.reliability_note ? sanitizeUntrusted(row.reliability_note, 600).text : null,
  }));
}

export async function runAgent(input: RunAgentInput): Promise<RunAgentResult> {
  const { db, provider, search, role } = input;
  const definition = getAgent(role);
  const startedAt = Date.now();

  const problemId = input.problemId ?? null;
  const hypothesisId = input.hypothesisId ?? null;

  const problem = problemId ? await loadProblemContext(db, problemId) : null;
  const hypothesis = hypothesisId ? await loadHypothesisContext(db, hypothesisId) : null;

  let retrieved: SourceContext[] = input.retrieved ?? [];
  if (retrieved.length === 0 && definition.tools.includes('corpus.search')) {
    assertTool(role, 'corpus.search');
    const attached = hypothesis
      ? [...hypothesis.supporting, ...hypothesis.contradicting].map((entry) => entry.sourceId)
      : [];
    retrieved = await retrieveSources(
      db,
      search,
      [input.question, hypothesis?.claim ?? '', problem?.title ?? ''].join(' '),
      problemId,
      attached,
    );
  }

  const context: AgentContextPayload = {
    question: input.question,
    problem,
    hypothesis,
    retrieved,
    priorFindings: input.priorFindings ?? [],
  };

  const inputDigest = sha256Hex(
    JSON.stringify({
      role,
      action: input.action,
      question: input.question,
      ids: retrieved.map((s) => s.id),
    }),
  );

  const runId = randomUUID();
  await db
    .insertInto('agent_runs')
    .values({
      id: runId,
      agent_role: role,
      session_id: input.sessionId ?? null,
      problem_id: problemId,
      hypothesis_id: hypothesisId,
      action: input.action,
      status: 'RUNNING',
      provider: provider.name,
      model: provider.model,
      input_digest: inputDigest,
      prompt_summary: `${definition.name}: ${definition.mission}`,
      requested_by_id: input.requestedById ?? null,
    })
    .execute();

  try {
    const result = await provider.generate({
      agentRole: role,
      action: input.action,
      instructions: definition.instructions,
      context,
      allowedSourceIds: retrieved.map((source) => source.id),
      maxFindings: definition.permissions.maxFindings,
    });

    if (!definition.permissions.writeFindings && result.findings.length > 0) {
      throw new Error(`Agent ${role} produced findings but is not permitted to write them`);
    }

    const durationMs = Date.now() - startedAt;
    const findingRows = result.findings.map((finding, index) => ({
      id: randomUUID(),
      run_id: runId,
      kind: finding.kind,
      statement: finding.statement,
      epistemic_kind: finding.epistemicKind,
      confidence: finding.confidence,
      source_ids: finding.sourceIds,
      reasoning: finding.reasoning,
      unresolved: finding.unresolved,
      sort_order: index,
    }));

    if (findingRows.length > 0) {
      await db.insertInto('agent_findings').values(findingRows).execute();
    }

    await db
      .updateTable('agent_runs')
      .set({
        status: 'SUCCEEDED',
        finished_at: new Date(),
        duration_ms: durationMs,
        tokens_in: result.tokensIn,
        tokens_out: result.tokensOut,
        error:
          result.rejectedCitations.length > 0
            ? `Rejected ${result.rejectedCitations.length} citation(s) not in the retrieval set`
            : null,
      })
      .where('id', '=', runId)
      .execute();

    await db
      .insertInto('audit_log')
      .values({
        actor_type: 'AGENT',
        actor_id: role,
        action: `agent.${input.action}`,
        target_type: hypothesisId ? 'HYPOTHESIS' : 'PROBLEM',
        target_id: hypothesisId ?? problemId,
        metadata: json({
          runId,
          provider: provider.name,
          model: provider.model,
          findings: findingRows.length,
          rejectedCitations: result.rejectedCitations,
          droppedFindings: result.droppedFindings,
        }),
      })
      .execute();

    return {
      runId,
      role,
      status: 'SUCCEEDED',
      findings: findingRows.map((row) => ({
        id: row.id,
        kind: row.kind,
        statement: row.statement,
        epistemicKind: row.epistemic_kind,
        confidence: row.confidence,
        sourceIds: row.source_ids,
        reasoning: row.reasoning,
        unresolved: row.unresolved,
      })),
      retrieved,
      provider: result.provider,
      model: result.model,
      durationMs,
      rejectedCitations: result.rejectedCitations,
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db
      .updateTable('agent_runs')
      .set({
        status: 'FAILED',
        finished_at: new Date(),
        duration_ms: Date.now() - startedAt,
        error: message.slice(0, 500),
      })
      .where('id', '=', runId)
      .execute();

    return {
      runId,
      role,
      status: 'FAILED',
      findings: [],
      retrieved,
      provider: provider.name,
      model: provider.model,
      durationMs: Date.now() - startedAt,
      rejectedCitations: [],
      error: message,
    };
  }
}
