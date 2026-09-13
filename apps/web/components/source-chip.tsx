import { Badge } from '@saveus/ui';
import type { Source } from '@/lib/types';

const RELIABILITY_TONE = {
  HIGH: 'ok',
  MEDIUM: 'signal',
  LOW: 'warn',
  UNKNOWN: 'neutral',
} as const;

/**
 * Every citation in the product is a link to the publisher, with the publisher
 * and the platform's reliability classification attached. There is no way to
 * cite something here without showing where it came from.
 */
export function SourceChip({ source, compact = false }: { source: Source; compact?: boolean }) {
  const year = source.publicationDate?.slice(0, 4);
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noreferrer noopener"
      title={`${source.title} — ${source.publisher}${year ? ` (${year})` : ''}\nReliability: ${source.reliability}${
        source.reliabilityNote ? `\n${source.reliabilityNote}` : ''
      }`}
      className="group inline-flex max-w-full items-center gap-1.5 border border-line bg-panel-raised px-2 py-[3px] transition-colors duration-150 hover:border-signal/50"
    >
      <span
        className="mono shrink-0 text-[9.5px] uppercase tracking-[0.09em]"
        style={{
          color:
            source.reliability === 'HIGH'
              ? 'var(--color-ok)'
              : source.reliability === 'MEDIUM'
                ? 'var(--color-signal)'
                : 'var(--color-ink-dim)',
        }}
      >
        {source.reliability}
      </span>
      <span
        className={`truncate text-[11.5px] text-ink-muted group-hover:text-ink ${compact ? 'max-w-[320px]' : ''}`}
      >
        {source.title}
      </span>
      <span className="mono shrink-0 text-[10px] text-ink-dim">
        {compact
          ? (year ?? source.publisher.split(/[\s/]/)[0])
          : `${source.publisher}${year ? ` · ${year}` : ''}`}
      </span>
    </a>
  );
}

export function SourceRow({ source }: { source: Source }) {
  const year = source.publicationDate?.slice(0, 4);
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noreferrer noopener"
      className="group grid grid-cols-[1fr_auto] items-start gap-4 border-b border-line px-4 py-3 transition-colors duration-150 last:border-b-0 hover:bg-panel-raised"
    >
      <div className="min-w-0">
        <div className="text-[13px] leading-snug text-ink group-hover:text-signal">
          {source.title}
        </div>
        <div className="mono mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-ink-dim">
          <span>{source.publisher}</span>
          {year ? <span>{year}</span> : <span className="italic">no date</span>}
          <span>{source.sourceType.replace(/_/g, ' ')}</span>
          <span className="text-ink-dim/70">{source.domain}</span>
          {source.authors.length > 0 ? (
            <span className="truncate">{source.authors.slice(0, 2).join('; ')}</span>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Badge
          tone={RELIABILITY_TONE[source.reliability]}
          title={source.reliabilityNote ?? undefined}
        >
          {source.reliability}
        </Badge>
        <span
          className="mono text-[9px] text-ink-dim/60"
          title="Content fingerprint used for deduplication"
        >
          {source.contentHash.slice(0, 10)}
        </span>
      </div>
    </a>
  );
}
