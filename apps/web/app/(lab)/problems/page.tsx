import { Empty } from '@saveus/ui';
import { BoardFilters } from '@/components/board-filters';
import { ProblemCard } from '@/components/problem-card';
import { SearchBox } from '@/components/search-box';
import { apiGet } from '@/lib/server-api';
import type { Meta, ProblemCard as ProblemCardType } from '@/lib/types';

export const dynamic = 'force-dynamic';

const ALLOWED = new Set([
  'domain',
  'status',
  'scale',
  'country',
  'minDifficulty',
  'maxDifficulty',
  'minUrgency',
  'q',
  'sort',
  'limit',
  'offset',
]);

export default async function ProblemBoard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (!ALLOWED.has(key)) continue;
    const single = Array.isArray(value) ? value[0] : value;
    if (single) query.set(key, single);
  }
  query.set('limit', '60');

  const [meta, result] = await Promise.all([
    apiGet<Meta>('/api/meta'),
    apiGet<{ problems: ProblemCardType[]; total: number }>(`/api/problems?${query.toString()}`),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mono text-[13px] uppercase tracking-[0.16em] text-ink">
            Global problem board
          </h1>
          <p className="mt-1.5 max-w-2xl text-[12.5px] text-ink-muted">
            Every entry is a documented, unsolved problem with sources attached. Pick one and read
            what is already known before proposing anything.
          </p>
        </div>
        <div className="w-full max-w-sm">
          <SearchBox />
        </div>
      </div>

      <BoardFilters domains={meta.domains} />

      <div className="flex items-baseline gap-3">
        <span className="mono text-[11px] text-ink-dim">
          {result.problems.length} of {result.total} problems
        </span>
      </div>

      {result.problems.length === 0 ? (
        <Empty
          title="No problems match these filters"
          hint="Clear a filter, or widen the difficulty range. The board only holds problems that passed curation, so a narrow filter can legitimately return nothing."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {result.problems.map((problem) => (
            <ProblemCard key={problem.id} problem={problem} />
          ))}
        </div>
      )}
    </div>
  );
}
