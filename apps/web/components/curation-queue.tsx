'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Badge, Button } from '@saveus/ui';
import type { IntakeCandidate, SessionUser } from '@/lib/types';

/**
 * The curation queue.
 *
 * This is the one screen where the automated half of the platform meets the
 * human half, so it shows its work: the relevance score the gate assigned, the
 * signals that fired, the checklist items still failing, and the source the
 * candidate came from. Approving does not publish anything - it unlocks the
 * problem editor, where a curator has to write the statement themselves.
 */
export function CurationQueue({
  candidates,
  user,
}: {
  candidates: IntakeCandidate[];
  user: SessionUser | null;
}) {
  if (candidates.length === 0) {
    return (
      <p className="px-4 py-6 text-[12px] text-ink-dim">
        Nothing is waiting for curation. The gate records everything it rejected below.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-line">
      {candidates.map((candidate) => (
        <CandidateRow key={candidate.id} candidate={candidate} user={user} />
      ))}
    </ul>
  );
}

function CandidateRow({
  candidate,
  user,
}: {
  candidate: IntakeCandidate;
  user: SessionUser | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<'APPROVE' | 'REJECT' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);

  async function decide(decision: 'APPROVE' | 'REJECT'): Promise<void> {
    setPending(decision);
    setError(null);
    try {
      const response = await fetch(`/api/ingestion/candidates/${candidate.id}/curate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ decision, note: note.trim() || null }),
      });
      const payload = (await response.json()) as {
        outcome?: { reason?: string };
        error?: { message?: string };
      };
      if (!response.ok) {
        setError(payload.outcome?.reason ?? payload.error?.message ?? 'The decision was refused.');
        return;
      }
      router.refresh();
    } catch {
      setError('Network error. Nothing was recorded.');
    } finally {
      setPending(null);
    }
  }

  const pendingCuration = candidate.status === 'PENDING_CURATION';
  const gapSignals = candidate.assessment?.matched ?? [];

  return (
    <li className="px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={pendingCuration ? 'warn' : candidate.status === 'REJECTED' ? 'alert' : 'ok'}>
          {candidate.status.replace(/_/g, ' ')}
        </Badge>
        <span className="mono text-[10px] text-ink-dim">{candidate.connector}</span>
        <span
          className="mono text-[10px] text-ink-dim"
          title="Intake relevance, 0-100. Gap language and stakes carry it."
        >
          relevance {candidate.relevanceScore.toFixed(0)}
        </span>
        <span className="mono text-[10px] text-ink-dim" title="Publication checklist score">
          checklist {candidate.curationScore.toFixed(0)}/100
        </span>
        {candidate.proposedDomains.map((domain) => (
          <span key={domain} className="mono text-[9.5px] uppercase tracking-[0.1em] text-ink-dim">
            {domain}
          </span>
        ))}
      </div>

      <p className="mt-2 text-[13px] leading-snug text-ink">{candidate.title}</p>
      <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">{candidate.summary}</p>

      {candidate.sources.length > 0 ? (
        <p className="mt-2 text-[11.5px] text-ink-dim">
          Source:{' '}
          <a
            href={candidate.sources[0]?.url}
            target="_blank"
            rel="noreferrer noopener"
            className="text-signal underline-offset-2 hover:underline"
          >
            {candidate.sources[0]?.publisher}
          </a>{' '}
          — {candidate.sources[0]?.title}
        </p>
      ) : null}

      {gapSignals.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {gapSignals.map((signal) => (
            <span
              key={signal}
              className="mono border border-line px-1.5 py-[1px] text-[9px] tracking-[0.05em] text-ink-dim"
            >
              {signal}
            </span>
          ))}
        </div>
      ) : null}

      {candidate.blocking.length > 0 ? (
        <div className="mt-2.5">
          <span className="label">Checklist blocking publication</span>
          <ul className="mt-1 space-y-0.5">
            {candidate.blocking.map((item) => (
              <li key={item} className="text-[11.5px] text-alert">
                ✗ {item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {candidate.warnings.length > 0 ? (
        <p className="mt-1.5 text-[11.5px] text-warn">Warnings: {candidate.warnings.join(' · ')}</p>
      ) : null}

      {candidate.curatorHandle ? (
        <p className="mono mt-2 text-[10px] text-ink-dim">
          curated by @{candidate.curatorHandle}
          {candidate.curatorNote ? ` — "${candidate.curatorNote}"` : ''}
        </p>
      ) : null}

      {candidate.publishedSlug ? (
        <Link
          href={`/problems/${candidate.publishedSlug}`}
          className="mono mt-2 inline-block text-[11px] uppercase tracking-[0.1em] text-ok"
        >
          Published →
        </Link>
      ) : null}

      {pendingCuration && user ? (
        <div className="mt-3 space-y-2">
          {showNote ? (
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
              maxLength={600}
              placeholder="Why this decision. Recorded in the audit log next to your handle."
              className="w-full border border-line bg-panel-raised px-2.5 py-2 text-[12px] text-ink outline-none placeholder:text-ink-dim focus:border-signal/50"
            />
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              disabled={pending !== null}
              onClick={() => void decide('APPROVE')}
            >
              {pending === 'APPROVE' ? 'Approving…' : 'Approve for editing'}
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={pending !== null}
              onClick={() => void decide('REJECT')}
            >
              {pending === 'REJECT' ? 'Rejecting…' : 'Reject'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowNote((value) => !value)}>
              {showNote ? 'Hide note' : 'Add note'}
            </Button>
          </div>
          <p className="text-[11px] text-ink-dim">
            Approving does not publish. It opens the problem editor, where the statement, the
            quantified consequences and the success criteria still have to be written.
          </p>
        </div>
      ) : null}

      {candidate.status === 'APPROVED' && !candidate.publishedSlug ? (
        <Link
          href={`/research/intake/${candidate.id}`}
          className="mono mt-3 inline-block border border-signal/60 bg-signal/10 px-3 py-1.5 text-[11px] uppercase tracking-[0.1em] text-signal"
        >
          Write the problem statement →
        </Link>
      ) : null}

      {!user && pendingCuration ? (
        <p className="mt-2 text-[11px] text-ink-dim">Sign in to curate.</p>
      ) : null}

      {error ? <p className="mt-2 text-[11.5px] text-alert">{error}</p> : null}
    </li>
  );
}
