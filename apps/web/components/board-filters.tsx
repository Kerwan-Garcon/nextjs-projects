'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useTransition } from 'react';
import { cn } from '@saveus/ui';
import type { Meta } from '@/lib/types';

const STATUSES = ['OPEN', 'ACTIVE_RESEARCH', 'NEEDS_EVIDENCE', 'STALLED', 'SOLUTION_CANDIDATE'];
const SCALES = ['LOCAL', 'CITY', 'REGIONAL', 'NATIONAL', 'CONTINENTAL', 'GLOBAL'];
const SORTS = [
  { key: 'urgency', label: 'Urgency' },
  { key: 'difficulty', label: 'Difficulty' },
  { key: 'activity', label: 'Activity' },
  { key: 'recent', label: 'Newest' },
];

/**
 * Filters are URL state: a filtered board is a shareable address, which matters
 * when someone wants to point a colleague at "the open water problems".
 */
export function BoardFilters({ domains }: { domains: Meta['domains'] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const update = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (value === null || next.get(key) === value) next.delete(key);
      else next.set(key, value);
      startTransition(() => {
        router.push(`${pathname}?${next.toString()}`, { scroll: false });
      });
    },
    [params, pathname, router],
  );

  const current = (key: string) => params.get(key);

  return (
    <div className={cn('space-y-3 border border-line bg-panel p-4', pending && 'opacity-70')}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="label w-[70px] shrink-0">Domain</span>
        <Chip active={!current('domain')} onClick={() => update('domain', null)}>
          All
        </Chip>
        {domains.map((domain) => (
          <Chip
            key={domain.key}
            active={current('domain') === domain.key}
            accent={domain.accent}
            onClick={() => update('domain', domain.key)}
            title={domain.description}
          >
            {domain.label}
          </Chip>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="label w-[70px] shrink-0">Status</span>
        <Chip active={!current('status')} onClick={() => update('status', null)}>
          Any
        </Chip>
        {STATUSES.map((status) => (
          <Chip
            key={status}
            active={current('status') === status}
            onClick={() => update('status', status)}
          >
            {status.replace(/_/g, ' ')}
          </Chip>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="label w-[70px] shrink-0">Scope</span>
        <Chip active={!current('scale')} onClick={() => update('scale', null)}>
          Any
        </Chip>
        {SCALES.map((scale) => (
          <Chip
            key={scale}
            active={current('scale') === scale}
            onClick={() => update('scale', scale)}
          >
            {scale}
          </Chip>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="label w-[70px] shrink-0">Difficulty</span>
        <Chip active={!current('minDifficulty')} onClick={() => update('minDifficulty', null)}>
          Any
        </Chip>
        <Chip
          active={current('minDifficulty') === '8'}
          onClick={() => update('minDifficulty', '8')}
        >
          Hardest (8+)
        </Chip>
        <Chip
          active={current('maxDifficulty') === '6'}
          onClick={() => update('maxDifficulty', '6')}
        >
          Approachable (≤6)
        </Chip>
        <Chip active={current('minUrgency') === '8'} onClick={() => update('minUrgency', '8')}>
          Most urgent (8+)
        </Chip>

        <span className="label ml-auto">Sort</span>
        {SORTS.map((sort) => (
          <Chip
            key={sort.key}
            active={(current('sort') ?? 'urgency') === sort.key}
            onClick={() => update('sort', sort.key)}
          >
            {sort.label}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function Chip({
  children,
  active,
  accent,
  onClick,
  title,
}: {
  children: React.ReactNode;
  active: boolean;
  accent?: string;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={active && accent ? { color: accent, borderColor: accent } : undefined}
      className={cn(
        'mono border px-2 py-[3px] text-[10px] uppercase tracking-[0.09em] transition-colors duration-150',
        active
          ? 'border-signal bg-signal/10 text-signal'
          : 'border-line text-ink-dim hover:border-line-strong hover:text-ink-muted',
      )}
    >
      {children}
    </button>
  );
}
