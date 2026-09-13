import Link from 'next/link';
import { Badge, Empty, Panel, PanelHeader, SectionHeading } from '@saveus/ui';
import { CurationQueue } from '@/components/curation-queue';
import { SessionView } from '@/components/session-view';
import { apiGet } from '@/lib/server-api';
import type {
  IngestionRun,
  IntakeCandidate,
  Meta,
  RejectedDocument,
  ResearchSession,
  SessionUser,
} from '@/lib/types';

export const dynamic = 'force-dynamic';

interface ConnectorInfo {
  name: string;
  description: string;
  allowedHosts: string[];
}

export default async function ResearchPage() {
  const [meta, viewer, sessions, candidates, connectors, runs, rejected] = await Promise.all([
    apiGet<Meta>('/api/meta'),
    apiGet<{ user: SessionUser | null }>('/api/me'),
    apiGet<{ sessions: ResearchSession[] }>('/api/research/sessions?limit=20'),
    apiGet<{ candidates: IntakeCandidate[] }>('/api/ingestion/candidates'),
    apiGet<{
      live: boolean;
      thresholds: { accept: number; weak: number; minBodyLength: number };
      connectors: ConnectorInfo[];
    }>('/api/ingestion/connectors'),
    apiGet<{ runs: IngestionRun[] }>('/api/ingestion/runs'),
    apiGet<{ documents: RejectedDocument[] }>('/api/ingestion/rejected'),
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
          <CurationQueue candidates={candidates.candidates} user={viewer.user} />
        </Panel>

        <div className="space-y-4">
          <Panel>
            <PanelHeader
              title="Connectors"
              meta={
                connectors.live
                  ? 'Live. Fetching real feeds on the daily schedule.'
                  : 'Offline. Set INTAKE_LIVE=true to fetch real feeds; the seeded connectors exercise the same code path.'
              }
            />
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
                'ASSESS RELEVANCE',
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

      <SectionHeading>Intake health</SectionHeading>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Cycles"
            meta={`Accept at ${connectors.thresholds.accept}, floor at ${connectors.thresholds.weak}. Only ACCEPT reaches the queue.`}
          />
          {runs.runs.length === 0 ? (
            <p className="px-4 py-6 text-[12px] text-ink-dim">No cycle has run yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[11.5px]">
                <thead>
                  <tr className="border-b border-line text-left">
                    {['connector', 'when', 'fetched', 'queued', 'weak', 'rejected', 'dup'].map(
                      (head) => (
                        <th
                          key={head}
                          className="mono px-3 py-2 text-[9.5px] uppercase tracking-[0.1em] text-ink-dim"
                        >
                          {head}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {runs.runs.slice(0, 12).map((run) => (
                    <tr key={run.id}>
                      <td className="mono px-3 py-1.5 text-ink">{run.connector}</td>
                      <td className="mono px-3 py-1.5 text-ink-dim">
                        {run.startedAt.slice(5, 16).replace('T', ' ')}
                      </td>
                      <td className="mono px-3 py-1.5 text-ink-muted">{run.fetched}</td>
                      <td className="mono px-3 py-1.5 text-ok">
                        {run.candidates}
                        {run.deferred > 0 ? (
                          <span className="text-ink-dim"> (+{run.deferred} held)</span>
                        ) : null}
                      </td>
                      <td className="mono px-3 py-1.5 text-warn">{run.weak}</td>
                      <td className="mono px-3 py-1.5 text-ink-dim">{run.rejected}</td>
                      <td className="mono px-3 py-1.5 text-ink-dim">{run.duplicates}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="border-t border-line px-4 py-3 text-[11.5px] leading-relaxed text-ink-dim">
            A cycle that fetches sixty documents and queues one is the filter working, not the
            filter failing. Most of what a newsroom publishes is not a problem.
          </p>
        </Panel>

        <Panel>
          <PanelHeader
            title="Thrown out"
            meta="What the gate refused, and why. The queue is only half the record."
          />
          {rejected.documents.length === 0 ? (
            <p className="px-4 py-6 text-[12px] text-ink-dim">Nothing has been rejected yet.</p>
          ) : (
            <ul className="max-h-[420px] divide-y divide-line overflow-y-auto">
              {rejected.documents.slice(0, 25).map((document) => (
                <li key={document.id} className="px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="alert">{document.code ?? 'REJECT'}</Badge>
                    <span className="mono text-[9.5px] text-ink-dim">{document.connector}</span>
                  </div>
                  <a
                    href={document.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-1 block text-[12px] leading-snug text-ink-muted hover:text-signal"
                  >
                    {document.title}
                  </a>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-ink-dim">
                    {document.reasons[0]}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
