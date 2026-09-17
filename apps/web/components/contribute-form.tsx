'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, cn } from '@saveus/ui';
import type { SessionUser } from '@/lib/types';

const KINDS = [
  { key: 'COMMENT', label: 'Comment', hint: 'Context or a reading of the record.' },
  { key: 'EVIDENCE', label: 'Evidence', hint: 'A source that bears on the claim.' },
  { key: 'COUNTERARGUMENT', label: 'Counterargument', hint: 'Attack the idea, not the person.' },
  { key: 'MODIFICATION', label: 'Modification', hint: 'A narrower or better-stated version.' },
  { key: 'QUESTION', label: 'Question', hint: 'Something the record does not answer.' },
  { key: 'EXPERIMENT', label: 'Experiment', hint: 'A design that would settle it.' },
  { key: 'RESULT', label: 'Result', hint: 'What you found when you checked.' },
] as const;

type Kind = (typeof KINDS)[number]['key'];

/**
 * The contribution composer.
 *
 * Choosing a kind is not decoration: it changes how the contribution is scored
 * and what the reader expects from it. The scoring note under the form says so
 * plainly, because a scoring system nobody understands is just a black box.
 */
export function ContributeForm({
  targetType,
  targetId,
  user,
  defaultKind = 'COMMENT',
}: {
  targetType: 'PROBLEM' | 'HYPOTHESIS';
  targetId: string;
  user: SessionUser | null;
  defaultKind?: Kind;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>(defaultKind);
  const [body, setBody] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceTitle, setSourceTitle] = useState('');
  const [sourcePublisher, setSourcePublisher] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ score: number; delta: number; reputation: number } | null>(
    null,
  );

  const needsSource = kind === 'EVIDENCE';

  if (!user) {
    return (
      <div className="border border-dashed border-line px-4 py-5 text-center">
        <p className="text-[12.5px] text-ink-muted">
          Sign in to contribute. Any identity works, including an anonymous one — standing here
          comes from what you contribute, not from who you are.
        </p>
        <a
          href="/sign-in"
          className="mono mt-3 inline-block border border-signal/60 bg-signal/10 px-4 py-2 text-[11px] uppercase tracking-[0.12em] text-signal"
        >
          Sign in
        </a>
      </div>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/contributions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          kind,
          targetType,
          targetId,
          body,
          sourceIds: [],
          newSources:
            needsSource && sourceUrl.trim()
              ? [
                  {
                    title: sourceTitle.trim() || sourceUrl.trim(),
                    url: sourceUrl.trim(),
                    publisher: sourcePublisher.trim() || 'UNKNOWN',
                    sourceType: 'OTHER',
                    publicationDate: null,
                    authors: [],
                  },
                ]
              : [],
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.error?.message ?? 'Could not post that contribution.');
        return;
      }

      setResult({
        score: payload.score,
        delta: payload.reputationDelta,
        reputation: payload.newReputation,
      });
      setBody('');
      setSourceUrl('');
      setSourceTitle('');
      setSourcePublisher('');
      router.refresh();
    } catch {
      setError('Network error. The contribution was not saved.');
    } finally {
      setPending(false);
    }
  }

  const active = KINDS.find((entry) => entry.key === kind);

  return (
    <form onSubmit={submit} className="border border-line bg-panel">
      <div className="flex flex-wrap gap-1.5 border-b border-line px-4 py-3">
        {KINDS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            title={entry.hint}
            onClick={() => setKind(entry.key)}
            className={cn(
              'mono border px-2 py-[3px] text-[10px] uppercase tracking-[0.09em] transition-colors duration-150',
              kind === entry.key
                ? 'border-signal bg-signal/10 text-signal'
                : 'border-line text-ink-dim hover:border-line-strong hover:text-ink-muted',
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div className="px-4 py-3">
        <p className="mb-2 text-[11.5px] text-ink-dim">{active?.hint}</p>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={5}
          required
          minLength={20}
          placeholder={
            kind === 'COUNTERARGUMENT'
              ? 'Which assumption fails, and what would we observe if it did?'
              : kind === 'EVIDENCE'
                ? 'What does this source establish, and what does it not establish?'
                : 'Say the thing precisely enough that someone could disagree with it.'
          }
          className="w-full resize-y border border-line bg-ground px-3 py-2.5 text-[13px] leading-relaxed text-ink outline-none transition-colors duration-150 placeholder:text-ink-dim focus:border-signal/60"
        />

        {needsSource ? (
          <div className="mt-3 space-y-2 border border-dashed border-line p-3">
            <p className="label">Source (required for evidence)</p>
            <input
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              placeholder="https://publisher.example/report"
              required
              className="mono w-full border border-line bg-ground px-2.5 py-1.5 text-[12px] outline-none focus:border-signal/60"
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                value={sourceTitle}
                onChange={(event) => setSourceTitle(event.target.value)}
                placeholder="Title as published"
                className="w-full border border-line bg-ground px-2.5 py-1.5 text-[12px] outline-none focus:border-signal/60"
              />
              <input
                value={sourcePublisher}
                onChange={(event) => setSourcePublisher(event.target.value)}
                placeholder="Publisher"
                className="w-full border border-line bg-ground px-2.5 py-1.5 text-[12px] outline-none focus:border-signal/60"
              />
            </div>
            <p className="text-[11px] text-ink-dim">
              The URL is validated and canonicalised, and reliability is assigned from the
              platform&rsquo;s published publisher list — not by a model.
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3">
        <Button type="submit" variant="primary" disabled={pending || body.trim().length < 20}>
          {pending ? 'Posting…' : 'Post contribution'}
        </Button>
        <span className="mono text-[10px] text-ink-dim">
          {body.trim().length} chars · scored on relevance, novelty, evidence, reproducibility,
          impact
        </span>
      </div>

      {error ? (
        <p className="border-t border-alert/40 bg-alert/5 px-4 py-2.5 text-[12px] text-alert">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="border-t border-ok/40 bg-ok/5 px-4 py-2.5">
          <p className="mono text-[11.5px] text-ok">
            Posted. Quality score {result.score.toFixed(1)}/100 · reputation{' '}
            {result.delta >= 0 ? '+' : ''}
            {result.delta} → {result.reputation}
          </p>
          <p className="mt-1 text-[11px] text-ink-dim">
            Repeated contributions on the same problem are damped: the engine rewards what you add,
            not how often you post.
          </p>
        </div>
      ) : null}
    </form>
  );
}
