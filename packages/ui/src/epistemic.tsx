import type { ReactNode } from 'react';
import { cn } from './cn.js';

/**
 * The epistemic layer, rendered.
 *
 * This is the component that makes the product's central claim visible: a
 * measured fact, a claim made by a source, a human proposal, a machine
 * proposal, an inference and an admitted gap do not look alike on screen. Each
 * kind has its own colour and its own marker, consistently, everywhere.
 */

export type EpistemicKind =
  'FACT' | 'SOURCE_CLAIM' | 'HUMAN_HYPOTHESIS' | 'AI_HYPOTHESIS' | 'INFERENCE' | 'UNKNOWN';

export const EPISTEMIC_STYLE: Record<
  EpistemicKind,
  { color: string; marker: string; label: string; border: string }
> = {
  FACT: { color: 'var(--color-fact)', marker: 'F', label: 'FACT', border: 'solid' },
  SOURCE_CLAIM: {
    color: 'var(--color-source-claim)',
    marker: 'SC',
    label: 'SOURCE CLAIM',
    border: 'solid',
  },
  HUMAN_HYPOTHESIS: {
    color: 'var(--color-human-hypothesis)',
    marker: 'H',
    label: 'HUMAN HYPOTHESIS',
    border: 'solid',
  },
  AI_HYPOTHESIS: {
    color: 'var(--color-ai-hypothesis)',
    marker: 'AI',
    label: 'AI HYPOTHESIS',
    border: 'solid',
  },
  INFERENCE: { color: 'var(--color-inference)', marker: 'I', label: 'INFERENCE', border: 'solid' },
  UNKNOWN: { color: 'var(--color-unknown)', marker: '?', label: 'UNKNOWN', border: 'dashed' },
};

export function EpistemicTag({
  kind,
  className,
  title,
}: {
  kind: EpistemicKind;
  className?: string;
  title?: string;
}) {
  const style = EPISTEMIC_STYLE[kind];
  return (
    <span
      title={title ?? style.label}
      style={{ color: style.color, borderColor: style.color, borderStyle: style.border }}
      className={cn(
        'mono inline-flex shrink-0 items-center border px-1.5 py-[1px] text-[9.5px] uppercase tracking-[0.1em] opacity-90',
        className,
      )}
    >
      {style.label}
    </span>
  );
}

/**
 * A statement with its epistemic kind. The left rule carries the colour, so a
 * column of statements can be scanned for "what here is actually established"
 * without reading a word.
 */
export function Statement({
  kind,
  children,
  sources,
  note,
  className,
}: {
  kind: EpistemicKind;
  children: ReactNode;
  sources?: ReactNode;
  note?: ReactNode;
  className?: string;
}) {
  const style = EPISTEMIC_STYLE[kind];
  return (
    <div
      className={cn('py-2.5 pl-4', className)}
      style={{ borderLeft: `2px ${style.border} ${style.color}` }}
    >
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1.5">
        <EpistemicTag kind={kind} className="mt-[3px]" />
        <p
          className={cn(
            'min-w-0 flex-1 text-[13.5px] leading-relaxed',
            kind === 'UNKNOWN' ? 'text-ink-dim italic' : 'text-ink',
          )}
        >
          {children}
        </p>
      </div>
      {note ? <p className="mt-1.5 pl-1 text-[12px] text-ink-dim">{note}</p> : null}
      {sources ? <div className="mt-2 flex flex-wrap gap-1.5">{sources}</div> : null}
    </div>
  );
}

export type ConfidenceLevel = 'SUPPORTED' | 'PLAUSIBLE' | 'UNCERTAIN' | 'CONTESTED' | 'REFUTED';

export const CONFIDENCE_STYLE: Record<ConfidenceLevel, { color: string; filled: number }> = {
  SUPPORTED: { color: 'var(--color-ok)', filled: 5 },
  PLAUSIBLE: { color: 'var(--color-source-claim)', filled: 4 },
  UNCERTAIN: { color: 'var(--color-unknown)', filled: 3 },
  CONTESTED: { color: 'var(--color-warn)', filled: 2 },
  REFUTED: { color: 'var(--color-alert)', filled: 1 },
};

export function ConfidenceBar({
  level,
  showLabel = true,
  title,
}: {
  level: ConfidenceLevel;
  showLabel?: boolean;
  title?: string;
}) {
  const style = CONFIDENCE_STYLE[level];
  return (
    <span className="inline-flex items-center gap-2" title={title ?? `Confidence: ${level}`}>
      <span className="flex gap-[2px]">
        {Array.from({ length: 5 }, (_, index) => (
          <span
            key={index}
            className="h-[8px] w-[4px]"
            style={{ background: index < style.filled ? style.color : 'var(--color-line-strong)' }}
          />
        ))}
      </span>
      {showLabel ? (
        <span
          className="mono text-[10px] uppercase tracking-[0.09em]"
          style={{ color: style.color }}
        >
          {level}
        </span>
      ) : null}
    </span>
  );
}

/**
 * Seeded and machine-produced records are marked, always. The credibility of
 * the platform depends on nobody ever mistaking demo content for a real result.
 */
export function OriginTag({ origin }: { origin: string }) {
  if (origin === 'DEMO_SEED') {
    return (
      <span
        className="mono border border-dashed px-1.5 py-[1px] text-[9.5px] uppercase tracking-[0.12em]"
        style={{ color: 'var(--color-warn)', borderColor: 'rgba(224,145,60,0.45)' }}
        title="Seeded demonstration content. Written for this dataset, not a real research contribution."
      >
        Demo data
      </span>
    );
  }
  if (origin === 'AGENT') {
    return (
      <span
        className="mono border px-1.5 py-[1px] text-[9.5px] uppercase tracking-[0.12em]"
        style={{ color: 'var(--color-ai-hypothesis)', borderColor: 'rgba(224,161,60,0.45)' }}
        title="Produced by an agent run. Not established fact."
      >
        Agent
      </span>
    );
  }
  if (origin === 'INGESTED') {
    return (
      <span
        className="mono border border-line-strong px-1.5 py-[1px] text-[9.5px] uppercase tracking-[0.12em] text-ink-dim"
        title="Catalogued from a source connector."
      >
        Ingested
      </span>
    );
  }
  return null;
}

export const HYPOTHESIS_STATUS_STYLE: Record<string, { color: string; hint: string }> = {
  DRAFT: { color: 'var(--color-ink-dim)', hint: 'Not yet submitted for review.' },
  UNDER_REVIEW: { color: 'var(--color-source-claim)', hint: 'Open for attack and evidence.' },
  NEEDS_EVIDENCE: { color: 'var(--color-warn)', hint: 'The evidence record does not settle this.' },
  CONTESTED: { color: 'var(--color-warn)', hint: 'Sources of comparable weight disagree.' },
  TESTABLE: { color: 'var(--color-inference)', hint: 'Stated precisely enough to be tested.' },
  SIMULATION: { color: 'var(--color-inference)', hint: 'Being evaluated computationally.' },
  PROMISING: { color: 'var(--color-ok)', hint: 'Evidence leans in favour; not validated.' },
  VALIDATED: { color: 'var(--color-ok)', hint: 'Passed validation against explicit criteria.' },
  REJECTED: { color: 'var(--color-alert)', hint: 'Contradicted by the evidence record.' },
};

export function StatusTag({ status }: { status: string }) {
  const style = HYPOTHESIS_STATUS_STYLE[status] ?? {
    color: 'var(--color-ink-dim)',
    hint: status,
  };
  return (
    <span
      title={style.hint}
      style={{ color: style.color, borderColor: style.color }}
      className="mono inline-flex items-center border px-1.5 py-[1px] text-[10px] uppercase tracking-[0.09em]"
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}
