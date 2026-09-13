import { AppError, progressToNextTier, tierFor, nextTierFor } from '@saveus/common';
import { sql, type Db } from '@saveus/db';

/**
 * Researcher profiles and leaderboards.
 *
 * The leaderboard is ordered by recorded reputation events, which are ordered
 * by contribution quality rather than by count - so the ranking is an artefact
 * of the scoring engine and can be audited by reading the events.
 */

export interface LeaderboardEntry {
  rank: number;
  handle: string;
  displayName: string;
  reputation: number;
  tier: string;
  isAnonymous: boolean;
  origin: string;
  contributions: number;
  evidenceAdded: number;
  domains: string[];
}

export type LeaderboardScope = 'global' | 'weekly' | 'domain' | 'problem';

export async function leaderboard(
  db: Db,
  options: { scope: LeaderboardScope; domain?: string; problemId?: string; limit?: number },
): Promise<LeaderboardEntry[]> {
  const limit = options.limit ?? 20;

  const conditions: ReturnType<typeof sql>[] = [];
  if (options.scope === 'weekly') conditions.push(sql`re.created_at > now() - interval '7 days'`);
  if (options.scope === 'problem' && options.problemId) {
    conditions.push(sql`re.problem_id = ${options.problemId}`);
  }
  if (options.scope === 'domain' && options.domain) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM problem_domains pd WHERE pd.problem_id = re.problem_id AND pd.domain_key = ${options.domain})`,
    );
  }

  const where =
    conditions.length === 0
      ? sql`TRUE`
      : conditions.reduce((acc, condition, index) =>
          index === 0 ? condition : sql`${acc} AND ${condition}`,
        );

  const rows = await sql<{
    handle: string;
    display_name: string;
    score: number;
    reputation: number;
    is_anonymous: boolean;
    origin: string;
    contributions: number;
    evidence_added: number;
    domains: string[] | null;
  }>`
    SELECT u.handle, u.display_name, u.reputation, u.is_anonymous, u.origin,
           SUM(re.delta)::int AS score,
           (SELECT count(*) FROM contributions c WHERE c.author_id = u.id)::int AS contributions,
           (SELECT count(*) FROM hypothesis_evidence he WHERE he.added_by_id = u.id)::int AS evidence_added,
           (SELECT array_agg(DISTINCT ud.domain_key) FROM user_domains ud WHERE ud.user_id = u.id) AS domains
    FROM reputation_events re
    JOIN users u ON u.id = re.user_id
    WHERE ${where}
    GROUP BY u.id
    HAVING SUM(re.delta) > 0
    ORDER BY score DESC, contributions ASC
    LIMIT ${limit}
  `.execute(db);

  return rows.rows.map((row, index) => ({
    rank: index + 1,
    handle: row.handle,
    displayName: row.display_name,
    reputation: options.scope === 'global' ? row.reputation : row.score,
    tier: tierFor(row.reputation).label,
    isAnonymous: row.is_anonymous,
    origin: row.origin,
    contributions: row.contributions,
    evidenceAdded: row.evidence_added,
    domains: row.domains ?? [],
  }));
}

export interface TopProblemEntry {
  id: string;
  ref: string;
  slug: string;
  title: string;
  geographyLabel: string;
  activity: number;
  researchers: number;
  hypotheses: number;
}

export async function topProblems(db: Db, limit = 8): Promise<TopProblemEntry[]> {
  const rows = await sql<{
    id: string;
    ref: string;
    slug: string;
    title: string;
    geography_label: string;
    activity: number;
    researchers: number;
    hypotheses: number;
  }>`
    SELECT p.id, p.ref, p.slug, p.title, p.geography_label,
           (SELECT count(*) FROM contributions c WHERE c.problem_id = p.id AND c.created_at > now() - interval '90 days')::int AS activity,
           (SELECT count(DISTINCT c.author_id) FROM contributions c WHERE c.problem_id = p.id)::int AS researchers,
           (SELECT count(*) FROM hypotheses h WHERE h.problem_id = p.id)::int AS hypotheses
    FROM problems p
    WHERE p.status <> 'ARCHIVED'
    ORDER BY activity DESC, researchers DESC
    LIMIT ${limit}
  `.execute(db);

  return rows.rows.map((row) => ({
    id: row.id,
    ref: row.ref,
    slug: row.slug,
    title: row.title,
    geographyLabel: row.geography_label,
    activity: row.activity,
    researchers: row.researchers,
    hypotheses: row.hypotheses,
  }));
}

export interface BreakthroughEntry {
  hypothesisId: string;
  ref: string;
  title: string;
  decision: string;
  decidedAt: string;
  problemTitle: string;
  problemSlug: string;
}

/** Validations, in both directions: a well-reasoned rejection is a result. */
export async function recentBreakthroughs(db: Db, limit = 6): Promise<BreakthroughEntry[]> {
  const rows = await db
    .selectFrom('validations as v')
    .innerJoin('hypotheses as h', 'h.id', 'v.hypothesis_id')
    .innerJoin('problems as p', 'p.id', 'h.problem_id')
    .select([
      'h.id as hypothesis_id',
      'h.ref',
      'h.title',
      'v.decision',
      'v.decided_at',
      'p.title as problem_title',
      'p.slug as problem_slug',
    ])
    .orderBy('v.decided_at', 'desc')
    .limit(limit)
    .execute();

  return rows.map((row) => ({
    hypothesisId: row.hypothesis_id,
    ref: row.ref,
    title: row.title,
    decision: row.decision,
    decidedAt: row.decided_at.toISOString(),
    problemTitle: row.problem_title,
    problemSlug: row.problem_slug,
  }));
}

export interface ProfileDto {
  handle: string;
  displayName: string;
  bio: string | null;
  reputation: number;
  tier: string;
  nextTier: string | null;
  tierProgress: number;
  trust: number;
  isAnonymous: boolean;
  origin: string;
  joinedAt: string;
  domains: string[];
  stats: {
    problems: number;
    hypotheses: number;
    evidence: number;
    contributions: number;
    validated: number;
    endorsementsReceived: number;
  };
  collaborators: { handle: string; displayName: string; sharedProblems: number }[];
  history: {
    id: string;
    kind: string;
    delta: number;
    reason: string;
    createdAt: string;
    problemSlug: string | null;
    problemTitle: string | null;
  }[];
  problems: { id: string; ref: string; slug: string; title: string; contributions: number }[];
}

export async function getProfile(db: Db, handle: string): Promise<ProfileDto> {
  const user = await db
    .selectFrom('users')
    .where('handle', '=', handle)
    .selectAll()
    .executeTakeFirst();
  if (!user) throw AppError.notFound('Researcher');

  const [domains, stats, history, problems, collaborators] = await Promise.all([
    db.selectFrom('user_domains').where('user_id', '=', user.id).select('domain_key').execute(),
    sql<{
      problems: number;
      hypotheses: number;
      evidence: number;
      contributions: number;
      validated: number;
      endorsements: number;
    }>`
      SELECT
        (SELECT count(DISTINCT problem_id) FROM contributions WHERE author_id = ${user.id})::int AS problems,
        (SELECT count(*) FROM hypotheses WHERE author_id = ${user.id})::int AS hypotheses,
        (SELECT count(*) FROM hypothesis_evidence WHERE added_by_id = ${user.id})::int AS evidence,
        (SELECT count(*) FROM contributions WHERE author_id = ${user.id})::int AS contributions,
        (SELECT count(*) FROM validations v JOIN hypotheses h ON h.id = v.hypothesis_id
          WHERE h.author_id = ${user.id} AND v.decision = 'VALIDATED')::int AS validated,
        (SELECT count(*) FROM endorsements e JOIN contributions c ON c.id = e.contribution_id
          WHERE c.author_id = ${user.id})::int AS endorsements
    `.execute(db),
    db
      .selectFrom('reputation_events as re')
      .leftJoin('problems as p', 'p.id', 're.problem_id')
      .where('re.user_id', '=', user.id)
      .select(['re.id', 're.kind', 're.delta', 're.reason', 're.created_at', 'p.slug', 'p.title'])
      .orderBy('re.created_at', 'desc')
      .limit(25)
      .execute(),
    sql<{ id: string; ref: string; slug: string; title: string; contributions: number }>`
      SELECT p.id, p.ref, p.slug, p.title, count(c.id)::int AS contributions
      FROM contributions c JOIN problems p ON p.id = c.problem_id
      WHERE c.author_id = ${user.id}
      GROUP BY p.id ORDER BY contributions DESC LIMIT 12
    `.execute(db),
    sql<{ handle: string; display_name: string; shared: number }>`
      SELECT u.handle, u.display_name, count(DISTINCT c2.problem_id)::int AS shared
      FROM contributions c1
      JOIN contributions c2 ON c2.problem_id = c1.problem_id AND c2.author_id <> c1.author_id
      JOIN users u ON u.id = c2.author_id
      WHERE c1.author_id = ${user.id}
      GROUP BY u.id ORDER BY shared DESC LIMIT 6
    `.execute(db),
  ]);

  const statRow = stats.rows[0];

  return {
    handle: user.handle,
    displayName: user.display_name,
    bio: user.bio,
    reputation: user.reputation,
    tier: tierFor(user.reputation).label,
    nextTier: nextTierFor(user.reputation)?.label ?? null,
    tierProgress: progressToNextTier(user.reputation),
    trust: user.trust,
    isAnonymous: user.is_anonymous,
    origin: user.origin,
    joinedAt: user.created_at.toISOString(),
    domains: domains.map((row) => row.domain_key),
    stats: {
      problems: statRow?.problems ?? 0,
      hypotheses: statRow?.hypotheses ?? 0,
      evidence: statRow?.evidence ?? 0,
      contributions: statRow?.contributions ?? 0,
      validated: statRow?.validated ?? 0,
      endorsementsReceived: statRow?.endorsements ?? 0,
    },
    collaborators: collaborators.rows.map((row) => ({
      handle: row.handle,
      displayName: row.display_name,
      sharedProblems: row.shared,
    })),
    history: history.map((row) => ({
      id: row.id,
      kind: row.kind,
      delta: row.delta,
      reason: row.reason,
      createdAt: row.created_at.toISOString(),
      problemSlug: row.slug,
      problemTitle: row.title,
    })),
    problems: problems.rows,
  };
}
