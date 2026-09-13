'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, cn } from '@saveus/ui';

interface Identity {
  handle: string;
  displayName: string;
  reputation: number;
  isAnonymous: boolean;
  bio: string | null;
}

export function SignInForm({
  identities,
  separator = false,
}: {
  identities: Identity[];
  separator?: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const endpoint = mode === 'existing' ? '/api/auth/login' : '/api/auth/register';
    const body =
      mode === 'existing'
        ? { handle: handle.trim().toLowerCase() }
        : {
            handle: handle.trim().toLowerCase(),
            displayName: displayName.trim() || undefined,
            anonymous,
          };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload?.error?.message ?? 'Sign in failed.');
        return;
      }
      router.push('/my-work');
      router.refresh();
    } catch {
      setError('Network error.');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {separator ? (
        <div className="mt-7 flex items-center gap-3">
          <span className="h-px flex-1 bg-line" />
          <span className="mono text-[9.5px] uppercase tracking-[0.14em] text-ink-dim">
            or with a handle
          </span>
          <span className="h-px flex-1 bg-line" />
        </div>
      ) : null}
    <div className="mt-8 space-y-6">
      <div className="flex gap-2">
        {(
          [
            ['existing', 'Use an existing handle'],
            ['new', 'Create a researcher account'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setMode(key)}
            className={cn(
              'mono border px-3 py-1.5 text-[10px] uppercase tracking-[0.1em] transition-colors duration-150',
              mode === key
                ? 'border-signal bg-signal/10 text-signal'
                : 'border-line text-ink-dim hover:text-ink-muted',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-3 border border-line bg-panel p-4">
        <div>
          <label className="label mb-1 block" htmlFor="handle">
            Handle
          </label>
          <input
            id="handle"
            value={handle}
            onChange={(event) => setHandle(event.target.value)}
            required
            pattern="[a-z0-9][a-z0-9_-]{2,31}"
            placeholder="lowercase, 3-32 characters"
            className="mono w-full border border-line bg-ground px-3 py-2 text-[13px] outline-none focus:border-signal/60"
          />
        </div>

        {mode === 'new' ? (
          <>
            <div>
              <label className="label mb-1 block" htmlFor="displayName">
                Display name (optional)
              </label>
              <input
                id="displayName"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className="w-full border border-line bg-ground px-3 py-2 text-[13px] outline-none focus:border-signal/60"
              />
            </div>
            <label className="flex items-center gap-2 text-[12px] text-ink-muted">
              <input
                type="checkbox"
                checked={anonymous}
                onChange={(event) => setAnonymous(event.target.checked)}
                className="accent-[var(--color-signal)]"
              />
              Mark this account anonymous — it changes nothing about what you can contribute or earn
            </label>
          </>
        ) : null}

        <Button type="submit" variant="primary" disabled={pending || handle.trim().length < 3}>
          {pending ? 'Signing in…' : mode === 'existing' ? 'Sign in' : 'Create account'}
        </Button>

        {error ? <p className="text-[12px] text-alert">{error}</p> : null}
      </form>

      {mode === 'existing' ? (
        <div>
          <p className="label mb-2">Seeded demo identities</p>
          <div className="grid gap-px border border-line bg-line sm:grid-cols-2">
            {identities.slice(0, 12).map((identity) => (
              <button
                key={identity.handle}
                type="button"
                onClick={() => setHandle(identity.handle)}
                className="bg-panel px-3 py-2.5 text-left transition-colors duration-150 hover:bg-panel-raised"
              >
                <div className="flex items-baseline gap-2">
                  <span className="mono text-[11.5px] text-ink">{identity.handle}</span>
                  <span className="mono ml-auto text-[10px] text-ink-dim">
                    {identity.reputation}
                  </span>
                </div>
                {identity.bio ? (
                  <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-ink-dim">
                    {identity.bio}
                  </p>
                ) : null}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-ink-dim">
            These accounts are seeded demonstration content. Signing in as one lets you exercise the
            full workflow without creating anything.
          </p>
        </div>
      ) : null}
    </div>
    </>
  );
}
