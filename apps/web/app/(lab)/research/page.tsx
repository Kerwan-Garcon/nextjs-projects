import Link from 'next/link';
import { Badge, Empty, Panel, PanelHeader, SectionHeading } from '@saveus/ui';
import { SessionView } from '@/components/session-view';
import { apiGet } from '@/lib/server-api';
import type { Meta, ResearchSession } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface Candidate {
  id: string;
  connector: string;
  title: string;
  summary: string;
  status: string;
  curationScore: number;
  blocking: string[];
  warnings: string[];
  proposedDomains: string[];
  createdAt: string;
  curatorHandle: string | null;
}

export default async function ResearchPage() {
  const [meta, sessions, candidates, connectors] = await Promise.all([
    apiGet<Meta>('/api/meta'),
    apiGet<{ sessions: ResearchSession[] }>('/api/research/sessions?limit=20'),
    apiGet<{ candidates: Candidate[] }>('/api/ingestion/candidates'),
    apiGet<{ connectors: { name: string; description: string; allowedHosts: string[] }[] }>(
      '/api/ingestion/connectors',
    ),
  ]);

  return (
    <div className="enter space-y-2">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
        <div>
          <h1 className="mono text-[13px] uppercase tracking-[0.16em]">Research operations</h1>
          <p className="mt-1.5 max-w-2xl text-[12.5px] text-ink-muted">
            Every agent run on the platform, the agents that can be run, and the intake queue that
            proposes new problems. Nothing here publishes itself.
          </p>
        </div>
        <Link
          href="/research/method"
          className="mono border border-line-strong px-3 py-1.5 text-[11px] uppercase tracking-[0.1em] text-ink-muted hover:border-signal/50 hover:text-signal"
        >
          How claims are labelled
        </Link>
      </div>

      <SectionHeading>Recent research sessions</SectionHeading>
      {sessions.sessions.length === 0 ? (
        <Empty
          title="No sessions yet"
          hint="Open a hypothesis and run a contextual research action."
        />
      ) : (
        <div className="divide-y divide-line border border-line">
          {sessions.sessions.map((session) => (
            <SessionView key={session.id} session={session} />
          ))}
        </div>
      )}

      <SectionHeading>Agents</SectionHeading>
      <div className="grid gap-px border border-line bg-line md:grid-cols-2 xl:grid-cols-3">
        {meta.agents.map((agent) => (
          <div key={agent.role} className="bg-panel px-4 py-4">
            <div className="flex items-center gap-2">
              <span className="mono text-[11px] uppercase tracking-[0.12em] text-ink">
                {agent.name}
              </span>
              <span className="mono text-[9.5px] uppercase tracking-[0.1em] text-ink-dim">
                {agent.role}
              </span>
            </div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">{agent.mission}</p>
            <p className="mt-2 text-[11.5px] leading-relaxed text-ink-dim">{agent.description}</p>
            <div className="mt-3 flex flex-wrap gap-1">
              {agent.tools.map((tool) => (
                <span
                  key={tool}
                  className="mono border border-line px-1.5 py-[1px] text-[9px] tracking-[0.05em] text-ink-dim"
                >
                  {tool}
                </span>
              ))}
            </div>
            <p className="mono mt-2 text-[9.5px] text-ink-dim">
              max findings {String(agent.permissions.maxFindings)} ·{' '}
              {agent.permissions.proposeEvidence
                ? 'may propose evidence'
                : 'cannot propose evidence'}
            </p>
          </div>
        ))}
      </div>

      <SectionHeading>Problem ingestion</SectionHeading>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Panel>
          <PanelHeader
            title="Curation queue"
            meta="Candidates proposed by connectors. A human curator decides; the pipeline cannot publish."
          />
          {candidates.candidates.length === 0 ? (
            <p className="px-4 py-6 text-[12px] text-ink-dim">The intake queue is empty.</p>
          ) : (
            <ul className="divide-y divide-line">
              {candidates.candidates.map((candidate) => (
                <li key={candidate.id} className="px-4 py-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={candidate.status === 'PENDING_CURATION' ? 'warn' : 'neutral'}>
                      {candidate.status.replace(/_/g, ' ')}
                    </Badge>
                    <span className="mono text-[10px] text-ink-dim">{candidate.connector}</span>
                    <span className="mono text-[10px] text-ink-dim">
                      checklist {candidate.curationScore.toFixed(0)}/100
                    </span>
                    {candidate.proposedDomains.map((domain) => (
                      <span
                        key={domain}
                        className="mono text-[9.5px] uppercase tracking-[0.1em] text-ink-dim"
                      >
                        {domain}
                      </span>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[13px] leading-snug text-ink">{candidate.title}</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">
                    {candidate.summary}
                  </p>
                  {candidate.blocking.length > 0 ? (
                    <div className="mt-2">
                      <span className="label">Blocking checks</span>
                      <ul className="mt-1 space-y-0.5">
                        {candidate.blocking.map((item) => (
                          <li key={item} className="text-[11.5px] text-alert">
                            ✗ {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {candidate.warnings.length > 0 ? (
                    <p className="mt-1.5 text-[11.5px] text-warn">
                      Warnings: {candidate.warnings.join(' · ')}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel>
            <PanelHeader title="Connectors" />
            <ul className="divide-y divide-line">
              {connectors.connectors.map((connector) => (
                <li key={connector.name} className="px-4 py-3">
                  <span className="mono text-[11px] uppercase tracking-[0.1em] text-ink">
                    {connector.name}
                  </span>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-ink-muted">
                    {connector.description}
                  </p>
                  <p className="mono mt-1.5 text-[10px] text-ink-dim">
                    hosts: {connector.allowedHosts.join(', ')}
                  </p>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel>
            <PanelHeader title="Pipeline" />
            <ol className="px-4 py-3">
              {[
                'FETCH',
                'NORMALIZE',
                'DEDUPLICATE',
                'CLASSIFY',
                'EXTRACT CLAIMS',
                'IDENTIFY OPEN PROBLEMS',
                'GENERATE CANDIDATE',
                'CURATE',
                'PUBLISH (human)',
              ].map((step, index, all) => (
                <li key={step} className="flex items-center gap-3 py-1">
                  <span className="mono text-[10px] text-ink-dim">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span
                    className={`mono text-[11px] uppercase tracking-[0.09em] ${
                      index === all.length - 1 ? 'text-ok' : 'text-ink-muted'
                    }`}
                  >
                    {step}
                  </span>
                </li>
              ))}
            </ol>
            <p className="border-t border-line px-4 py-3 text-[11.5px] leading-relaxed text-ink-dim">
              A problem never becomes public because a model produced it. The pipeline can only
              place a candidate in this queue with its failed checks attached.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
