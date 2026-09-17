import Link from 'next/link';
import { OriginTag, Panel, PanelHeader, Stat } from '@saveus/ui';
import { apiGetOr404 } from '@/lib/server-api';

export const dynamic = 'force-dynamic';

interface Profile {
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

export default async function ProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const { profile } = await apiGetOr404<{ profile: Profile }>(
    `/api/researchers/${encodeURIComponent(handle)}`,
  );

  return (
    <div className="enter space-y-2">
      <header className="border-b border-line pb-5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[22px] font-semibold tracking-[-0.01em]">{profile.displayName}</h1>
          <span className="mono text-[12px] text-ink-dim">{profile.handle}</span>
          {profile.isAnonymous ? (
            <span className="mono border border-line px-1.5 py-[1px] text-[9.5px] uppercase tracking-[0.1em] text-ink-dim">
              anonymous
            </span>
          ) : null}
          <OriginTag origin={profile.origin} />
          <span className="mono ml-auto text-[10px] uppercase tracking-[0.1em] text-ink-dim">
            joined {profile.joinedAt.slice(0, 10)}
          </span>
        </div>
        {profile.bio ? (
          <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-ink-muted">{profile.bio}</p>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {profile.domains.map((domain) => (
            <span
              key={domain}
              className="mono border border-line px-2 py-[2px] text-[9.5px] uppercase tracking-[0.1em] text-ink-dim"
            >
              {domain}
            </span>
          ))}
        </div>
      </header>

      <div className="grid gap-4 py-5 md:grid-cols-3 lg:grid-cols-6">
        <Stat label="Research reputation" value={profile.reputation} hint={profile.tier} />
        <Stat label="Problems" value={profile.stats.problems} hint="contributed to" />
        <Stat label="Evidence" value={profile.stats.evidence} hint="sources attached" />
        <Stat label="Hypotheses" value={profile.stats.hypotheses} hint="authored" />
        <Stat label="Validated" value={profile.stats.validated} hint="passed validation" />
        <Stat
          label="Endorsements"
          value={profile.stats.endorsementsReceived}
          hint="marked useful"
        />
      </div>

      <div className="border border-line bg-panel px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="label">
            {profile.tier}
            {profile.nextTier ? ` → ${profile.nextTier}` : ' (highest tier)'}
          </span>
          <span className="mono text-[11px] text-ink-dim">
            trust {profile.trust.toFixed(2)} · {Math.round(profile.tierProgress * 100)}%
          </span>
        </div>
        <div className="mt-2 h-[6px] bg-line-strong">
          <div className="h-full bg-signal" style={{ width: `${profile.tierProgress * 100}%` }} />
        </div>
      </div>

      <div className="grid gap-4 pt-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <Panel>
            <PanelHeader title="Research history" meta="every reputation event, with its reason" />
            {profile.history.length === 0 ? (
              <p className="px-4 py-5 text-[12px] text-ink-dim">No recorded activity yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {profile.history.map((event) => (
                  <li key={event.id} className="flex items-start gap-4 px-4 py-2.5">
                    <span
                      className="mono w-[46px] shrink-0 text-right text-[12px]"
                      style={{ color: event.delta >= 0 ? 'var(--color-ok)' : 'var(--color-alert)' }}
                    >
                      {event.delta >= 0 ? '+' : ''}
                      {event.delta}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] leading-snug text-ink-muted">{event.reason}</p>
                      <p className="mono mt-0.5 text-[10px] text-ink-dim">
                        {event.kind.replace(/_/g, ' ').toLowerCase()}
                        {event.problemSlug ? (
                          <>
                            {' · '}
                            <Link
                              href={`/problems/${event.problemSlug}`}
                              className="hover:text-signal"
                            >
                              {event.problemTitle}
                            </Link>
                          </>
                        ) : null}
                      </p>
                    </div>
                    <span className="mono shrink-0 text-[10px] text-ink-dim">
                      {event.createdAt.slice(0, 10)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel>
            <PanelHeader title="Problems contributed to" />
            {profile.problems.length === 0 ? (
              <p className="px-4 py-4 text-[12px] text-ink-dim">None yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {profile.problems.map((problem) => (
                  <li key={problem.id}>
                    <Link
                      href={`/problems/${problem.slug}`}
                      className="flex items-start gap-3 px-4 py-2.5 transition-colors duration-150 hover:bg-panel-raised"
                    >
                      <span className="mono shrink-0 text-[10px] text-ink-dim">#{problem.ref}</span>
                      <span className="min-w-0 flex-1 text-[12px] leading-snug text-ink-muted">
                        {problem.title}
                      </span>
                      <span className="mono shrink-0 text-[10px] text-ink-dim">
                        {problem.contributions}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel>
            <PanelHeader title="Collaborators" meta="researchers on the same problems" />
            {profile.collaborators.length === 0 ? (
              <p className="px-4 py-4 text-[12px] text-ink-dim">None yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {profile.collaborators.map((collaborator) => (
                  <li key={collaborator.handle}>
                    <Link
                      href={`/profile/${collaborator.handle}`}
                      className="flex items-center gap-3 px-4 py-2.5 transition-colors duration-150 hover:bg-panel-raised"
                    >
                      <span className="text-[12.5px] text-ink-muted">
                        {collaborator.displayName}
                      </span>
                      <span className="mono ml-auto text-[10px] text-ink-dim">
                        {collaborator.sharedProblems} shared
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <p className="text-[11.5px] leading-relaxed text-ink-dim">
            No academic credentials are required or recorded anywhere on this platform. A completely
            anonymous account can make a contribution that outranks everything else on a problem.
          </p>
        </div>
      </div>
    </div>
  );
}
