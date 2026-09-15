import { Panel, Statement } from '@saveus/ui';
import { SourceChip } from '@/components/source-chip';
import type { LessonBlockView } from '@/lib/types';

/**
 * A lesson, rendered.
 *
 * The lesson is written in the product's own notation rather than as prose with
 * footnotes: a SOURCE CLAIM looks like a source claim and an UNKNOWN looks like
 * an admitted gap, in the same colours they carry on a problem page. Somebody
 * who reads three lessons has already learned to read the board, without a
 * lesson ever having to explain the colour scheme.
 */
export function LessonBlocks({ blocks }: { blocks: LessonBlockView[] }) {
  return (
    <div className="space-y-4">
      {blocks.map((block, index) => {
        switch (block.kind) {
          case 'PROSE':
            return (
              <p key={index} className="text-[14px] leading-[1.75] text-ink-muted">
                {block.text}
              </p>
            );

          case 'STATEMENT':
            return (
              <Statement
                key={index}
                kind={block.epistemicKind}
                sources={
                  block.sources.length > 0
                    ? block.sources.map((source) => (
                        <SourceChip key={source.id} source={source} compact />
                      ))
                    : undefined
                }
              >
                {block.text}
              </Statement>
            );

          case 'CALLOUT':
            return (
              <Panel key={index} className="bg-panel-raised">
                <div className="px-4 py-3">
                  <p className="label text-ink-muted">{block.title}</p>
                  <p className="mt-2 text-[13px] leading-relaxed text-ink">{block.text}</p>
                </div>
              </Panel>
            );

          case 'COMPARE':
            return (
              <div key={index}>
                <p className="label mb-2 text-ink-dim">{block.caption}</p>
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="border border-alert/30 bg-alert/5 px-4 py-3">
                    <p className="mono text-[10px] uppercase tracking-[0.1em] text-alert">
                      {block.wrong.label}
                    </p>
                    <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
                      {block.wrong.text}
                    </p>
                  </div>
                  <div className="border border-ok/30 bg-ok/5 px-4 py-3">
                    <p className="mono text-[10px] uppercase tracking-[0.1em] text-ok">
                      {block.right.label}
                    </p>
                    <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
                      {block.right.text}
                    </p>
                  </div>
                </div>
              </div>
            );

          case 'CHECKLIST':
            return (
              <Panel key={index}>
                <div className="px-4 py-3">
                  <p className="label text-ink-muted">{block.title}</p>
                  <ul className="mt-2.5 space-y-1.5">
                    {block.items.map((item, itemIndex) => (
                      <li key={itemIndex} className="flex gap-2.5 text-[13px] leading-relaxed">
                        <span className="mono mt-[1px] shrink-0 text-[11px] text-signal">□</span>
                        <span className="text-ink-muted">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Panel>
            );

          default:
            return null;
        }
      })}
    </div>
  );
}
