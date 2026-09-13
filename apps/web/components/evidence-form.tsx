'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, cn } from '@saveus/ui';
import type { SessionUser } from '@/lib/types';

const STANCES = [
  { key: 'SUPPORTS', label: 'Supports', color: 'var(--color-ok)' },
  { key: 'CONTRADICTS', label: 'Contradicts', color: 'var(--color-alert)' },
  { key: 'CONTEXT', label: 'Context', color: 'var(--color-ink-dim)' },
] as const;

const SOURCE_TYPES = [
  'SCIENTIFIC_PAPER',
  'GOVERNMENT',
  'UN',
  'DATASET',
  'INSTITUTION',
  'NEWS',
  'PATENT',
  'REPORT',
  'OTHER',
];

/**
 * Attaching evidence. The claim field asks what the source establishes, not
 * what the contributor believes - the distinction the whole evidence system
 * rests on.
 */
export function EvidenceForm({
  hypothesisId,
  user,
  suggestedSourceId,
  suggestedSourceLabel,
}: {
  hypothesisId: string;
  user: SessionUser | null;
  suggestedSourceId?: string;
  suggestedSourceLabel?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(Boolean(suggestedSourceId));
  const [stance, setStance] = useState<(typeof STANCES)[number]['key']>('SUPPORTS');
  const [claim, setClaim] = useState('');
  const [strength, setStrength] = useState(3);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [publisher, setPublisher] = useState('');
  const [sourceType, setSourceType] = useState('REPORT');
  const [publicationDate, setPublicationDate] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!user) return null;

  if (!open) {
    return (
      <Button type="button" variant="default" size="sm" onClick={() => setOpen(true)}>
        + Attach evidence
      </Button>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const payload = suggestedSourceId
      ? { stance, claim, strength, sourceId: suggestedSourceId }
      : {
          stance,
          claim,
          strength,
          newSource: {
            title: title.trim() || url.trim(),
            url: url.trim(),
            publisher: publisher.trim() || 'UNKNOWN',
            sourceType,
            publicationDate: publicationDate.trim() || null,
            authors: [],
          },
        };

    try {
      const response = await fetch(`/api/hypotheses/${hypothesisId}/evidence`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body?.error?.message ?? 'Could not attach that evidence.');
        return;
      }
      setDone(true);
      setClaim('');
      setUrl('');
      setTitle('');
      setPublisher('');
      router.refresh();
    } catch {
      setError('Network error. Nothing was attached.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="border border-line bg-panel">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <span className="label">Attach evidence</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="mono ml-auto text-[10px] uppercase tracking-[0.1em] text-ink-dim hover:text-ink"
        >
          Close
        </button>
      </div>

      <div className="space-y-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="label w-[70px]">Stance</span>
          {STANCES.map((entry) => (
            <button
              key={entry.key}
              type="button"
              onClick={() => setStance(entry.key)}
              style={
                stance === entry.key ? { color: entry.color, borderColor: entry.color } : undefined
              }
              className={cn(
                'mono border px-2 py-[3px] text-[10px] uppercase tracking-[0.09em]',
                stance === entry.key
                  ? 'bg-panel-raised'
                  : 'border-line text-ink-dim hover:text-ink-muted',
              )}
            >
              {entry.label}
            </button>
          ))}
          <span className="label ml-4">Strength</span>
          <input
            type="range"
            min={1}
            max={5}
            value={strength}
            onChange={(event) => setStrength(Number(event.target.value))}
            className="w-24 accent-[var(--color-signal)]"
          />
          <span className="mono text-[11px] text-ink-muted">{strength}/5</span>
        </div>

        <div>
          <label className="label mb-1 block">What does this source establish?</label>
          <textarea
            value={claim}
            onChange={(event) => setClaim(event.target.value)}
            rows={3}
            required
            minLength={10}
            placeholder="State what the source shows, and where it stops. Not what you conclude from it."
            className="w-full resize-y border border-line bg-ground px-3 py-2 text-[13px] leading-relaxed outline-none focus:border-signal/60"
          />
        </div>

        {suggestedSourceId ? (
          <p className="mono border border-line bg-panel-raised px-3 py-2 text-[11.5px] text-ink-muted">
            Source: {suggestedSourceLabel ?? suggestedSourceId}
          </p>
        ) : (
          <div className="space-y-2">
            <input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              required
              placeholder="https://publisher.example/document"
              className="mono w-full border border-line bg-ground px-2.5 py-1.5 text-[12px] outline-none focus:border-signal/60"
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Title as published"
                className="w-full border border-line bg-ground px-2.5 py-1.5 text-[12px] outline-none focus:border-signal/60"
              />
              <input
                value={publisher}
                onChange={(event) => setPublisher(event.target.value)}
                placeholder="Publisher"
                className="w-full border border-line bg-ground px-2.5 py-1.5 text-[12px] outline-none focus:border-signal/60"
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <select
                value={sourceType}
                onChange={(event) => setSourceType(event.target.value)}
                className="mono w-full border border-line bg-ground px-2.5 py-1.5 text-[11px] outline-none focus:border-signal/60"
              >
                {SOURCE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
              <input
                value={publicationDate}
                onChange={(event) => setPublicationDate(event.target.value)}
                placeholder="Publication date (YYYY or YYYY-MM)"
                className="mono w-full border border-line bg-ground px-2.5 py-1.5 text-[12px] outline-none focus:border-signal/60"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 border-t border-line px-4 py-3">
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={pending || claim.trim().length < 10}
        >
          {pending ? 'Attaching…' : 'Attach evidence'}
        </Button>
        <span className="mono text-[10px] text-ink-dim">
          Attaching evidence can change the hypothesis status — it is derived from the record, not
          set by hand.
        </span>
      </div>

      {error ? (
        <p className="border-t border-alert/40 bg-alert/5 px-4 py-2 text-[12px] text-alert">
          {error}
        </p>
      ) : null}
      {done ? (
        <p className="border-t border-ok/40 bg-ok/5 px-4 py-2 text-[12px] text-ok">
          Evidence attached. The status was recomputed from the full evidence record.
        </p>
      ) : null}
    </form>
  );
}
