'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
        router.push('/problems');
        router.refresh();
      }}
      className="mono border border-line px-3 py-1.5 text-[10px] uppercase tracking-[0.1em] text-ink-dim transition-colors duration-150 hover:border-alert/50 hover:text-alert disabled:opacity-50"
    >
      {pending ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
