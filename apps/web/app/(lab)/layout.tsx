import Link from 'next/link';
import { Nav } from '@/components/nav';
import { Indicators } from '@/components/indicators';
import { apiGet } from '@/lib/server-api';
import type { Meta, SessionUser } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function LabLayout({ children }: { children: React.ReactNode }) {
  const [meta, session] = await Promise.all([
    apiGet<Meta>('/api/meta'),
    apiGet<{ user: SessionUser | null }>('/api/me'),
  ]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-ground/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1480px] items-center gap-6 px-5">
          <Link href="/problems" className="group flex items-baseline gap-2 py-3">
            <span className="mono text-[15px] font-semibold tracking-[0.16em] text-ink">
              SAVE US
            </span>
            <span className="mono hidden text-[10px] uppercase tracking-[0.14em] text-ink-dim sm:inline">
              research operations
            </span>
          </Link>
          <div className="ml-auto">
            <Nav user={session.user} />
          </div>
        </div>
      </header>

      <Indicators stats={meta.stats} ai={meta.ai} />

      <main className="mx-auto max-w-[1480px] px-5 py-6">{children}</main>

      <footer className="mt-16 border-t border-line">
        <div className="mx-auto flex max-w-[1480px] flex-wrap items-center gap-x-6 gap-y-2 px-5 py-5">
          <span className="mono text-[10px] uppercase tracking-[0.14em] text-ink-dim">SAVE US</span>
          <p className="max-w-3xl text-[11px] text-ink-dim">
            Source records point at real publications. Hypotheses, discussion, researcher accounts
            and reputation in this deployment are seeded demonstration content and are marked DEMO
            DATA. Agent output is never treated as established fact.
          </p>
          <Link
            href="/research/method"
            className="mono ml-auto text-[10px] uppercase tracking-[0.12em] text-ink-dim hover:text-signal"
          >
            How claims are labelled →
          </Link>
        </div>
      </footer>
    </div>
  );
}
