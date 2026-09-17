import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Panel, PanelHeader } from '@saveus/ui';
import { PublishForm } from '@/components/publish-form';
import { apiGet, apiGetOr404 } from '@/lib/server-api';
import type { IntakeCandidate, Meta, SessionUser } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * The problem editor. Reachable only for a candidate a curator has approved,
 * and it publishes nothing on its own: the server re-runs the publication
 * checklist against whatever the curator writes here.
 */
export default async function IntakeEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ candidate }, meta, viewer] = await Promise.all([
    apiGetOr404<{ candidate: IntakeCandidate }>(`/api/ingestion/candidates/${id}`),
    apiGet<Meta>('/api/meta'),
    apiGet<{ user: SessionUser | null }>('/api/me'),
  ]);

  if (!candidate) notFound();

  return (
    <div className="enter space-y-4">
      <div className="border-b border-line pb-4">
        <Link
          href="/research"
          className="mono text-[10.5px] uppercase tracking-[0.12em] text-ink-dim hover:text-signal"
        >
          ← Research operations
        </Link>
        <h1 className="mono mt-2 text-[13px] uppercase tracking-[0.16em]">Write the problem</h1>
        <p className="mt-1.5 max-w-3xl text-[12.5px] leading-relaxed text-ink-muted">
          The pipeline found a document that states an open question. It has not written a problem,
          and it cannot. Below is everything it recorded; the statement is yours to write.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          {candidate.status !== 'APPROVED' ? (
            <div className="border border-warn/40 bg-warn/5 px-4 py-3">
              <p className="text-[12.5px] text-warn">
                This candidate is {candidate.status.replace(/_/g, ' ').toLowerCase()}. Publication
                is refused until a curator approves it in the queue.
              </p>
            </div>
          ) : null}

          {candidate.publishedSlug ? (
            <div className="border border-ok/40 bg-ok/5 px-4 py-3">
              <p className="text-[12.5px] text-ok">
                Already published as{' '}
                <Link href={`/problems/${candidate.publishedSlug}`} className="underline">
                  {candidate.publishedSlug}
                </Link>
                .
              </p>
            </div>
          ) : !viewer.user ? (
            <div className="border border-dashed border-line px-4 py-6 text-center">
              <p className="text-[13px] text-ink-muted">Sign in to publish a problem.</p>
              <a
                href="/sign-in"
                className="mono mt-3 inline-block border border-signal/60 bg-signal/10 px-4 py-2 text-[11px] uppercase tracking-[0.12em] text-signal"
              >
                Sign in
              </a>
            </div>
          ) : (
            <PublishForm candidate={candidate} meta={meta} />
          )}
        </div>

        <div className="space-y-4">
          <Panel>
            <PanelHeader title="What intake recorded" meta={candidate.connector} />
            <div className="space-y-3 px-4 py-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="warn">relevance {candidate.relevanceScore.toFixed(0)}</Badge>
                <Badge tone="outline">checklist {candidate.curationScore.toFixed(0)}/100</Badge>
              </div>
              <p className="text-[12.5px] leading-relaxed text-ink">{candidate.title}</p>
              {candidate.assessment?.matched.length ? (
                <div>
                  <span className="label">Signals</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {candidate.assessment.matched.map((signal) => (
                      <span
                        key={signal}
                        className="mono border border-line px-1.5 py-[1px] text-[9px] tracking-[0.05em] text-ink-dim"
                      >
                        {signal}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Sentences from the source"
              meta="Quoted as published. Nothing here was rewritten."
            />
            <ul className="divide-y divide-line">
              {candidate.extractedClaims.map((claim, index) => (
                <li key={index} className="px-4 py-2.5">
                  <span
                    className={`mono text-[9px] uppercase tracking-[0.1em] ${
                      claim.epistemicKind === 'UNKNOWN' ? 'text-warn' : 'text-ink-dim'
                    }`}
                  >
                    {claim.epistemicKind === 'UNKNOWN' ? 'stated gap' : 'source claim'}
                  </span>
                  <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">{claim.text}</p>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel>
            <PanelHeader title="Source" />
            <ul className="divide-y divide-line">
              {candidate.sources.map((source) => (
                <li key={source.id} className="px-4 py-3">
                  <Badge
                    tone={
                      source.reliability === 'HIGH'
                        ? 'ok'
                        : source.reliability === 'MEDIUM'
                          ? 'warn'
                          : 'outline'
                    }
                  >
                    {source.reliability}
                  </Badge>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-1.5 block text-[12px] leading-snug text-signal hover:underline"
                  >
                    {source.title}
                  </a>
                  <p className="mono mt-1 text-[10px] text-ink-dim">
                    {source.publisher} · {source.publicationDate ?? 'no date'}
                  </p>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
