'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@saveus/ui';
import type { SessionUser } from '@/lib/types';

const LINKS = [
  { href: '/problems', label: 'Problems' },
  { href: '/research', label: 'Research' },
  { href: '/learn', label: 'Learn' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/my-work', label: 'My work' },
];

export function Nav({ user }: { user: SessionUser | null }) {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1">
      {LINKS.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'mono border-b-2 px-3 py-3 text-[11px] uppercase tracking-[0.11em] transition-colors duration-150',
              active
                ? 'border-signal text-ink'
                : 'border-transparent text-ink-dim hover:text-ink-muted',
            )}
          >
            {link.label}
          </Link>
        );
      })}
      <Link
        href={user ? `/profile/${user.handle}` : '/sign-in'}
        className={cn(
          'mono border-b-2 px-3 py-3 text-[11px] uppercase tracking-[0.11em] transition-colors duration-150',
          pathname.startsWith('/profile') || pathname === '/sign-in'
            ? 'border-signal text-ink'
            : 'border-transparent text-ink-dim hover:text-ink-muted',
        )}
      >
        {user ? user.handle : 'Sign in'}
      </Link>
    </nav>
  );
}
