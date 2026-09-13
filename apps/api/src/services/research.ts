import {
  ACTION_DESCRIPTIONS,
  ACTION_LABELS,
  ACTION_PIPELINES,
  AGENT_LIST,
  runResearchPipeline,
  type AIProvider,
  type ResearchSearchProvider,
} from '@saveus/agents';
import { AppError, type ResearchAction } from '@saveus/common';
import type { Db, ResearchBrief } from '@saveus/db';
import { loadSources, toAuthor, type AuthorDto, type SourceDto } from './serializers.js';

/**
 * Research sessions and agent runs.
 *
 * Every AI action in the product goes through here, and every one of them
 * produces a durable, inspectable record: which agent, which model, what it
 * retrieved, what it concluded, how confident, and what it could not resolve.
 */

export interface ResearchActionDto {
  action: ResearchAction;
  label: string;
  description: string;
  pipeline: { role: string; name: string; mission: string }[];
}

export function researchActions(): ResearchActionDto[] {
  return (Object.keys(ACTION_PIPELINES) as ResearchAction[]).map((action) => ({
    action,
    label: ACTION_LABELS[action],
    description: ACTION_DESCRIPTIONS[action],
    pipeline: ACTION_PIPELINES[action].map((role) => {
      const agent = AGENT_LIST.find((entry) => entry.role === role);
      return { role, name: agent?.name ?? role, mission: agent?.mission ?? '' };
    }),
  }));
}

export interface AgentFindingDto {
  id: string;
  kind: string;
  statement: string;
  epistemicKind: string;
  confidence: string;
  reasoning: string;
  unresolved: string | null;
  sources: SourceDto[];
}

export interface AgentRunDto {
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
  findings: AgentFindingDto[];
}

export interface ResearchSessionDto {
  id: string;
  title: string;
  question: string;
  action: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  brief: ResearchBrief | null;
  requestedBy: AuthorDto | null;
  hypothesis: { id: string; ref: string; title: string } | null;
  problem: { id: string; ref: string; slug: string; title: string } | null;
  runs: AgentRunDto[];
}

export async function runResearch(input: {
  db: Db;
  provider: AIProvider;
  search: ResearchSearchProvider;
  action: ResearchAction;
  question: string;
  hypothesisId?: string | null;
  problemId?: string | null;
  requestedById: string | null;
}): Promise<ResearchSessionDto> {
  let problemId = input.problemId ?? null;

  if (input.hypothesisId) {
    const hypothesis = await input.db
      .selectFrom('hypotheses')
      .where('id', '=', input.hypothesisId)
      .select(['problem_id'])
      .executeTakeFirst();
    if (!hypothesis) throw AppError.notFound('Hypothesis');
    problemId = hypothesis.problem_id;
  } else if (problemId) {
    const problem = await input.db
      .selectFrom('problems')
      .where('id', '=', problemId)
      .select('id')
      .executeTakeFirst();
    if (!problem) throw AppError.notFound('Problem');
  } else {
    throw AppError.validation('A research action must target a hypothesis or a problem');
  }

  const result = await runResearchPipeline({
    db: input.db,
    provider: input.provider,
    search: input.search,
    action: input.action,
    question: input.question,
    hypothesisId: input.hypothesisId ?? null,
    problemId,
    requestedById: input.requestedById,
  });

  return getSession(input.db, result.sessionId);
}

export async function getSession(db: Db, sessionId: string): Promise<ResearchSessionDto> {
  const session = await db
    .selectFrom('research_sessions as rs')
    .leftJoin('users as u', 'u.id', 'rs.requested_by_id')
    .where('rs.id', '=', sessionId)
    .selectAll('rs')
    .select([
      'u.id as user_id',
      'u.handle',
      'u.display_name',
      'u.reputation',
      'u.is_anonymous',
      'u.origin as user_origin',
    ])
    .executeTakeFirst();
  if (!session) throw AppError.notFound('Research session');

  const runs = await listRuns(db, { sessionId });

  const hypothesis = session.hypothesis_id
    ? await db
        .selectFrom('hypotheses')
        .where('id', '=', session.hypothesis_id)
        .select(['id', 'ref', 'title'])
        .executeTakeFirst()
    : undefined;

  const problem = session.problem_id
    ? await db
        .selectFrom('problems')
        .where('id', '=', session.problem_id)
        .select(['id', 'ref', 'slug', 'title'])
        .executeTakeFirst()
    : undefined;

  return {
    id: session.id,
    title: session.title,
    question: session.question,
    action: session.action,
    status: session.status,
    createdAt: session.created_at.toISOString(),
    completedAt: session.completed_at ? session.completed_at.toISOString() : null,
    brief: session.brief,
    requestedBy:
      session.user_id && session.handle
        ? toAuthor({
            id: session.user_id,
            handle: session.handle,
            display_name: session.display_name as string,
            reputation: session.reputation as number,
            is_anonymous: session.is_anonymous as boolean,
            origin: session.user_origin as string,
          })
        : null,
    hypothesis: hypothesis ?? null,
    problem: problem ?? null,
    runs,
  };
}

export async function listRuns(
  db: Db,
  filter: { sessionId?: string; hypothesisId?: string; problemId?: string; limit?: number },
): Promise<AgentRunDto[]> {
  let query = db.selectFrom('agent_runs').selectAll().orderBy('started_at', 'asc');
  if (filter.sessionId) query = query.where('session_id', '=', filter.sessionId);
  if (filter.hypothesisId) query = query.where('hypothesis_id', '=', filter.hypothesisId);
  if (filter.problemId) query = query.where('problem_id', '=', filter.problemId);
  if (filter.limit) query = query.limit(filter.limit);

  const runs = await query.execute();
  if (runs.length === 0) return [];

  const findings = await db
    .selectFrom('agent_findings')
    .where(
      'run_id',
      'in',
      runs.map((run) => run.id),
    )
    .selectAll()
    .orderBy('sort_order', 'asc')
    .execute();

  const sources = await loadSources(
    db,
    findings.flatMap((finding) => finding.source_ids),
  );
  const sourceById = new Map(sources.map((source) => [source.id, source]));

  return runs.map((run) => ({
    id: run.id,
    agentRole: run.agent_role,
    agentName: AGENT_LIST.find((agent) => agent.role === run.agent_role)?.name ?? run.agent_role,
    action: run.action,
    status: run.status,
    provider: run.provider,
    model: run.model,
    startedAt: run.started_at.toISOString(),
    finishedAt: run.finished_at ? run.finished_at.toISOString() : null,
    durationMs: run.duration_ms,
    tokensIn: run.tokens_in,
    tokensOut: run.tokens_out,
    error: run.error,
    inputDigest: run.input_digest.slice(0, 12),
    findings: findings
      .filter((finding) => finding.run_id === run.id)
      .map((finding) => ({
        id: finding.id,
        kind: finding.kind,
        statement: finding.statement,
        epistemicKind: finding.epistemic_kind,
        confidence: finding.confidence,
        reasoning: finding.reasoning,
        unresolved: finding.unresolved,
        sources: finding.source_ids
          .map((id) => sourceById.get(id))
          .filter((source): source is SourceDto => Boolean(source)),
      })),
  }));
}

export async function listSessions(
  db: Db,
  filter: { hypothesisId?: string; problemId?: string; limit?: number } = {},
): Promise<ResearchSessionDto[]> {
  let query = db.selectFrom('research_sessions').select('id').orderBy('created_at', 'desc');
  if (filter.hypothesisId) query = query.where('hypothesis_id', '=', filter.hypothesisId);
  if (filter.problemId) query = query.where('problem_id', '=', filter.problemId);
  query = query.limit(filter.limit ?? 20);

  const rows = await query.execute();
  return Promise.all(rows.map((row) => getSession(db, row.id)));
}

export function agentRegistry(): {
  role: string;
  name: string;
  mission: string;
  description: string;
  tools: string[];
  permissions: Record<string, unknown>;
}[] {
  return AGENT_LIST.map((agent) => ({
    role: agent.role,
    name: agent.name,
    mission: agent.mission,
    description: agent.description,
    tools: [...agent.tools],
    permissions: { ...agent.permissions },
  }));
}
