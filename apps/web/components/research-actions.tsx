'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@saveus/ui';
import type { ResearchActionDef, ResearchSession, SessionUser } from '@/lib/types';
import { SessionView } from './session-view';

/**
 * Contextual AI research actions.
 *
 * There is no single "Ask AI" box. Each action names the agents it will run and
 * what they are for, and the result arrives as an inspectable session rather
 * than as a chat message.
 */
export function ResearchActions({
  actions,
  hypothesisId,
  hypothesisTitle,
  user,
}: {
  actions: ResearchActionDef[];
  hypothesisId: string;
  hypothesisTitle: string;
  user: SessionUser | null;
}) {
  const router = useRouter();
  const [running, setRunning] = useState<string | null>(null);
  const [session, setSession] = useState<ResearchSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: ResearchActionDef) {
    if (!user) {
      setError(
        'Sign in to run a research action. Agent runs are attributed to the person who requested them.',
      );
      return;
    }
    setRunning(action.action);
    setError(null);
    setSession(null);

    try {
      const response = await fetch('/api/research/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          action: action.action,
          question: `${action.label}: ${hypothesisTitle}`.slice(0, 400),
          hypothesisId,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.error?.message ?? 'The research action failed.');
        return;
      }
      setSession(payload.session as ResearchSession);
      router.refresh();
    } catch {
      setError('Network error. No agent run was recorded.');
    } finally {
      setRunning(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2">
        {actions.map((action) => (
          <button
            key={action.action}
            type="button"
            onClick={() => run(action)}
            disabled={running !== null}
            className={cn(
              'group border border-line bg-panel px-3 py-2.5 text-left transition-colors duration-150 hover:border-signal/50 disabled:opacity-50',
              action.action === 'FULL_REVIEW' && 'border-signal/30 bg-signal/5',
            )}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="mono text-[11px] uppercase tracking-[0.1em] text-ink group-hover:text-signal">
                {action.label}
              </span>
              {running === action.action ? (
                <span className="mono shrink-0 text-[9.5px] uppercase tracking-[0.1em] text-signal">
                  running...
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-[11.5px] leading-relaxed text-ink-dim">{action.description}</p>
            <p className="mono mt-1.5 truncate text-[9px] uppercase tracking-[0.08em] text-ink-dim/70">
              {action.pipeline.map((agent) => agent.role).join(' -> ')}
            </p>
          </button>
        ))}
      </div>

      {error ? (
        <p className="border border-alert/40 bg-alert/5 px-3 py-2 text-[12px] text-alert">
          {error}
        </p>
      ) : null}

      {running ? (
        <p className="mono border border-signal/30 bg-signal/5 px-3 py-2 text-[11.5px] text-signal">
          Running pipeline… each agent is recorded as its own run with its own findings.
        </p>
      ) : null}

      {session ? (
        <div className="border border-signal/30">
          <div className="border-b border-signal/30 bg-signal/5 px-3 py-2">
            <span className="mono text-[10px] uppercase tracking-[0.12em] text-signal">
              Session complete — this is the run you just requested
            </span>
          </div>
          <SessionView session={session} defaultOpen />
        </div>
      ) : null}
    </div>
  );
}
