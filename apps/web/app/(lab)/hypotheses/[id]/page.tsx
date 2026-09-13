import Link from 'next/link';
import {
  Badge,
  ConfidenceBar,
  Empty,
  KeyValue,
  OriginTag,
  Panel,
  PanelHeader,
  SectionHeading,
  StatusTag,
} from '@saveus/ui';
import { ContributeForm } from '@/components/contribute-form';
import { EvidenceForm } from '@/components/evidence-form';
import { ResearchActions } from '@/components/research-actions';
import { RunView, SessionView } from '@/components/session-view';
import { SourceRow } from '@/components/source-chip';
import { Thread } from '@/components/thread';
import { apiGet, apiGetOr404 } from '@/lib/server-api';
import type {
  AgentRun,
  Contribution,
  Evidence,
  HypothesisDetail,
  Meta,
  ResearchSession,
  SessionUser,
} from '@/lib/types';

export const dynamic = 'force-dynamic';

interface HypothesisResponse {
  hypothesis: HypothesisDetail;
  contributions: Contribution[];
  sessions: ResearchSession[];
  runs: AgentRun[];
}

export default async function HypothesisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, meta, session] = await Promise.all([
    apiGetOr404<HypothesisResponse>(`/api/hypotheses/${encodeURIComponent(id)}`),
    apiGet<Meta>('/api/meta'),
    apiGet<{ user: SessionUser | null }>('/api/me'),
  ]);

  const { hypothesis, contributions, sessions } = data;
  const supporting = hypothesis.evidence.filter((entry) => entry.stance === 'SUPPORTS');
  const contradicting = hypothesis.evidence.filter((entry) => entry.stance === 'CONTRADICTS');
  const context = hypothesis.evidence.filter((entry) => entry.stance === 'CONTEXT');

  return (
    <article className="enter">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line pb-3">
        <Link
          href={`/problems/${hypothesis.problem.slug}`}
          className="mono text-[10px] uppercase tracking-[0.12em] text-ink-dim hover:text-signal"
        >
          ← #{hypothesis.problem.ref} {hypothesis.problem.title}
        </Link>
        <span className="mono ml-auto text-[11px] tracking-[0.1em] text-ink-dim">
          HYPOTHESIS #{hypothesis.ref}
        </span>
      </div>

      <header className="grid gap-6 border-b border-line py-6 lg:grid-cols-[1fr_300px]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusTag status={hypothesis.status} />
            <ConfidenceBar level={hypothesis.confidence} />
            {hypothesis.authorAgentRole ? (
              <Badge
                tone="warn"
                title="Produced by an agent run. It carries no authority until humans test it."
              >
                AI hypothesis · {hypothesis.authorAgentRole}
              </Badge>
            ) : null}
            <OriginTag origin={hypothesis.origin} />
          </div>

          <h1 className="mt-3 max-w-3xl text-[24px] font-semibold leading-[1.22] tracking-[-0.01em]">
            {hypothesis.title}
          </h1>

          <p className="mt-4 max-w-3xl border-l-2 border-signal/50 pl-4 text-[14.5px] leading-relaxed text-ink">
            {hypothesis.claim}
          </p>

          <p className="mono mt-4 text-[11px] text-ink-dim">
            {hypothesis.author ? (
              <>
                <Link href={`/profile/${hypothesis.author.handle}`} className="hover:text-signal">
                  {hypothesis.author.handle}
                </Link>{' '}
                · {hypothesis.author.tier}
              </>
            ) : (
              `agent: ${hypothesis.authorAgentRole}`
            )}
            {hypothesis.contributors.length > 0 ? (
              <>
                {' '}
                · contributors:{' '}
                {hypothesis.contributors.map((contributor) => contributor.handle).join(', ')}
              </>
            ) : null}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 lg:block lg:space-y-3 lg:border-l lg:border-line lg:pl-6">
          <div>
            <div className="label">Supporting</div>
            <div className="mono text-[20px] text-ok">{supporting.length}</div>
          </div>
          <div>
            <div className="label">Contradicting</div>
            <div className="mono text-[20px] text-alert">{contradicting.length}</div>
          </div>
          <div>
            <div className="label">Contributions</div>
            <div className="mono text-[20px]">{hypothesis.contributionCount}</div>
          </div>
        </div>
      </header>

      <div className="grid gap-10 py-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <SectionHeading id="structure">Structure</SectionHeading>
          <Panel>
            <dl className="px-4 py-1">
              <KeyValue
                k="Proposed mechanism"
                v={<span className="text-ink">{hypothesis.mechanism}</span>}
              />
              <KeyValue k="Expected impact" v={hypothesis.expectedImpact} />
              <KeyValue
                k="Required assumptions"
                v={
                  <ol className="space-y-1.5">
                    {hypothesis.assumptions.map((assumption, index) => (
                      <li key={index} className="flex gap-2">
                        <span className="mono shrink-0 text-[10px] text-ink-dim">A{index + 1}</span>
                        <span>{assumption}</span>
                      </li>
                    ))}
                  </ol>
                }
              />
              <KeyValue
                k="Unknowns"
                v={
                  hypothesis.unknowns.length > 0 ? (
                    <ul className="space-y-1.5">
                      {hypothesis.unknowns.map((unknown, index) => (
                        <li key={index} className="italic text-unknown">
                          {unknown}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="mono italic text-unknown">
                      None declared — which is itself suspicious on a hypothesis this size.
                    </span>
                  )
                }
              />
              <KeyValue
                k="Potential risks"
                v={
                  hypothesis.risks.length > 0 ? (
                    <ul className="space-y-1.5">
                      {hypothesis.risks.map((risk, index) => (
                        <li key={index}>{risk}</li>
                      ))}
                    </ul>
                  ) : (
                    <span className="mono italic text-unknown">UNKNOWN</span>
                  )
                }
              />
              <KeyValue
                k="Estimated cost"
                v={
                  hypothesis.estimatedCost ?? (
                    <span className="mono italic text-unknown">UNKNOWN</span>
                  )
                }
              />
              <KeyValue
                k="Scalability"
                v={
                  hypothesis.estimatedScalability ?? (
                    <span className="mono italic text-unknown">UNKNOWN</span>
                  )
                }
              />
              <KeyValue k="Validation method" v={hypothesis.validationMethod} />
            </dl>
          </Panel>

          <SectionHeading id="evidence">Evidence</SectionHeading>
          <div className="space-y-4">
            <EvidenceBlock
              title="Supporting evidence"
              tone="ok"
              evidence={supporting}
              emptyHint="Nothing supports this yet. A hypothesis with no supporting evidence is a question in disguise."
            />
            <EvidenceBlock
              title="Contradicting evidence"
              tone="alert"
              evidence={contradicting}
              emptyHint="No contradicting evidence is recorded. That usually means nobody has looked, not that none exists."
            />
            {context.length > 0 ? (
              <EvidenceBlock title="Context" tone="neutral" evidence={context} emptyHint="" />
            ) : null}
            <EvidenceForm hypothesisId={hypothesis.id} user={session.user} />
          </div>

          {hypothesis.validation ? (
            <>
              <SectionHeading id="validation">Validation</SectionHeading>
              <Panel>
                <PanelHeader
                  title={`Decision: ${hypothesis.validation.decision}`}
                  meta={`${hypothesis.validation.decidedBy?.handle ?? 'curation desk'} · ${hypothesis.validation.decidedAt.slice(0, 10)}`}
                />
                <div className="px-4 py-3">
                  <p className="text-[13px] leading-relaxed text-ink-muted">
                    {hypothesis.validation.rationale}
                  </p>
                  <ul className="mt-3 space-y-1.5">
                    {hypothesis.validation.criteria.map((criterion, index) => (
                      <li key={index} className="flex items-start gap-2.5">
                        <span
                          className="mono mt-[2px] text-[11px]"
                          style={{
                            color: criterion.met ? 'var(--color-ok)' : 'var(--color-alert)',
                          }}
                        >
                          {criterion.met ? '✓' : '✗'}
                        </span>
                        <span className="text-[12.5px] text-ink-muted">{criterion.criterion}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 border-t border-line pt-3 text-[11.5px] text-ink-dim">
                    Validation is never self-declared. A status of VALIDATED or REJECTED is
                    reachable only through a recorded decision against these criteria.
                  </p>
                </div>
              </Panel>
            </>
          ) : null}

          <SectionHeading id="discussion">Discussion</SectionHeading>
          <div className="space-y-4">
            <Thread contributions={contributions} user={session.user} />
            <ContributeForm
              targetType="HYPOTHESIS"
              targetId={hypothesis.id}
              user={session.user}
              defaultKind="COUNTERARGUMENT"
            />
          </div>

          <SectionHeading id="runs">Agent runs on this hypothesis</SectionHeading>
          {sessions.length === 0 ? (
            <Empty
              title="No agent runs yet"
              hint="Use a contextual research action in the panel on the right. Every run is recorded here with its sources and its confidence."
            />
          ) : (
            <div className="divide-y divide-line border border-line">
              {sessions.map((item) => (
                <SessionView key={item.id} session={item} />
              ))}
            </div>
          )}

          {data.runs.length > 0 ? (
            <details className="mt-4">
              <summary className="mono cursor-pointer text-[10px] uppercase tracking-[0.11em] text-ink-dim hover:text-signal">
                All runs on this hypothesis ({data.runs.length})
              </summary>
              <div className="mt-3 space-y-2">
                {data.runs.map((run) => (
                  <RunView key={run.id} run={run} />
                ))}
              </div>
            </details>
          ) : null}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-[112px] lg:h-fit">
          <Panel>
            <PanelHeader
              title="AI research actions"
              meta={`${meta.ai.provider} / ${meta.ai.model}`}
            />
            <div className="px-3 py-3">
              <ResearchActions
                actions={meta.researchActions}
                hypothesisId={hypothesis.id}
                hypothesisTitle={hypothesis.title}
                user={session.user}
              />
              <p className="mt-3 border-t border-line pt-3 text-[11px] leading-relaxed text-ink-dim">
                Agents are instruments, not authors. Each action runs a named pipeline and records
                what it retrieved, how confident it is, and what it could not resolve. Nothing an
                agent produces is attached to this hypothesis as evidence without a human doing it.
              </p>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Status meaning" />
            <div className="px-4 py-3">
              <p className="text-[12px] leading-relaxed text-ink-muted">
                This hypothesis is <StatusTag status={hypothesis.status} />.
              </p>
              <p className="mt-2 text-[11.5px] leading-relaxed text-ink-dim">
                Status here is derived from the evidence record — the balance and reliability of
                supporting and contradicting sources — except for VALIDATED, REJECTED and PROMISING,
                which require a recorded validation against explicit criteria.
              </p>
            </div>
          </Panel>
        </aside>
      </div>
    </article>
  );
}

function EvidenceBlock({
  title,
  tone,
  evidence,
  emptyHint,
}: {
  title: string;
  tone: 'ok' | 'alert' | 'neutral';
  evidence: Evidence[];
  emptyHint: string;
}) {
  const color =
    tone === 'ok'
      ? 'var(--color-ok)'
      : tone === 'alert'
        ? 'var(--color-alert)'
        : 'var(--color-ink-dim)';

  return (
    <Panel>
      <header className="flex items-center gap-3 border-b border-line px-4 py-2.5">
        <span className="mono text-[10px] uppercase tracking-[0.11em]" style={{ color }}>
          {title}
        </span>
        <span className="mono text-[11px] text-ink-dim">{evidence.length}</span>
      </header>
      {evidence.length === 0 ? (
        <p className="px-4 py-4 text-[12px] leading-relaxed text-ink-dim">{emptyHint}</p>
      ) : (
        <ul className="divide-y divide-line">
          {evidence.map((entry) => (
            <li key={entry.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="mono text-[10px] text-ink-dim">strength {entry.strength}/5</span>
                <OriginTag origin={entry.origin} />
                {entry.addedBy ? (
                  <Link
                    href={`/profile/${entry.addedBy.handle}`}
                    className="mono text-[10px] text-ink-dim hover:text-signal"
                  >
                    added by {entry.addedBy.handle}
                  </Link>
                ) : entry.addedByRunId ? (
                  <span className="mono text-[10px] text-warn">attached from an agent run</span>
                ) : null}
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink">{entry.claim}</p>
              <div className="mt-2 border border-line">
                <SourceRow source={entry.source} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
