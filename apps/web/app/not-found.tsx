import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-6 py-24 text-center">
      <p className="mono text-[11px] uppercase tracking-[0.16em] text-ink-dim">404</p>
      <h1 className="mt-3 text-[20px] font-semibold">No such record</h1>
      <p className="mt-3 text-[13px] leading-relaxed text-ink-muted">
        That problem, hypothesis or researcher is not in the database. Nothing is hidden here — if
        it existed, it would be visible.
      </p>
      <Link
        href="/problems"
        className="mono mt-6 inline-block border border-signal/60 bg-signal/10 px-5 py-2.5 text-[11px] uppercase tracking-[0.12em] text-signal"
      >
        Back to the board
      </Link>
    </div>
  );
}
