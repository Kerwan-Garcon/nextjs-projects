import Link from 'next/link';
import { apiGet } from '@/lib/server-api';
import type { Meta, ProblemCard as ProblemCardType } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Landing page. One screen, no marketing hero stack: the claim, the counters
 * that show the lab is populated, three real problems, and the way in.
 */
export default async function Landing() {
  const [meta, board] = await Promise.all([
    apiGet<Meta>('/api/meta'),
    apiGet<{ problems: ProblemCardType[] }>('/api/problems?limit=3&sort=urgency'),
  ]);

  return (
    <div className="min-h-screen">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between px-6 py-4">
          <span className="mono text-[15px] font-semibold tracking-[0.18em]">SAVE US</span>
          <Link
            href="/problems"
            className="mono text-[11px] uppercase tracking-[0.12em] text-ink-dim hover:text-signal"
          >
            Enter the lab →
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-[1100px] px-6 pb-14 pt-20">
        <h1 className="max-w-3xl text-[40px] font-semibold leading-[1.08] tracking-[-0.02em] sm:text-[56px]">
          The world has problems.
          <br />
          Let&rsquo;s solve them.
        </h1>
        <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-ink-muted">
          Real problems. Real evidence. Humans and AI working together.
        </p>

        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Link
            href="/problems"
            className="mono border border-signal/60 bg-signal/10 px-5 py-2.5 text-[12px] uppercase tracking-[0.12em] text-signal transition-colors duration-150 hover:bg-signal/20"
          >
            Enter the lab
          </Link>
          <Link
            href="/problems?sort=activity"
            className="mono border border-line-strong px-5 py-2.5 text-[12px] uppercase tracking-[0.12em] text-ink-muted transition-colors duration-150 hover:border-ink-dim hover:text-ink"
          >
            Explore problems
          </Link>
        </div>

        <div className="mt-16 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
          {[
            ['Open problems', meta.stats.activeProblems],
            ['Researchers', meta.stats.activeResearchers],
            ['Hypotheses', meta.stats.hypotheses],
            ['Sources catalogued', meta.stats.sources],
          ].map(([label, value]) => (
            <div key={String(label)} className="bg-ground px-5 py-4">
              <div className="label">{String(label)}</div>
              <div className="mono mt-1 text-[24px] leading-none">{String(value)}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto max-w-[1100px] px-6 py-14">
          <h2 className="label mb-6">How it works</h2>
          <ol className="grid gap-px border border-line bg-line md:grid-cols-3">
            {[
              {
                step: '01',
                title: 'A problem, stated properly',
                body: 'Constraints, success criteria, what is already known, and what is still open — each factual claim carrying its source.',
              },
              {
                step: '02',
                title: 'Hypotheses you can attack',
                body: 'Not posts. Structured objects with a mechanism, declared assumptions, admitted unknowns and a validation method. Nobody marks their own work validated.',
              },
              {
                step: '03',
                title: 'Agents as instruments',
                body: 'Contextual actions retrieve, attack and stress-test a hypothesis. Every run shows its agent, its sources, its confidence and what it could not resolve.',
              },
            ].map((item) => (
              <li key={item.step} className="bg-ground px-5 py-6">
                <div className="mono text-[11px] tracking-[0.12em] text-signal">{item.step}</div>
                <h3 className="mt-3 text-[15px] font-medium">{item.title}</h3>
                <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">{item.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto max-w-[1100px] px-6 py-14">
          <h2 className="label mb-6">Open right now</h2>
          <div className="divide-y divide-line border border-line">
            {board.problems.map((problem) => (
              <Link
                key={problem.id}
                href={`/problems/${problem.slug}`}
                className="group flex flex-wrap items-baseline gap-x-4 gap-y-1 px-5 py-4 transition-colors duration-150 hover:bg-panel"
              >
                <span className="mono text-[10px] text-ink-dim">#{problem.ref}</span>
                <span className="flex-1 text-[14px] text-ink group-hover:text-signal">
                  {problem.title}
                </span>
                <span className="mono text-[10px] uppercase tracking-[0.1em] text-ink-dim">
                  {problem.geographyLabel}
                </span>
                <span className="mono text-[10px] text-ink-dim">
                  {problem.evidenceCount} sources · {problem.hypothesisCount} hypotheses
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto max-w-[1100px] px-6 py-14">
          <p className="max-w-2xl text-[15px] leading-relaxed text-ink-muted">
            Humanity has enormous intelligence distributed across billions of people. We currently
            waste most of it. SAVE US exists to organise that intelligence against problems that are
            actually unsolved.
          </p>
          <p className="mt-6 max-w-2xl text-[12.5px] leading-relaxed text-ink-dim">
            This deployment ships with seeded demonstration content so the workflow can be used
            immediately. Source records reference real publications; hypotheses, discussion and
            researcher accounts are synthetic and marked DEMO DATA throughout. Nothing an agent
            produces is presented as fact.
          </p>
          <Link
            href="/problems"
            className="mono mt-8 inline-block border border-signal/60 bg-signal/10 px-5 py-2.5 text-[12px] uppercase tracking-[0.12em] text-signal transition-colors duration-150 hover:bg-signal/20"
          >
            Enter the lab
          </Link>
        </div>
      </section>
    </div>
  );
}
