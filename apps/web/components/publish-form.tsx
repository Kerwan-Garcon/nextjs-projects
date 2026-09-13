'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@saveus/ui';
import type { IntakeCandidate, Meta } from '@/lib/types';

/**
 * The problem editor.
 *
 * An approved candidate is a lead, not a problem. This is where a named human
 * turns it into one, and the form is shaped by the publication checklist rather
 * than by what is convenient to type: a factual description, consequences that
 * carry a source, at least one magnitude, constraints, and success criteria
 * somebody could actually measure.
 *
 * The server re-runs that checklist against whatever is submitted here. The
 * form cannot talk its way past it, and neither can the curator's approval.
 */

const SCALES = ['GLOBAL', 'CONTINENTAL', 'NATIONAL', 'REGIONAL', 'CITY'] as const;

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
] as const;

export function PublishForm({ candidate, meta }: { candidate: IntakeCandidate; meta: Meta }) {
  const router = useRouter();
  const candidateSourceIds = candidate.sources.map((source) => source.id);

  const [fields, setFields] = useState({
    title: '',
    summary: '',
    description: candidate.draft?.description ?? '',
    whyItMatters: (candidate.draft?.whyItMatters ?? []).map((item) => item.text).join('\n'),
    currentKnowledge: '',
    openQuestions: (candidate.draft?.openQuestions ?? []).join('\n'),
    geographyLabel: '',
    geographyScale: 'GLOBAL' as (typeof SCALES)[number],
    countryCode: '',
    difficulty: 6,
    urgency: 6,
    budget: '',
    time: '',
    geography: '',
    technology: '',
    political: '',
  });
  const [domains, setDomains] = useState<string[]>(candidate.proposedDomains.slice(0, 3));
  const [criteria, setCriteria] = useState([{ metric: '', target: '', horizon: '' }]);
  const [extraSource, setExtraSource] = useState({
    title: '',
    url: '',
    publisher: '',
    sourceType: 'REPORT' as string,
    publicationDate: '',
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocking, setBlocking] = useState<string[]>([]);

  const set =
    (key: keyof typeof fields) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setFields((previous) => ({ ...previous, [key]: event.target.value }));

  const lines = (value: string): string[] =>
    value
      .split('\n')
      .map((line) => line.replace(/^[-•*]\s*/, '').trim())
      .filter((line) => line.length >= 10);

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setPending(true);
    setError(null);
    setBlocking([]);

    const hasExtraSource = extraSource.url.trim().length > 0 && extraSource.title.trim().length > 0;

    try {
      const response = await fetch('/api/problems', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          candidateId: candidate.id,
          title: fields.title.trim(),
          summary: fields.summary.trim(),
          description: fields.description.trim(),
          // Every consequence is attributed to the candidate's own source. The
          // checklist refuses a problem whose consequences cite nothing.
          whyItMatters: lines(fields.whyItMatters).map((text) => ({
            text,
            kind: 'SOURCE_CLAIM',
            sourceIds: candidateSourceIds,
          })),
          currentKnowledge: lines(fields.currentKnowledge).map((text) => ({
            text,
            kind: 'SOURCE_CLAIM',
            sourceIds: candidateSourceIds,
          })),
          constraints: {
            budget: fields.budget.trim() || null,
            time: fields.time.trim() || null,
            geography: fields.geography.trim() || null,
            technology: fields.technology.trim() || null,
            political: fields.political.trim() || null,
          },
          successCriteria: criteria
            .filter((row) => row.metric.trim() && row.target.trim() && row.horizon.trim())
            .map((row) => ({
              metric: row.metric.trim(),
              target: row.target.trim(),
              horizon: row.horizon.trim(),
              measurement: null,
            })),
          openQuestions: lines(fields.openQuestions),
          geographyLabel: fields.geographyLabel.trim(),
          geographyScale: fields.geographyScale,
          countryCode: fields.countryCode.trim().toUpperCase() || null,
          difficulty: Number(fields.difficulty),
          urgency: Number(fields.urgency),
          domains,
          sourceIds: candidateSourceIds,
          newSources: hasExtraSource
            ? [
                {
                  title: extraSource.title.trim(),
                  url: extraSource.url.trim(),
                  publisher: extraSource.publisher.trim() || null,
                  sourceType: extraSource.sourceType,
                  publicationDate: extraSource.publicationDate.trim() || null,
                },
              ]
            : [],
        }),
      });

      const payload = (await response.json()) as {
        slug?: string;
        error?: { message?: string; details?: unknown };
      };

      if (!response.ok) {
        setError(payload.error?.message ?? 'The problem statement was refused.');
        if (Array.isArray(payload.error?.details)) {
          setBlocking(payload.error.details.filter((item): item is string => typeof item === 'string'));
        }
        return;
      }

      router.push(`/problems/${payload.slug}`);
      router.refresh();
    } catch {
      setError('Network error. Nothing was published.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5 border border-line bg-panel p-5">
      <Field
        label="Title"
        hint="State the problem, not the paper. 20-200 characters."
        value={fields.title}
        onChange={set('title')}
        required
        minLength={20}
      />
      <Field
        label="Summary"
        hint="One or two sentences a reader can scan on the board."
        value={fields.summary}
        onChange={set('summary')}
        rows={2}
        required
        minLength={20}
      />
      <Field
        label="Factual description"
        hint="What is actually happening, in your words, with the evidence behind it. At least 300 characters. The intake draft is a starting point, not text to publish."
        value={fields.description}
        onChange={set('description')}
        rows={10}
        required
        minLength={300}
      />
      <Field
        label="Why it matters"
        hint="One consequence per line. At least one must carry a magnitude — a rate, a count, a cost. Each line is attributed to the source below."
        value={fields.whyItMatters}
        onChange={set('whyItMatters')}
        rows={4}
        required
      />
      <Field
        label="What is already known"
        hint="Optional. One statement per line, attributed to the same source."
        value={fields.currentKnowledge}
        onChange={set('currentKnowledge')}
        rows={3}
      />
      <Field
        label="Open questions"
        hint="One per line. A problem with no open questions is a report."
        value={fields.openQuestions}
        onChange={set('openQuestions')}
        rows={4}
      />

      <fieldset className="space-y-2">
        <span className="label">Success criteria</span>
        <p className="text-[11.5px] text-ink-dim">
          Metric, target and horizon. At least one complete row, or publication is refused.
        </p>
        {criteria.map((row, index) => (
          <div key={index} className="grid gap-2 sm:grid-cols-[1fr_140px_120px]">
            {(['metric', 'target', 'horizon'] as const).map((key) => (
              <input
                key={key}
                value={row[key]}
                placeholder={key}
                onChange={(event) =>
                  setCriteria((previous) =>
                    previous.map((entry, position) =>
                      position === index ? { ...entry, [key]: event.target.value } : entry,
                    ),
                  )
                }
                className="border border-line bg-panel-raised px-2.5 py-1.5 text-[12px] text-ink outline-none placeholder:text-ink-dim focus:border-signal/50"
              />
            ))}
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setCriteria((previous) => [...previous, { metric: '', target: '', horizon: '' }])}
        >
          Add criterion
        </Button>
      </fieldset>

      <fieldset className="space-y-2">
        <span className="label">Constraints</span>
        <p className="text-[11.5px] text-ink-dim">
          At least two of the five. A problem with no constraints attracts solutions that ignore
          reality.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {(['budget', 'time', 'geography', 'technology', 'political'] as const).map((key) => (
            <input
              key={key}
              value={fields[key]}
              placeholder={key}
              onChange={set(key)}
              className="border border-line bg-panel-raised px-2.5 py-1.5 text-[12px] text-ink outline-none placeholder:text-ink-dim focus:border-signal/50"
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <span className="label">Scope</span>
        <div className="grid gap-2 sm:grid-cols-3">
          <input
            value={fields.geographyLabel}
            placeholder="Where (e.g. Paris, Sahel, Global)"
            onChange={set('geographyLabel')}
            required
            minLength={2}
            className="border border-line bg-panel-raised px-2.5 py-1.5 text-[12px] text-ink outline-none placeholder:text-ink-dim focus:border-signal/50"
          />
          <select
            value={fields.geographyScale}
            onChange={set('geographyScale')}
            className="mono border border-line bg-panel-raised px-2.5 py-1.5 text-[11px] uppercase tracking-[0.08em] text-ink outline-none focus:border-signal/50"
          >
            {SCALES.map((scale) => (
              <option key={scale} value={scale}>
                {scale}
              </option>
            ))}
          </select>
          <input
            value={fields.countryCode}
            placeholder="ISO country (optional)"
            maxLength={2}
            onChange={set('countryCode')}
            className="border border-line bg-panel-raised px-2.5 py-1.5 text-[12px] text-ink outline-none placeholder:text-ink-dim focus:border-signal/50"
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {(['difficulty', 'urgency'] as const).map((key) => (
            <label key={key} className="flex items-center gap-3">
              <span className="mono w-20 text-[10px] uppercase tracking-[0.1em] text-ink-dim">
                {key}
              </span>
              <input
                type="range"
                min={0}
                max={10}
                value={fields[key]}
                onChange={set(key)}
                className="flex-1"
              />
              <span className="mono w-6 text-[11px] text-ink">{fields[key]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <span className="label">Domains</span>
        <div className="flex flex-wrap gap-1.5">
          {meta.domains.map((domain) => {
            const selected = domains.includes(domain.key);
            return (
              <button
                key={domain.key}
                type="button"
                onClick={() =>
                  setDomains((previous) =>
                    selected
                      ? previous.filter((key) => key !== domain.key)
                      : previous.length >= 4
                        ? previous
                        : [...previous, domain.key],
                  )
                }
                className={`mono border px-2 py-1 text-[10px] uppercase tracking-[0.09em] transition-colors ${
                  selected
                    ? 'border-signal/50 bg-signal/10 text-signal'
                    : 'border-line text-ink-dim hover:border-line-strong'
                }`}
              >
                {domain.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="space-y-2 border-t border-line pt-4">
        <span className="label">Corroborating source</span>
        <p className="text-[11.5px] text-ink-dim">
          The checklist wants two distinct sources and at least one of high reliability. The
          candidate brought{' '}
          {candidate.sources.length === 1 ? 'one' : String(candidate.sources.length)}:{' '}
          {candidate.sources.map((source) => source.publisher).join(', ')}. Add a second here.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            value={extraSource.url}
            placeholder="https://..."
            onChange={(event) => setExtraSource((s) => ({ ...s, url: event.target.value }))}
            className="border border-line bg-panel-raised px-2.5 py-1.5 text-[12px] text-ink outline-none placeholder:text-ink-dim focus:border-signal/50"
          />
          <input
            value={extraSource.title}
            placeholder="Title as published"
            onChange={(event) => setExtraSource((s) => ({ ...s, title: event.target.value }))}
            className="border border-line bg-panel-raised px-2.5 py-1.5 text-[12px] text-ink outline-none placeholder:text-ink-dim focus:border-signal/50"
          />
          <input
            value={extraSource.publisher}
            placeholder="Publisher"
            onChange={(event) => setExtraSource((s) => ({ ...s, publisher: event.target.value }))}
            className="border border-line bg-panel-raised px-2.5 py-1.5 text-[12px] text-ink outline-none placeholder:text-ink-dim focus:border-signal/50"
          />
          <select
            value={extraSource.sourceType}
            onChange={(event) => setExtraSource((s) => ({ ...s, sourceType: event.target.value }))}
            className="mono border border-line bg-panel-raised px-2.5 py-1.5 text-[11px] uppercase tracking-[0.08em] text-ink outline-none focus:border-signal/50"
          >
            {SOURCE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      {error ? (
        <div className="border border-alert/40 bg-alert/5 px-3 py-2.5">
          <p className="text-[12px] text-alert">{error}</p>
          {blocking.length > 0 ? (
            <ul className="mt-1.5 space-y-0.5">
              {blocking.map((item) => (
                <li key={item} className="text-[11.5px] text-alert">
                  ✗ {item}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center gap-3 border-t border-line pt-4">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Publishing…' : 'Publish to the board'}
        </Button>
        <p className="text-[11.5px] text-ink-dim">
          Published under your handle. The checklist runs again on the server against exactly what
          you wrote.
        </p>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  rows,
  ...props
}: {
  label: string;
  hint?: string;
  rows?: number;
} & React.InputHTMLAttributes<HTMLInputElement> &
  React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const shared =
    'w-full border border-line bg-panel-raised px-2.5 py-2 text-[12.5px] leading-relaxed text-ink outline-none placeholder:text-ink-dim focus:border-signal/50';

  return (
    <label className="block">
      <span className="label">{label}</span>
      {hint ? <p className="mb-1.5 mt-0.5 text-[11.5px] text-ink-dim">{hint}</p> : null}
      {rows ? (
        <textarea {...props} rows={rows} className={shared} />
      ) : (
        <input {...props} className={shared} />
      )}
    </label>
  );
}
