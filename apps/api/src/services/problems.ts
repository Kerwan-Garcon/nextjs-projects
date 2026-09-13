import { AppError, type ProblemFilterInput } from '@saveus/common';
import { sql, type Db } from '@saveus/db';
import { loadSources, toStatement, type SourceDto, type StatementDto } from './serializers.js';

/**
 * Problem read model.
 *
 * The board needs aggregate activity per problem (evidence, researchers,
 * hypotheses) and the detail page needs the whole record with its sources
 * resolved. Both are assembled here rather than in route handlers.
 */

export interface ProblemCardDto {
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
  domains: { key: string; label: string; accent: string; isPrimary: boolean }[];
  evidenceCount: number;
  hypothesisCount: number;
  researcherCount: number;
  contributionCount: number;
  lastActivityAt: string | null;
  updatedAt: string;
}

interface AggregateRow {
  id: string;
  ref: string;
  slug: string;
  title: string;
  summary: string;
  geography_label: string;
  geography_scale: string;
  country_code: string | null;
  difficulty: number;
  urgency: number;
  status: string;
  origin: string;
  updated_at: Date;
  evidence_count: number;
  hypothesis_count: number;
  researcher_count: number;
  contribution_count: number;
  last_activity_at: Date | null;
  domain_keys: string[] | null;
  primary_domain: string | null;
}

/**
 * One query with correlated subqueries. Kept as raw SQL because the aggregate
 * shape is the point, and hand-rolling it in the builder would obscure it.
 */
function aggregateSelect() {
  return sql<AggregateRow>`
    SELECT p.id, p.ref, p.slug, p.title, p.summary, p.geography_label, p.geography_scale,
           p.country_code, p.difficulty, p.urgency, p.status, p.origin, p.updated_at,
           (SELECT count(*) FROM problem_sources ps WHERE ps.problem_id = p.id)::int AS evidence_count,
           (SELECT count(*) FROM hypotheses h WHERE h.problem_id = p.id)::int AS hypothesis_count,
           (SELECT count(DISTINCT c.author_id) FROM contributions c WHERE c.problem_id = p.id)::int AS researcher_count,
           (SELECT count(*) FROM contributions c WHERE c.problem_id = p.id)::int AS contribution_count,
           (SELECT max(c.created_at) FROM contributions c WHERE c.problem_id = p.id) AS last_activity_at,
           (SELECT array_agg(pd.domain_key ORDER BY pd.is_primary DESC) FROM problem_domains pd WHERE pd.problem_id = p.id) AS domain_keys,
           (SELECT pd.domain_key FROM problem_domains pd WHERE pd.problem_id = p.id AND pd.is_primary LIMIT 1) AS primary_domain
    FROM problems p
  `;
}

export interface ProblemListResult {
  problems: ProblemCardDto[];
  total: number;
}

export async function listProblems(db: Db, filter: ProblemFilterInput): Promise<ProblemListResult> {
  const domainLabels = await loadDomainLabels(db);

  const conditions: ReturnType<typeof sql>[] = [sql`p.status <> 'ARCHIVED'`];
  if (filter.domain) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM problem_domains pd WHERE pd.problem_id = p.id AND pd.domain_key = ${filter.domain})`,
    );
  }
  if (filter.status) conditions.push(sql`p.status = ${filter.status}`);
  if (filter.scale) conditions.push(sql`p.geography_scale = ${filter.scale}`);
  if (filter.country) conditions.push(sql`p.country_code = ${filter.country.toUpperCase()}`);
  if (filter.minDifficulty !== undefined)
    conditions.push(sql`p.difficulty >= ${filter.minDifficulty}`);
  if (filter.maxDifficulty !== undefined)
    conditions.push(sql`p.difficulty <= ${filter.maxDifficulty}`);
  if (filter.minUrgency !== undefined) conditions.push(sql`p.urgency >= ${filter.minUrgency}`);
  if (filter.q) {
    const pattern = `%${filter.q.toLowerCase()}%`;
    conditions.push(
      sql`(lower(p.title) LIKE ${pattern} OR lower(p.summary) LIKE ${pattern} OR lower(p.geography_label) LIKE ${pattern})`,
    );
  }

  const where = conditions.reduce((acc, condition, index) =>
    index === 0 ? condition : sql`${acc} AND ${condition}`,
  );

  const order = {
    urgency: sql`p.urgency DESC, p.difficulty DESC`,
    difficulty: sql`p.difficulty DESC, p.urgency DESC`,
    activity: sql`last_activity_at DESC NULLS LAST`,
    recent: sql`p.created_at DESC`,
  }[filter.sort];

  const rows = await sql<AggregateRow>`
    ${aggregateSelect()} WHERE ${where} ORDER BY ${order} LIMIT ${filter.limit} OFFSET ${filter.offset}
  `.execute(db);

  const totalRow = await sql<{ count: number }>`
    SELECT count(*)::int AS count FROM problems p WHERE ${where}
  `.execute(db);

  return {
    problems: rows.rows.map((row) => toProblemCard(row, domainLabels)),
    total: totalRow.rows[0]?.count ?? 0,
  };
}

export interface ProblemDetailDto extends ProblemCardDto {
  description: string;
  whyItMatters: StatementDto[];
  currentKnowledge: StatementDto[];
  constraints: Record<string, string | null>;
  successCriteria: {
    metric: string;
    target: string;
    horizon: string;
    measurement: string | null;
  }[];
  openQuestions: string[];
  sources: SourceDto[];
  createdAt: string;
}

export async function getProblem(db: Db, idOrSlug: string): Promise<ProblemDetailDto> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
  const matcher = isUuid
    ? sql`p.id = ${idOrSlug}`
    : sql`(p.slug = ${idOrSlug} OR p.ref = ${idOrSlug})`;

  const rows = await sql<AggregateRow>`${aggregateSelect()} WHERE ${matcher} LIMIT 1`.execute(db);
  const aggregate = rows.rows[0];
  if (!aggregate) throw AppError.notFound('Problem');

  const [full, domainLabels] = await Promise.all([
    db.selectFrom('problems').where('id', '=', aggregate.id).selectAll().executeTakeFirstOrThrow(),
    loadDomainLabels(db),
  ]);

  const sourceLinks = await db
    .selectFrom('problem_sources')
    .where('problem_id', '=', aggregate.id)
    .select('source_id')
    .execute();
  const sources = await loadSources(
    db,
    sourceLinks.map((link) => link.source_id),
  );

  return {
    ...toProblemCard(aggregate, domainLabels),
    description: full.description,
    whyItMatters: full.why_it_matters.map(toStatement),
    currentKnowledge: full.current_knowledge.map(toStatement),
    constraints: full.constraints as unknown as Record<string, string | null>,
    successCriteria: full.success_criteria.map((criterion) => ({
      metric: criterion.metric,
      target: criterion.target,
      horizon: criterion.horizon,
      measurement: criterion.measurement ?? null,
    })),
    openQuestions: full.open_questions,
    sources,
    createdAt: full.created_at.toISOString(),
  };
}

export interface PlatformStats {
  activeProblems: number;
  activeResearchers: number;
  hypotheses: number;
  validatedContributions: number;
  sources: number;
  agentRuns: number;
}

export async function platformStats(db: Db): Promise<PlatformStats> {
  const row = await sql<PlatformStats>`
    SELECT
      (SELECT count(*) FROM problems WHERE status <> 'ARCHIVED')::int AS "activeProblems",
      (SELECT count(DISTINCT author_id) FROM contributions)::int AS "activeResearchers",
      (SELECT count(*) FROM hypotheses)::int AS "hypotheses",
      (SELECT count(*) FROM validations WHERE decision = 'VALIDATED')::int AS "validatedContributions",
      (SELECT count(*) FROM sources)::int AS "sources",
      (SELECT count(*) FROM agent_runs)::int AS "agentRuns"
  `.execute(db);

  return (
    row.rows[0] ?? {
      activeProblems: 0,
      activeResearchers: 0,
      hypotheses: 0,
      validatedContributions: 0,
      sources: 0,
      agentRuns: 0,
    }
  );
}

export async function loadDomainLabels(
  db: Db,
): Promise<Map<string, { label: string; accent: string }>> {
  const rows = await db.selectFrom('domains').select(['key', 'label', 'accent']).execute();
  return new Map(rows.map((row) => [row.key, { label: row.label, accent: row.accent }]));
}

function toProblemCard(
  row: AggregateRow,
  domainLabels: Map<string, { label: string; accent: string }>,
): ProblemCardDto {
  const keys = [...new Set(row.domain_keys ?? [])];
  return {
    id: row.id,
    ref: row.ref,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    geographyLabel: row.geography_label,
    geographyScale: row.geography_scale,
    countryCode: row.country_code,
    difficulty: row.difficulty,
    urgency: row.urgency,
    status: row.status,
    origin: row.origin,
    domains: keys.map((key) => ({
      key,
      label: domainLabels.get(key)?.label ?? key.toUpperCase(),
      accent: domainLabels.get(key)?.accent ?? '#6E7681',
      isPrimary: key === row.primary_domain,
    })),
    evidenceCount: row.evidence_count,
    hypothesisCount: row.hypothesis_count,
    researcherCount: row.researcher_count,
    contributionCount: row.contribution_count,
    lastActivityAt: row.last_activity_at ? row.last_activity_at.toISOString() : null,
    updatedAt: row.updated_at.toISOString(),
  };
}
