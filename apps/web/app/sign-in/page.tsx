import Link from 'next/link';
import { SignInForm } from '@/components/sign-in-form';
import { apiGet } from '@/lib/server-api';

export const dynamic = 'force-dynamic';

interface Identity {
  handle: string;
  displayName: string;
  reputation: number;
  isAnonymous: boolean;
  bio: string | null;
}

const ERRORS: Readonly<Record<string, string>> = {
  cancelled: 'Sign-in with Google was cancelled. Nothing was created.',
  denied: 'Google declined the sign-in request.',
  incomplete: 'Google sent an incomplete response. Try again.',
  expired: 'That sign-in attempt expired or was already used. Start again.',
  refused: 'The identity Google returned could not be verified, so no session was created.',
  unverified:
    'Google has not verified that address, so it cannot be used to claim an account here.',
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ identities }, providers, query] = await Promise.all([
    apiGet<{ identities: Identity[] }>('/api/auth/identities'),
    apiGet<{ handle: boolean; google: boolean }>('/api/auth/providers'),
    searchParams,
  ]);

  const failure = query.error ? (ERRORS[query.error] ?? 'That sign-in did not complete.') : null;

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Link
        href="/problems"
        className="mono text-[10px] uppercase tracking-[0.12em] text-ink-dim hover:text-signal"
      >
        ← Board
      </Link>
      <h1 className="mt-6 text-[24px] font-semibold tracking-[-0.01em]">Sign in</h1>
      <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-ink-muted">
        There are no passwords here. What the platform needs is a stable author for a contribution,
        not proof of who you are — so create a handle, or take one of the seeded demo identities to
        look around.
      </p>
      {failure ? (
        <p className="mt-5 border border-alert/40 bg-alert/5 px-3 py-2.5 text-[12.5px] text-alert">
          {failure}
        </p>
      ) : null}

      {providers.google ? (
        <div className="mt-6 space-y-2">
          <a
            href="/api/auth/google/start?returnTo=%2Fmy-work"
            className="mono inline-flex items-center gap-2.5 border border-line-strong bg-panel-raised px-4 py-2.5 text-[11.5px] uppercase tracking-[0.1em] text-ink transition-colors hover:border-signal/50 hover:text-signal"
          >
            <svg viewBox="0 0 18 18" aria-hidden className="h-[14px] w-[14px]">
              <path
                fill="currentColor"
                d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
              />
              <path
                fill="currentColor"
                opacity="0.75"
                d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
              />
              <path
                fill="currentColor"
                opacity="0.5"
                d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
              />
              <path
                fill="currentColor"
                opacity="0.9"
                d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
              />
            </svg>
            Continue with Google
          </a>
          <p className="text-[11.5px] leading-relaxed text-ink-dim">
            Asks Google for your name, email and picture, and nothing else. Your address is never
            shown on the board — a handle derived from it is. An account created this way carries
            exactly the same reputation as an anonymous one.
          </p>
        </div>
      ) : null}

      <SignInForm identities={identities} separator={providers.google} />
    </div>
  );
}
