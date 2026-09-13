'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@saveus/ui';
import type { SessionUser } from '@/lib/types';

/**
 * Hypothesis composer.
 *
 * The form is long on purpose. Every field corresponds to something a reader
 * needs in order to attack the idea properly, and a proposal that cannot fill
 * in its own assumptions is not ready to be argued with.
 */
export function HypothesisForm({
  problemId,
  problemSlug,
  user,
}: {
  problemId: string;
  problemSlug: string;
  user: SessionUser | null;
}) {
  const router = useRouter();
  const [fields, setFields] = useState({
    title: '',
    claim: '',
    mechanism: '',
    expectedImpact: '',
    assumptions: '',
    unknowns: '',
    risks: '',
    estimatedCost: '',
    estimatedScalability: '',
    validationMethod: '',
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) {
    return (
      <div className="border border-dashed border-line px-4 py-6 text-center">
        <p className="text-[13px] text-ink-muted">Sign in to propose a hypothesis.</p>
        <a
          href="/sign-in"
          className="mono mt-3 inline-block border border-signal/60 bg-signal/10 px-4 py-2 text-[11px] uppercase tracking-[0.12em] text-signal"
        >
          Sign in
        </a>
      </div>
    );
  }

  const set =
    (key: keyof typeof fields) =>
    (event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) =>
      setFields((previous) => ({ ...previous, [key]: event.target.value }));

  const lines = (value: string): string[] =>
    value
      .split('\n')
      .map((line) => line.replace(/^[-•*]\s*/, '').trim())
      .filter((line) => line.length >= 5);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const response = await fetch('/api/hypotheses', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          problemId,
          title: fields.title.trim(),
          claim: fields.claim.trim(),
          mechanism: fields.mechanism.trim(),
          expectedImpact: fields.expectedImpact.trim(),
          assumptions: lines(fields.assumptions),
          unknowns: lines(fields.unknowns),
          risks: lines(fields.risks),
          estimatedCost: fields.estimatedCost.trim() || null,
          estimatedScalability: fields.estimatedScalability.trim() || null,
          validationMethod: fields.validationMethod.trim(),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        setError(
          payload?.error?.message ??
            'Could not create that hypothesis. Check that the claim, mechanism and validation method are filled in.',
        );
        return;
      }
      router.push(`/hypotheses/${payload.hypothesis.id}`);
      router.refresh();
    } catch {
      setError('Network error. Nothing was saved.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 border border-line bg-panel p-5">
      <Field
        label="Title"
        hint="One line. State the claim, not the topic."
        value={fields.title}
        onChange={set('title')}
        required
        minLength={10}
      />
      <Field
        label="Claim"
        hint="Precise enough to be wrong. Minimum 40 characters."
        value={fields.claim}
        onChange={set('claim')}
        rows={3}
        required
        minLength={40}
      />
      <Field
        label="Proposed mechanism"
        hint="How the effect happens, step by step. Minimum 40 characters."
        value={fields.mechanism}
        onChange={set('mechanism')}
        rows={6}
        required
        minLength={40}
      />
      <Field
        label="Expected impact"
        hint="What changes, and roughly by how much. UNKNOWN is an acceptable answer."
        value={fields.expectedImpact}
        onChange={set('expectedImpact')}
        rows={3}
        required
        minLength={20}
      />
      <Field
        label="Required assumptions"
        hint="One per line. If an assumption fails, the claim should fail with it."
        value={fields.assumptions}
        onChange={set('assumptions')}
        rows={4}
        required
      />
      <Field
        label="Unknowns"
        hint="One per line. What you genuinely do not know. This field earns more trust than any other."
        value={fields.unknowns}
        onChange={set('unknowns')}
        rows={3}
      />
      <Field
        label="Potential risks"
        hint="One per line. Including the ways this could make things worse."
        value={fields.risks}
        onChange={set('risks')}
        rows={3}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Estimated cost"
          hint="Leave empty for UNKNOWN rather than guessing."
          value={fields.estimatedCost}
          onChange={set('estimatedCost')}
        />
        <Field
          label="Estimated scalability"
          hint="What binds the scale: material, labour, permitting, capital?"
          value={fields.estimatedScalability}
          onChange={set('estimatedScalability')}
        />
      </div>
      <Field
        label="Validation method"
        hint="How a third party could test this and get the same answer. Minimum 20 characters."
        value={fields.validationMethod}
        onChange={set('validationMethod')}
        rows={4}
        required
        minLength={20}
      />

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Creating…' : 'Create hypothesis'}
        </Button>
        <a
          href={`/problems/${problemSlug}`}
          className="mono text-[11px] uppercase tracking-[0.1em] text-ink-dim hover:text-ink"
        >
          Cancel
        </a>
        <span className="mono ml-auto text-[10px] text-ink-dim">
          It will be created as DRAFT. Status is derived from the evidence record afterwards.
        </span>
      </div>

      {error ? (
        <p className="border border-alert/40 bg-alert/5 px-3 py-2 text-[12px] text-alert">
          {error}
        </p>
      ) : null}
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
  hint: string;
  rows?: number;
} & React.InputHTMLAttributes<HTMLInputElement> &
  React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const shared =
    'w-full border border-line bg-ground px-3 py-2 text-[13px] leading-relaxed text-ink outline-none transition-colors duration-150 placeholder:text-ink-dim focus:border-signal/60';

  return (
    <div>
      <label className="label mb-1 block">{label}</label>
      {rows ? (
        <textarea {...props} rows={rows} className={`${shared} resize-y`} />
      ) : (
        <input {...(props as React.InputHTMLAttributes<HTMLInputElement>)} className={shared} />
      )}
      <p className="mt-1 text-[11px] text-ink-dim">{hint}</p>
    </div>
  );
}
