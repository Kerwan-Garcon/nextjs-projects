import Link from 'next/link';
import { Empty, Panel, PanelHeader } from '@saveus/ui';
import { apiGet } from '@/lib/server-api';
import type { Meta } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface LeaderboardEntry {
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

interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  topProblems: {
    id: string;
    ref: string;
    slug: string;
    title: string;
    geographyLabel: string;
    activity: number;
    researchers: number;
    hypotheses: number;
  }[];
  breakthroughs: {
    hypothesisId: string;
    ref: string;
    title: string;
    decision: string;
    decidedAt: string;
    problemTitle: string;
    problemSlug: string;
  }[];
}

const SCOPES = [
  { key: 'global', label: 'Global' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'domain', label: 'Domain' },
];

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const scope = typeof params.scope === 'string' ? params.scope : 'global';
  const domain = typeof params.domain === 'string' ? params.domain : undefined;

  const query = new URLSearchParams({ scope, limit: '25' });
  if (scope === 'domain' && domain) query.set('domain', domain);

  const [meta, data] = await Promise.all([
    apiGet<Meta>('/api/meta'),
    apiGet<LeaderboardResponse>(`/api/leaderboard?${query.toString()}`),
  ]);

  return (
    <div className="enter space-y-2">
      <div className="border-b border-line pb-4">
        <h1 className="mono text-[13px] uppercase tracking-[0.16em]">Leaderboard</h1>
        <p className="mt-1.5 max-w-2xl text-[12.5px] text-ink-muted">
          Ordered by recorded reputation events, which are ordered by contribution quality rather
          than count. The ranking is an artefact of the scoring engine and can be audited by reading
          the events on a profile.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 py-3">
        {SCOPES.map((entry) => (
          <Link
            key={entry.key}
            href={`/leaderboard?scope=${entry.key}`}
            className={`mono border px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] transition-colors duration-150 ${
              scope === entry.key
                ? 'border-signal bg-signal/10 text-signal'
                : 'border-line text-ink-dim hover:text-ink-muted'
            }`}
          >
            {entry.label}
          </Link>
        ))}
        {scope === 'domain'
          ? meta.domains.map((entry) => (
              <Link
                key={entry.key}
                href={`/leaderboard?scope=domain&domain=${entry.key}`}
                style={
                  domain === entry.key
                    ? { color: entry.accent, borderColor: entry.accent }
                    : undefined
                }
                className={`mono border px-2 py-[3px] text-[10px] uppercase tracking-[0.09em] ${
                  domain === entry.key
                    ? 'bg-panel-raised'
                    : 'border-line text-ink-dim hover:text-ink-muted'
                }`}
              >
                {entry.label}
              </Link>
            ))
          : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Panel>
          <PanelHeader title="Top researchers" meta={scope === 'weekly' ? 'last 7 days' : scope} />
          {data.entries.length === 0 ? (
            <Empty title="No reputation events in this window" />
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-line">
                  <th className="label px-4 py-2 text-left">#</th>
                  <th className="label px-4 py-2 text-left">Researcher</th>
                  <th className="label px-4 py-2 text-left">Tier</th>
                  <th className="label px-4 py-2 text-right">Reputation</th>
                  <th className="label px-4 py-2 text-right">Evidence</th>
                  <th className="label px-4 py-2 text-right">Contributions</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map((entry) => (
                  <tr
                    key={entry.handle}
                    className="border-b border-line transition-colors duration-150 last:border-b-0 hover:bg-panel-raised"
                  >
                    <td className="mono px-4 py-2.5 text-[11px] text-ink-dim">{entry.rank}</td>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/profile/${entry.handle}`}
                        className="text-[13px] text-ink hover:text-signal"
                      >
                        {entry.displayName}
                      </Link>
                      <span className="mono ml-2 text-[10px] text-ink-dim">{entry.handle}</span>
                      {entry.isAnonymous ? (
                        <span className="mono ml-2 text-[9.5px] uppercase tracking-[0.1em] text-ink-dim">
                          anon
                        </span>
                      ) : null}
                    </td>
                    <td className="mono px-4 py-2.5 text-[10px] uppercase tracking-[0.09em] text-ink-dim">
                      {entry.tier}
                    </td>
                    <td className="mono px-4 py-2.5 text-right text-[13px] text-ink">
                      {entry.reputation}
                    </td>
                    <td className="mono px-4 py-2.5 text-right text-[12px] text-ink-muted">
                      {entry.evidenceAdded}
                    </td>
                    <td className="mono px-4 py-2.5 text-right text-[12px] text-ink-dim">
                      {entry.contributions}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel>
            <PanelHeader title="Top problems" meta="by activity in the last 90 days" />
            <ul className="divide-y divide-line">
              {data.topProblems.map((problem) => (
                <li key={problem.id}>
                  <Link
                    href={`/problems/${problem.slug}`}
                    className="block px-4 py-3 transition-colors duration-150 hover:bg-panel-raised"
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="mono text-[10px] text-ink-dim">#{problem.ref}</span>
                      <span className="mono text-[9.5px] uppercase tracking-[0.1em] text-ink-dim">
                        {problem.geographyLabel}
                      </span>
                    </div>
                    <p className="mt-1 text-[12.5px] leading-snug text-ink">{problem.title}</p>
                    <p className="mono mt-1 text-[10px] text-ink-dim">
                      {problem.activity} recent contributions · {problem.researchers} researchers ·{' '}
                      {problem.hypotheses} hypotheses
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel>
            <PanelHeader title="Recent breakthroughs" meta="validations, in both directions" />
            {data.breakthroughs.length === 0 ? (
              <p className="px-4 py-4 text-[12px] text-ink-dim">
                No validation decisions recorded yet.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {data.breakthroughs.map((item) => (
                  <li key={item.hypothesisId}>
                    <Link
                      href={`/hypotheses/${item.hypothesisId}`}
                      className="block px-4 py-3 transition-colors duration-150 hover:bg-panel-raised"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="mono border px-1.5 py-[1px] text-[9.5px] uppercase tracking-[0.1em]"
                          style={{
                            color:
                              item.decision === 'VALIDATED'
                                ? 'var(--color-ok)'
                                : 'var(--color-alert)',
                            borderColor:
                              item.decision === 'VALIDATED'
                                ? 'var(--color-ok)'
                                : 'var(--color-alert)',
                          }}
                        >
                          {item.decision}
                        </span>
                        <span className="mono text-[10px] text-ink-dim">
                          {item.decidedAt.slice(0, 10)}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[12.5px] leading-snug text-ink">{item.title}</p>
                      <p className="mono mt-1 text-[10px] text-ink-dim">{item.problemTitle}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <p className="border-t border-line px-4 py-3 text-[11.5px] leading-relaxed text-ink-dim">
              A rejected hypothesis with a clear reason is a result, so rejections appear here
              alongside validations.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
