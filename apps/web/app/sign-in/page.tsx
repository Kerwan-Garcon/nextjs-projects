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

export default async function SignInPage() {
  const { identities } = await apiGet<{ identities: Identity[] }>('/api/auth/identities');

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
      <SignInForm identities={identities} />
    </div>
  );
}
