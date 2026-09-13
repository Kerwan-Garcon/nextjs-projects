'use client';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg px-6 py-24 text-center">
      <p className="mono text-[11px] uppercase tracking-[0.16em] text-alert">Error</p>
      <h1 className="mt-3 text-[20px] font-semibold">Something failed while loading this view</h1>
      <p className="mt-3 text-[13px] leading-relaxed text-ink-muted">
        The most common cause in a local deployment is that the database is not running or has not
        been seeded. Try <span className="mono">pnpm db:reset &amp;&amp; pnpm db:seed</span>.
      </p>
      {error.digest ? (
        <p className="mono mt-3 text-[10px] text-ink-dim">digest {error.digest}</p>
      ) : null}
      <button
        type="button"
        onClick={reset}
        className="mono mt-6 border border-line-strong px-5 py-2.5 text-[11px] uppercase tracking-[0.12em] text-ink-muted hover:text-ink"
      >
        Retry
      </button>
    </div>
  );
}
