import Link from 'next/link';
import {
  Badge,
  ConfidenceBar,
  Empty,
  KeyValue,
  Meter,
  OriginTag,
  Panel,
  PanelHeader,
  SectionHeading,
  Statement,
  StatusTag,
} from '@saveus/ui';
import { ContributeForm } from '@/components/contribute-form';
import { SessionView } from '@/components/session-view';
import { SourceChip, SourceRow } from '@/components/source-chip';
import { Thread } from '@/components/thread';
import { apiGet, apiGetOr404 } from '@/lib/server-api';
import type {
  Contribution,
  HypothesisSummary,
  ProblemDetail,
  ResearchSession,
  SessionUser,
  Source,
} from '@/lib/types';

export const dynamic = 'force-dynamic';

const CONSTRAINT_LABELS: Record<string, string> = {
  budget: 'Budget',
  time: 'Time',
  geography: 'Geography',
  technology: 'Technology',
  political: 'Political / social',
};

interface ProblemResponse {
  problem: ProblemDetail;
  hypotheses: HypothesisSummary[];
  contributions: Contribution[];
  sessions: ResearchSession[];
}

export default async function ProblemPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [data, session] = await Promise.all([
    apiGetOr404<ProblemResponse>(`/api/problems/${encodeURIComponent(slug)}`),
    apiGet<{ user: SessionUser | null }>('/api/me'),
  ]);

  const { problem, hypotheses, contributions, sessions } = data;
  const sourcesById = new Map(problem.sources.map((source) => [source.id, source]));

  return (
    <article className="enter">
      {/* Identity strip */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line pb-3">
        <Link
          href="/problems"
          className="mono text-[10px] uppercase tracking-[0.12em] text-ink-dim hover:text-signal"
        >
          ← Board
        </Link>
        <span className="mono text-[11px] tracking-[0.1em] text-ink-dim">
          PROBLEM #{problem.ref}
        </span>
        {problem.domains.map((domain) => (
          <span
            key={domain.key}
            className="mono text-[10px] uppercase tracking-[0.11em]"
            style={{ color: domain.accent }}
          >
            {domain.label}
          </span>
        ))}
        <span className="mono text-[10px] uppercase tracking-[0.11em] text-ink-dim">
          {problem.geographyLabel} · {problem.geographyScale}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <OriginTag origin={problem.origin} />
          <Badge tone={problem.status === 'OPEN' ? 'ok' : 'signal'}>
            {problem.status.replace(/_/g, ' ')}
          </Badge>
        </div>
      </div>

      <header className="grid gap-6 border-b border-line py-6 lg:grid-cols-[1fr_320px]">
        <div>
          <h1 className="max-w-3xl text-[26px] font-semibold leading-[1.2] tracking-[-0.01em]">
            {problem.title}
          </h1>
          <p className="mt-3 max-w-3xl text-[14px] leading-relaxed text-ink-muted">
            {problem.summary}
          </p>
        </div>

        <div className="space-y-2 lg:border-l lg:border-line lg:pl-6">
          <Meter label="Difficulty" value={problem.difficulty} />
          <Meter
            label="Urgency"
            value={problem.urgency}
            tone={problem.urgency >= 8 ? 'alert' : problem.urgency >= 6 ? 'warn' : 'neutral'}
          />
          <div className="mt-3 grid grid-cols-3 gap-3 border-t border-line pt-3">
            <div>
              <div className="label">Evidence</div>
              <div className="mono text-[16px]">{problem.sources.length}</div>
            </div>
            <div>
              <div className="label">Researchers</div>
              <div className="mono text-[16px]">{problem.researcherCount}</div>
            </div>
            <div>
              <div className="label">Hypotheses</div>
              <div className="mono text-[16px]">{hypotheses.length}</div>
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-10 py-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <SectionHeading id="the-problem">The problem</SectionHeading>
          <div className="max-w-3xl space-y-4 text-[14px] leading-[1.7] text-ink-muted">
            {problem.description.split('\n\n').map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>

          <SectionHeading id="why-it-matters">Why it matters</SectionHeading>
          <div className="max-w-3xl space-y-1 border border-line bg-panel px-4 py-2">
            {problem.whyItMatters.map((statement, index) => (
              <Statement
                key={index}
                kind={statement.kind}
                sources={renderSources(statement.sourceIds, sourcesById)}
              >
                {statement.text}
              </Statement>
            ))}
          </div>

          <SectionHeading id="constraints">Constraints</SectionHeading>
          <Panel className="max-w-3xl">
            <dl className="px-4 py-1">
              {Object.entries(problem.constraints).map(([key, value]) => (
                <KeyValue
                  key={key}
                  k={CONSTRAINT_LABELS[key] ?? key}
                  v={value ?? <span className="mono italic text-unknown">UNKNOWN</span>}
                />
              ))}
            </dl>
          </Panel>

          <SectionHeading id="success-criteria">Success criteria</SectionHeading>
          <Panel className="max-w-3xl">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-line">
                  <th className="label px-4 py-2 text-left">Metric</th>
                  <th className="label px-4 py-2 text-left">Target</th>
                  <th className="label px-4 py-2 text-left">Horizon</th>
                </tr>
              </thead>
              <tbody>
                {problem.successCriteria.map((criterion, index) => (
                  <tr key={index} className="border-b border-line align-top last:border-b-0">
                    <td className="px-4 py-3 text-[13px] text-ink">
                      {criterion.metric}
                      {criterion.measurement ? (
                        <p className="mt-1 text-[11.5px] leading-relaxed text-ink-dim">
                          {criterion.measurement}
                        </p>
                      ) : null}
                    </td>
                    <td className="mono px-4 py-3 text-[12px] text-ink-muted">
                      {criterion.target}
                    </td>
                    <td className="mono px-4 py-3 text-[12px] text-ink-dim">{criterion.horizon}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <SectionHeading id="evidence">Evidence</SectionHeading>
          <Panel className="max-w-3xl">
            <PanelHeader
              title={`${problem.sources.length} sources`}
              meta="Primary sources and references attached to this problem"
            />
            <div>
              {problem.sources.map((source) => (
                <SourceRow key={source.id} source={source} />
              ))}
            </div>
          </Panel>

          <SectionHeading id="current-knowledge">Current knowledge</SectionHeading>
          <div className="max-w-3xl space-y-1 border border-line bg-panel px-4 py-2">
            {problem.currentKnowledge.map((statement, index) => (
              <Statement
                key={index}
                kind={statement.kind}
                sources={renderSources(statement.sourceIds, sourcesById)}
              >
                {statement.text}
              </Statement>
            ))}
          </div>

          <SectionHeading id="open-questions">Open questions</SectionHeading>
          <ol className="max-w-3xl divide-y divide-line border border-line bg-panel">
            {problem.openQuestions.map((question, index) => (
              <li key={index} className="flex gap-4 px-4 py-3">
                <span className="mono shrink-0 text-[11px] text-ink-dim">
                  Q{String(index + 1).padStart(2, '0')}
                </span>
                <span className="text-[13.5px] leading-relaxed text-ink">{question}</span>
              </li>
            ))}
          </ol>

          <div className="mt-10 flex items-center gap-4">
            <SectionHeading id="hypotheses">Hypotheses</SectionHeading>
            <Link
              href={`/problems/${problem.slug}/new-hypothesis`}
              className="mono mt-10 shrink-0 border border-signal/50 bg-signal/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.1em] text-signal transition-colors duration-150 hover:bg-signal/20"
            >
              + Propose a hypothesis
            </Link>
          </div>
          {hypotheses.length === 0 ? (
            <Empty title="No hypotheses yet" hint="Be the first to propose a mechanism." />
          ) : (
            <ul className="divide-y divide-line border border-line">
              {hypotheses.map((hypothesis) => (
                <li key={hypothesis.id}>
                  <Link
                    href={`/hypotheses/${hypothesis.id}`}
                    className="group block px-4 py-4 transition-colors duration-150 hover:bg-panel"
                  >
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <span className="mono text-[10px] text-ink-dim">#{hypothesis.ref}</span>
                      <StatusTag status={hypothesis.status} />
                      <ConfidenceBar level={hypothesis.confidence} />
                      {hypothesis.authorAgentRole ? (
                        <Badge tone="warn" title="Proposed by an agent run, not a human researcher">
                          AI · {hypothesis.authorAgentRole}
                        </Badge>
                      ) : null}
                      <OriginTag origin={hypothesis.origin} />
                      <span className="mono ml-auto text-[10px] text-ink-dim">
                        {hypothesis.supportingCount} for · {hypothesis.contradictingCount} against ·{' '}
                        {hypothesis.contributionCount} contributions
                      </span>
                    </div>
                    <h3 className="mt-2 text-[14.5px] leading-snug text-ink group-hover:text-signal">
                      {hypothesis.title}
                    </h3>
                    <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-relaxed text-ink-muted">
                      {hypothesis.claim}
                    </p>
                    <p className="mono mt-2 text-[10px] text-ink-dim">
                      {hypothesis.author
                        ? `${hypothesis.author.handle} · ${hypothesis.author.tier}`
                        : 'agent'}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <SectionHeading id="research">Research</SectionHeading>
          {sessions.length === 0 ? (
            <Empty
              title="No agent runs on this problem yet"
              hint="Open a hypothesis to run a contextual research action against it."
            />
          ) : (
            <div className="divide-y divide-line border border-line">
              {sessions.map((item) => (
                <SessionView key={item.id} session={item} />
              ))}
            </div>
          )}

          <SectionHeading id="discussion">Discussion on the problem statement</SectionHeading>
          <div className="space-y-4">
            <Thread contributions={contributions} user={session.user} />
            <ContributeForm
              targetType="PROBLEM"
              targetId={problem.id}
              user={session.user}
              defaultKind="QUESTION"
            />
          </div>
        </div>

        {/* Sticky rail: navigation and the reading key */}
        <aside className="lg:sticky lg:top-[112px] lg:h-fit">
          <Panel>
            <PanelHeader title="Sections" />
            <nav className="flex flex-col px-4 py-3">
              {[
                ['the-problem', 'The problem'],
                ['why-it-matters', 'Why it matters'],
                ['constraints', 'Constraints'],
                ['success-criteria', 'Success criteria'],
                ['evidence', `Evidence (${problem.sources.length})`],
                ['current-knowledge', 'Current knowledge'],
                ['open-questions', `Open questions (${problem.openQuestions.length})`],
                ['hypotheses', `Hypotheses (${hypotheses.length})`],
                ['research', 'Research'],
                ['discussion', 'Discussion'],
              ].map(([id, label]) => (
                <a
                  key={id}
                  href={`#${id}`}
                  className="mono py-1 text-[11px] uppercase tracking-[0.09em] text-ink-dim transition-colors duration-150 hover:text-signal"
                >
                  {label}
                </a>
              ))}
            </nav>
          </Panel>

          <Panel className="mt-4">
            <PanelHeader title="Reading key" />
            <div className="space-y-2.5 px-4 py-3">
              {(
                [
                  ['FACT', 'Measured or officially recorded, with a source.'],
                  ['SOURCE_CLAIM', 'A named source says this. Attributed, not endorsed.'],
                  ['HUMAN_HYPOTHESIS', 'A researcher proposes it. Not established.'],
                  ['AI_HYPOTHESIS', 'An agent proposed it. Carries no authority.'],
                  ['INFERENCE', 'Derived from other statements on this page.'],
                  ['UNKNOWN', 'Nobody here knows. Recorded rather than filled in.'],
                ] as const
              ).map(([kind, definition]) => (
                <div key={kind} className="flex items-start gap-2">
                  <span
                    className="mono mt-[2px] shrink-0 border px-1.5 py-[1px] text-[9px] uppercase tracking-[0.09em]"
                    style={{
                      color: `var(--color-${kind.toLowerCase().replace(/_/g, '-')})`,
                      borderColor: `var(--color-${kind.toLowerCase().replace(/_/g, '-')})`,
                      borderStyle: kind === 'UNKNOWN' ? 'dashed' : 'solid',
                    }}
                  >
                    {kind.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[11px] leading-relaxed text-ink-dim">{definition}</span>
                </div>
              ))}
            </div>
          </Panel>
        </aside>
      </div>
    </article>
  );
}

function renderSources(sourceIds: string[], sourcesById: Map<string, Source>) {
  const sources = sourceIds
    .map((id) => sourcesById.get(id))
    .filter((source): source is Source => Boolean(source));
  if (sources.length === 0) return undefined;
  return sources.map((source) => <SourceChip key={source.id} source={source} compact />);
}
