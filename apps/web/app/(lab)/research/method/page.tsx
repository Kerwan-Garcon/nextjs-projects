import { Panel, PanelHeader, SectionHeading } from '@saveus/ui';
import { apiGet } from '@/lib/server-api';
import type { Meta } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * The method page. If the platform's differentiator is that it distinguishes a
 * fact from an inference, that distinction has to be documented somewhere a
 * reader can check it.
 */
export default async function MethodPage() {
  const meta = await apiGet<Meta>('/api/meta');

  return (
    <div className="enter max-w-3xl">
      <h1 className="mono text-[13px] uppercase tracking-[0.16em]">How claims are labelled</h1>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
        Every statement in this product carries a kind. The kinds are not stylistic: they change how
        a statement is rendered, and two of them cannot be displayed at all without a source
        attached.
      </p>

      <SectionHeading>Epistemic kinds</SectionHeading>
      <Panel>
        <ul className="divide-y divide-line">
          {meta.epistemicKinds.map((kind) => (
            <li key={kind.kind} className="flex flex-wrap items-start gap-3 px-4 py-3">
              <span
                className="mono mt-[2px] shrink-0 border px-1.5 py-[1px] text-[9.5px] uppercase tracking-[0.09em]"
                style={{
                  color: `var(--color-${kind.kind.toLowerCase().replace(/_/g, '-')})`,
                  borderColor: `var(--color-${kind.kind.toLowerCase().replace(/_/g, '-')})`,
                  borderStyle: kind.kind === 'UNKNOWN' ? 'dashed' : 'solid',
                }}
              >
                {kind.label}
              </span>
              <p className="min-w-0 flex-1 text-[12.5px] leading-relaxed text-ink-muted">
                {kind.definition}
                {kind.requiresSource ? (
                  <span className="mono ml-2 text-[10px] uppercase tracking-[0.09em] text-warn">
                    requires a source
                  </span>
                ) : null}
              </p>
            </li>
          ))}
        </ul>
      </Panel>

      <SectionHeading>Confidence on agent findings</SectionHeading>
      <Panel>
        <ul className="divide-y divide-line">
          {meta.confidenceLevels.map((level) => (
            <li key={level.level} className="px-4 py-3">
              <span className="mono text-[10.5px] uppercase tracking-[0.1em] text-ink">
                {level.label}
              </span>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
                {level.definition}
              </p>
            </li>
          ))}
        </ul>
      </Panel>

      <SectionHeading>How contributions are scored</SectionHeading>
      <Panel>
        <PanelHeader title="Weights" meta="Volume is damped; quality is not" />
        <ul className="divide-y divide-line">
          {Object.entries(meta.scoringWeights).map(([key, weight]) => (
            <li key={key} className="flex items-center gap-4 px-4 py-2.5">
              <span className="mono w-[170px] text-[11.5px] text-ink-muted">
                {key.replace(/([A-Z])/g, ' $1')}
              </span>
              <div className="h-[8px] flex-1 bg-line-strong">
                <div className="h-full bg-signal" style={{ width: `${Number(weight) * 300}%` }} />
              </div>
              <span className="mono w-[40px] text-right text-[11px] text-ink-dim">
                {(Number(weight) * 100).toFixed(0)}%
              </span>
            </li>
          ))}
        </ul>
        <p className="border-t border-line px-4 py-3 text-[12px] leading-relaxed text-ink-dim">
          A contribution&rsquo;s reputation award is its quality score, multiplied by a factor for
          its kind and damped by how much the same author has already posted on the same problem.
          Someone writing a hundred comments does not outrank someone who found the one paper that
          mattered.
        </p>
      </Panel>

      <SectionHeading>Reputation tiers</SectionHeading>
      <Panel>
        <ul className="divide-y divide-line">
          {meta.reputationTiers.map((tier) => (
            <li key={tier.key} className="flex items-center gap-4 px-4 py-2.5">
              <span className="mono text-[11px] uppercase tracking-[0.1em] text-ink">
                {tier.label}
              </span>
              <span className="mono ml-auto text-[11px] text-ink-dim">{tier.min}+</span>
            </li>
          ))}
        </ul>
        <p className="border-t border-line px-4 py-3 text-[12px] leading-relaxed text-ink-dim">
          Tiers describe standing. They never gate participation: an anonymous account at zero can
          post the evidence that changes a hypothesis, and that is the point.
        </p>
      </Panel>

      <SectionHeading>What is synthetic in this deployment</SectionHeading>
      <Panel className="border-warn/30">
        <div className="space-y-3 px-4 py-4 text-[12.5px] leading-relaxed text-ink-muted">
          <p>
            <span className="mono mr-2 text-[10px] uppercase tracking-[0.1em] text-ok">Real</span>
            The {meta.stats.sources} source records reference real, publicly available publications,
            datasets and institutional programmes. Titles, publishers and URLs point at the actual
            publisher. Where a permanent deep link was not certain, the URL points at the
            publisher&rsquo;s landing page for that publication rather than at a guessed path.
          </p>
          <p>
            <span className="mono mr-2 text-[10px] uppercase tracking-[0.1em] text-warn">
              Demo data
            </span>
            Hypotheses, discussion, researcher accounts, reputation history and validation records
            shipped with this deployment are written for the demonstration dataset and are marked
            DEMO DATA wherever they appear. They are not positions taken by any real person or
            institution.
          </p>
          <p>
            <span className="mono mr-2 text-[10px] uppercase tracking-[0.1em] text-ai-hypothesis">
              Agent
            </span>
            Agent findings are computed from records that are in this database. With no model
            credentials configured, the platform runs a deterministic corpus provider that retrieves
            and recombines stored records and writes UNKNOWN where the record is empty — it does not
            generate prose claims. Currently running: {meta.ai.provider} / {meta.ai.model}.
          </p>
        </div>
      </Panel>
    </div>
  );
}
