'use client';

import { useState } from 'react';
import { ConfidenceBar, EpistemicTag, cn } from '@saveus/ui';
import { SourceChip } from './source-chip';
import type { AgentRun, ResearchSession } from '@/lib/types';

const STATUS_COLOR: Record<string, string> = {
  SUCCEEDED: 'var(--color-ok)',
  RUNNING: 'var(--color-signal)',
  QUEUED: 'var(--color-ink-dim)',
  FAILED: 'var(--color-alert)',
  BLOCKED: 'var(--color-warn)',
};

/**
 * A research session, rendered so it can be audited rather than trusted.
 *
 * The brief is on top because that is what a reader wants; every claim in it
 * links back to the run that produced it, and every run shows its agent, its
 * model, its timing and its retrieval. Nothing here is styled to look like a
 * conclusion.
 */
export function SessionView({
  session,
  defaultOpen = false,
}: {
  session: ResearchSession;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors duration-150 hover:bg-panel-raised"
      >
        <span
          className="mono text-[10px] uppercase tracking-[0.1em]"
          style={{ color: STATUS_COLOR[session.status] ?? 'var(--color-ink-dim)' }}
        >
          {session.status}
        </span>
        <span className="mono text-[11px] uppercase tracking-[0.1em] text-ink">
          {session.title}
        </span>
        <span className="flex-1 truncate text-[12px] text-ink-muted">{session.question}</span>
        <span className="mono shrink-0 text-[10px] text-ink-dim">
          {session.runs.length} runs · {session.runs.reduce((n, run) => n + run.findings.length, 0)}{' '}
          findings
        </span>
        <span className="mono shrink-0 text-[10px] text-ink-dim">{open ? '−' : '+'}</span>
      </button>

      {open ? (
        <div className="border-t border-line px-3 py-4">
          <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1">
            {session.runs.map((run, index) => (
              <span key={run.id} className="mono flex items-center gap-2 text-[10px] text-ink-dim">
                {index > 0 ? <span className="text-ink-dim/50">→</span> : null}
                <span style={{ color: STATUS_COLOR[run.status] ?? 'var(--color-ink-dim)' }}>
                  {run.agentRole}
                </span>
                <span>{run.findings.length}</span>
              </span>
            ))}
            <span className="mono ml-auto text-[10px] text-ink-dim">
              requested by {session.requestedBy?.handle ?? 'system'} ·{' '}
              {new Date(session.createdAt).toISOString().slice(0, 16).replace('T', ' ')}
            </span>
          </div>

          {session.brief ? <Brief session={session} /> : null}

          <div className="mt-5 space-y-3">
            <p className="label">Runs</p>
            {session.runs.map((run) => (
              <RunView key={run.id} run={run} />
            ))}
          </div>

          {session.brief ? (
            <p className="mt-4 border-t border-line pt-3 text-[11px] leading-relaxed text-ink-dim">
              {session.brief.disclaimer}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Brief({ session }: { session: ResearchSession }) {
  const brief = session.brief;
  if (!brief) return null;

  return (
    <div className="border border-line bg-panel-raised">
      <div className="border-b border-line px-3 py-2">
        <span className="label">Research brief</span>
      </div>
      <div className="divide-y divide-line">
        {brief.sections.map((section) => (
          <div key={section.heading} className="px-3 py-3">
            <p className="mono mb-2 text-[10px] uppercase tracking-[0.12em] text-ink-muted">
              {section.heading}
              <span className="ml-2 text-ink-dim">{section.items.length}</span>
            </p>
            <ul className="space-y-2.5">
              {section.items.slice(0, 6).map((item, index) => (
                <li key={index} className="flex flex-wrap items-start gap-x-3 gap-y-1">
                  <EpistemicTag kind={item.epistemicKind} className="mt-[2px]" />
                  <ConfidenceBar level={item.confidence} showLabel={false} />
                  <span className="min-w-0 flex-1 text-[12.5px] leading-relaxed text-ink-muted">
                    {item.statement}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {brief.nextExperiment ? (
        <div className="border-t border-line px-3 py-3">
          <p className="label mb-1.5">Suggested next experiment</p>
          <p className="text-[12.5px] leading-relaxed text-ink">{brief.nextExperiment}</p>
        </div>
      ) : null}

      {brief.openUnknowns.length > 0 ? (
        <div className="border-t border-line px-3 py-3">
          <p className="label mb-1.5">Open unknowns after this pipeline</p>
          <ul className="space-y-1">
            {brief.openUnknowns.slice(0, 6).map((unknown, index) => (
              <li key={index} className="text-[12px] italic leading-relaxed text-unknown">
                {unknown}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function RunView({ run }: { run: AgentRun }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn('border border-line', run.status === 'FAILED' && 'border-alert/40')}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-left hover:bg-panel-raised"
      >
        <span className="mono text-[11px] uppercase tracking-[0.1em] text-ink">
          {run.agentName}
        </span>
        <span
          className="mono text-[9.5px] uppercase tracking-[0.1em]"
          style={{ color: STATUS_COLOR[run.status] ?? 'var(--color-ink-dim)' }}
        >
          {run.status}
        </span>
        <span className="mono text-[10px] text-ink-dim">
          {run.provider} / {run.model}
        </span>
        <span className="mono text-[10px] text-ink-dim">{run.durationMs ?? '—'} ms</span>
        {run.tokensIn !== null ? (
          <span className="mono text-[10px] text-ink-dim">
            {run.tokensIn}→{run.tokensOut} tok
          </span>
        ) : null}
        <span
          className="mono text-[10px] text-ink-dim"
          title="Digest of the exact input this run saw"
        >
          in:{run.inputDigest}
        </span>
        <span className="mono ml-auto text-[10px] text-ink-dim">
          {run.findings.length} findings
        </span>
      </button>

      {run.error ? (
        <p className="border-t border-line px-3 py-2 text-[11.5px] text-warn">{run.error}</p>
      ) : null}

      {open ? (
        <div className="divide-y divide-line border-t border-line">
          {run.findings.map((finding) => (
            <div key={finding.id} className="px-3 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="mono text-[9.5px] uppercase tracking-[0.1em] text-ink-dim">
                  {finding.kind.replace(/_/g, ' ')}
                </span>
                <EpistemicTag kind={finding.epistemicKind} />
                <ConfidenceBar level={finding.confidence} />
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-ink">{finding.statement}</p>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-dim">
                <span className="label mr-2">Reasoning</span>
                {finding.reasoning}
              </p>
              {finding.unresolved ? (
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-unknown">
                  <span className="label mr-2">Unresolved</span>
                  {finding.unresolved}
                </p>
              ) : null}
              {finding.sources.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {finding.sources.map((source) => (
                    <SourceChip key={source.id} source={source} compact />
                  ))}
                </div>
              ) : null}
            </div>
          ))}
          {run.findings.length === 0 ? (
            <p className="px-3 py-3 text-[12px] text-ink-dim">
              This run produced no findings. That is recorded rather than hidden.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
