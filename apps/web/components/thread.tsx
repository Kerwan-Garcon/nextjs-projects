'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { OriginTag, cn } from '@saveus/ui';
import { SourceChip } from './source-chip';
import type { Contribution, SessionUser } from '@/lib/types';

const KIND_STYLE: Record<string, { color: string; hint: string }> = {
  COMMENT: { color: 'var(--color-ink-dim)', hint: 'Context or a reading of the record' },
  EVIDENCE: { color: 'var(--color-source-claim)', hint: 'Carries a source' },
  COUNTERARGUMENT: { color: 'var(--color-warn)', hint: 'Attacks the idea' },
  MODIFICATION: { color: 'var(--color-human-hypothesis)', hint: 'Proposes a better statement' },
  QUESTION: { color: 'var(--color-inference)', hint: 'Names something unresolved' },
  EXPERIMENT: { color: 'var(--color-ok)', hint: 'Proposes a test' },
  RESULT: { color: 'var(--color-ok)', hint: 'Reports what was found' },
};

/**
 * Discussion, attached to a specific object and typed by intent. Not a feed:
 * there is no global timeline in this product, because a comment that is not
 * about a specific hypothesis or a specific piece of evidence has nowhere to go.
 */
export function Thread({
  contributions,
  user,
}: {
  contributions: Contribution[];
  user: SessionUser | null;
}) {
  if (contributions.length === 0) {
    return (
      <div className="border border-dashed border-line px-4 py-6 text-center">
        <p className="mono text-[11px] uppercase tracking-[0.1em] text-ink-dim">
          No contributions yet
        </p>
        <p className="mx-auto mt-2 max-w-md text-[12px] text-ink-dim">
          An empty thread is an opportunity, not a defect. The first useful counterargument on a
          hypothesis usually scores higher than the tenth comment.
        </p>
      </div>
    );
  }

  const ordered = [...contributions].sort((a, b) => b.score - a.score);

  return (
    <ol className="divide-y divide-line border border-line">
      {ordered.map((contribution) => (
        <ContributionItem key={contribution.id} contribution={contribution} user={user} />
      ))}
    </ol>
  );
}

function ContributionItem({
  contribution,
  user,
}: {
  contribution: Contribution;
  user: SessionUser | null;
}) {
  const router = useRouter();
  const [endorsements, setEndorsements] = useState(contribution.endorsements);
  const [pending, setPending] = useState(false);
  const [showSignals, setShowSignals] = useState(false);
  const style = KIND_STYLE[contribution.kind] ?? KIND_STYLE.COMMENT;

  async function endorse() {
    if (!user || pending) return;
    setPending(true);
    try {
      const response = await fetch(`/api/contributions/${contribution.id}/endorse`, {
        method: 'POST',
        credentials: 'same-origin',
      });
      if (response.ok) {
        const payload = await response.json();
        setEndorsements(payload.endorsements);
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  const isOwn = user?.id === contribution.author.id;

  return (
    <li className="px-4 py-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span
          className="mono border px-1.5 py-[1px] text-[9.5px] uppercase tracking-[0.1em]"
          style={{ color: style?.color, borderColor: style?.color }}
          title={style?.hint}
        >
          {contribution.kind}
        </span>
        <Link
          href={`/profile/${contribution.author.handle}`}
          className="mono text-[11.5px] text-ink-muted hover:text-signal"
        >
          {contribution.author.handle}
        </Link>
        <span className="mono text-[10px] text-ink-dim">{contribution.author.tier}</span>
        <OriginTag origin={contribution.origin} />
        <span className="mono ml-auto text-[10px] text-ink-dim">
          {new Date(contribution.createdAt).toISOString().slice(0, 10)}
        </span>
        <button
          type="button"
          onClick={() => setShowSignals((value) => !value)}
          className="mono text-[10px] text-ink-dim hover:text-signal"
          title="How this contribution was scored"
        >
          {contribution.score.toFixed(1)}/100
        </button>
      </div>

      {showSignals ? (
        <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 border border-line bg-panel-raised px-3 py-2 sm:grid-cols-3">
          {Object.entries(contribution.signals).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between gap-2">
              <dt className="label">{key.replace(/([A-Z])/g, ' $1')}</dt>
              <dd className="mono text-[10.5px] text-ink-muted">{Number(value).toFixed(2)}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <p className="mt-2.5 whitespace-pre-line text-[13.5px] leading-relaxed text-ink">
        {contribution.body}
      </p>

      {contribution.sources.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {contribution.sources.map((source) => (
            <SourceChip key={source.id} source={source} />
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex items-center gap-4">
        <button
          type="button"
          onClick={endorse}
          disabled={!user || isOwn || pending}
          title={
            isOwn
              ? 'You cannot endorse your own contribution'
              : user
                ? 'Mark this as useful. Endorsements feed the author’s reputation.'
                : 'Sign in to endorse'
          }
          className={cn(
            'mono text-[10px] uppercase tracking-[0.09em] transition-colors duration-150',
            !user || isOwn ? 'cursor-not-allowed text-ink-dim/50' : 'text-ink-dim hover:text-ok',
          )}
        >
          Useful · {endorsements}
        </button>
        {contribution.replies.length > 0 ? (
          <span className="mono text-[10px] text-ink-dim">
            {contribution.replies.length} replies
          </span>
        ) : null}
      </div>

      {contribution.replies.length > 0 ? (
        <ul className="mt-3 space-y-2 border-l border-line pl-4">
          {contribution.replies.map((reply) => (
            <li key={reply.id}>
              <div className="flex items-center gap-2">
                <Link
                  href={`/profile/${reply.author.handle}`}
                  className="mono text-[11px] text-ink-muted hover:text-signal"
                >
                  {reply.author.handle}
                </Link>
                <OriginTag origin={reply.author.origin} />
                <span className="mono text-[10px] text-ink-dim">
                  {new Date(reply.createdAt).toISOString().slice(0, 10)}
                </span>
              </div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">{reply.body}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}
