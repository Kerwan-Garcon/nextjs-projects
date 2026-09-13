import { describe, expect, it } from 'vitest';
import { evaluateProblemCandidate, type ProblemCandidateDraft } from '../src/index.js';

function draft(overrides: Partial<ProblemCandidateDraft> = {}): ProblemCandidateDraft {
  return {
    title: 'Reducing extreme heat mortality in a dense European city',
    summary: 'Summary',
    description: 'x'.repeat(400),
    whyItMatters: [
      {
        text: 'Heat is associated with roughly 70000 excess deaths in Europe in 2003.',
        sourceIds: ['s1'],
      },
    ],
    successCriteria: [{ metric: 'Excess mortality', target: '-20%', horizon: '5 years' }],
    constraints: {
      budget: 'Municipal adaptation budget',
      time: 'Within five summers',
      geography: null,
      technology: null,
      political: null,
    },
    openQuestions: ['Which intervention dominates?', 'What is the treatable roof area?'],
    domains: ['cities'],
    sources: [
      { id: 's1', reliability: 'HIGH', sourceType: 'UN' },
      { id: 's2', reliability: 'MEDIUM', sourceType: 'REPORT' },
      { id: 's3', reliability: 'UNKNOWN', sourceType: 'NEWS' },
    ],
    ...overrides,
  };
}

describe('problem publication gate', () => {
  it('accepts a complete candidate for curation', () => {
    const report = evaluateProblemCandidate(draft());
    expect(report.blocking).toEqual([]);
    expect(report.eligibleForCuration).toBe(true);
    expect(report.score).toBe(100);
  });

  it('blocks a candidate with too few sources', () => {
    const report = evaluateProblemCandidate(
      draft({ sources: [{ id: 's1', reliability: 'HIGH', sourceType: 'UN' }] }),
    );
    expect(report.eligibleForCuration).toBe(false);
    expect(report.blocking.join(' ')).toMatch(/distinct sources/i);
  });

  it('blocks a candidate with no high-reliability source', () => {
    const report = evaluateProblemCandidate(
      draft({
        sources: [
          { id: 's1', reliability: 'MEDIUM', sourceType: 'REPORT' },
          { id: 's2', reliability: 'LOW', sourceType: 'NEWS' },
          { id: 's3', reliability: 'UNKNOWN', sourceType: 'OTHER' },
        ],
      }),
    );
    expect(report.blocking.join(' ')).toMatch(/high-reliability/i);
  });

  it('blocks a candidate whose consequences are not quantified', () => {
    const report = evaluateProblemCandidate(
      draft({
        whyItMatters: [
          { text: 'This is a very serious and important problem.', sourceIds: ['s1'] },
        ],
      }),
    );
    expect(report.blocking.join(' ')).toMatch(/quantified/i);
  });

  it('blocks a candidate whose consequences carry no source', () => {
    const report = evaluateProblemCandidate(
      draft({ whyItMatters: [{ text: 'Roughly 70000 excess deaths occurred.', sourceIds: [] }] }),
    );
    expect(report.blocking.join(' ')).toMatch(/traceable to sources/i);
  });

  it('blocks a candidate with no measurable success criterion', () => {
    expect(evaluateProblemCandidate(draft({ successCriteria: [] })).eligibleForCuration).toBe(
      false,
    );
  });

  it('blocks an exact duplicate of a published problem', () => {
    const report = evaluateProblemCandidate(
      draft({ existingTitles: ['reducing extreme heat mortality in a dense european city'] }),
    );
    expect(report.blocking.join(' ')).toMatch(/duplicate/i);
  });

  it('warns without blocking when open questions are missing', () => {
    const report = evaluateProblemCandidate(draft({ openQuestions: [] }));
    expect(report.eligibleForCuration).toBe(true);
    expect(report.warnings.length).toBeGreaterThan(0);
  });

  it('an ingestion-shaped draft is never eligible on its own', () => {
    const report = evaluateProblemCandidate(
      draft({
        successCriteria: [],
        constraints: {
          budget: null,
          time: null,
          geography: null,
          technology: null,
          political: null,
        },
      }),
    );
    expect(report.eligibleForCuration).toBe(false);
  });
});
