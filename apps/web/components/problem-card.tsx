import Link from 'next/link';
import { Meter } from '@saveus/ui';
import type { ProblemCard as ProblemCardType } from '@/lib/types';

const STATUS_COLOR: Record<string, string> = {
  OPEN: 'var(--color-ok)',
  ACTIVE_RESEARCH: 'var(--color-signal)',
  NEEDS_EVIDENCE: 'var(--color-warn)',
  STALLED: 'var(--color-ink-dim)',
  SOLUTION_CANDIDATE: 'var(--color-inference)',
  ARCHIVED: 'var(--color-ink-dim)',
};

/**
 * A problem as a mission card: identity, scope, the two bars that say how hard
 * and how urgent, and the three counts that say whether anyone is working on it.
 */
export function ProblemCard({ problem }: { problem: ProblemCardType }) {
  const primary = problem.domains.find((domain) => domain.isPrimary) ?? problem.domains[0];

  return (
    <Link
      href={`/problems/${problem.slug}`}
      className="enter group flex flex-col border border-line bg-panel transition-colors duration-150 hover:border-line-strong"
    >
      <div className="flex items-center gap-3 border-b border-line px-4 py-2">
        {primary ? (
          <span
            className="mono text-[10px] uppercase tracking-[0.12em]"
            style={{ color: primary.accent }}
          >
            {primary.label}
          </span>
        ) : null}
        <span className="mono truncate text-[10px] uppercase tracking-[0.12em] text-ink-dim">
          {problem.geographyLabel}
        </span>
        <span className="mono ml-auto text-[10px] text-ink-dim/70">#{problem.ref}</span>
      </div>

      <div className="flex-1 px-4 py-4">
        <h3 className="text-[15px] font-medium leading-snug text-ink group-hover:text-signal">
          {problem.title}
        </h3>
        <p className="mt-2 line-clamp-3 text-[12.5px] leading-relaxed text-ink-muted">
          {problem.summary}
        </p>
      </div>

      <div className="space-y-1.5 px-4 pb-3">
        <Meter label="Difficulty" value={problem.difficulty} tone="neutral" />
        <Meter
          label="Urgency"
          value={problem.urgency}
          tone={problem.urgency >= 8 ? 'alert' : problem.urgency >= 6 ? 'warn' : 'neutral'}
        />
      </div>

      <div className="grid grid-cols-3 border-t border-line">
        <Count label="Evidence" value={problem.evidenceCount} suffix="sources" />
        <Count
          label="Researchers"
          value={problem.researcherCount}
          className="border-x border-line"
        />
        <Count label="Hypotheses" value={problem.hypothesisCount} />
      </div>

      <div className="flex items-center justify-between border-t border-line px-4 py-2">
        <span
          className="mono text-[10px] uppercase tracking-[0.11em]"
          style={{ color: STATUS_COLOR[problem.status] ?? 'var(--color-ink-dim)' }}
        >
          {problem.status.replace(/_/g, ' ')}
        </span>
        <span className="mono text-[10px] text-ink-dim">
          {problem.contributionCount} contributions
        </span>
      </div>
    </Link>
  );
}

function Count({
  label,
  value,
  suffix,
  className,
}: {
  label: string;
  value: number;
  suffix?: string;
  className?: string;
}) {
  return (
    <div className={`px-4 py-2.5 ${className ?? ''}`}>
      <div className="label">{label}</div>
      <div className="mono mt-0.5 text-[15px] text-ink">
        {value}
        {suffix ? <span className="ml-1 text-[10px] text-ink-dim">{suffix}</span> : null}
      </div>
    </div>
  );
}
