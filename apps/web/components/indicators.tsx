import type { PlatformStats } from '@/lib/types';

/**
 * The persistent top-level indicators. They sit under the nav on every lab
 * page: the four numbers that say whether this place is alive.
 */
export function Indicators({
  stats,
  ai,
}: {
  stats: PlatformStats;
  ai: { provider: string; model: string };
}) {
  const items = [
    { label: 'Active problems', value: stats.activeProblems },
    { label: 'Active researchers', value: stats.activeResearchers },
    { label: 'Hypotheses', value: stats.hypotheses },
    { label: 'Validated contributions', value: stats.validatedContributions },
  ];

  return (
    <div className="border-b border-line bg-panel">
      <div className="mx-auto flex max-w-[1480px] flex-wrap items-center gap-x-8 gap-y-2 px-5 py-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-baseline gap-2">
            <span className="label">{item.label}</span>
            <span className="mono text-[13px] text-ink">{item.value}</span>
          </div>
        ))}
        <div className="ml-auto flex items-baseline gap-2">
          <span className="label">Sources</span>
          <span className="mono text-[13px] text-ink">{stats.sources}</span>
          <span className="label ml-4">Agent runs</span>
          <span className="mono text-[13px] text-ink">{stats.agentRuns}</span>
          <span
            className="mono ml-4 text-[10px] uppercase tracking-[0.1em] text-ink-dim"
            title={`Agent runs in this deployment use the ${ai.provider} provider (${ai.model}).`}
          >
            AI: {ai.provider}
          </span>
        </div>
      </div>
    </div>
  );
}
