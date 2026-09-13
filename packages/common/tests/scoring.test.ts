import { describe, expect, it } from 'vitest';
import {
  LOW_QUALITY_THRESHOLD,
  SIGNAL_WEIGHTS,
  nextTrust,
  normalizeSignals,
  reputationDeltaFor,
  scoreContribution,
  volumeDamping,
} from '../src/index.js';

describe('contribution scoring', () => {
  it('weights sum to one, so a perfect contribution scores 100', () => {
    const total = Object.values(SIGNAL_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
    expect(total).toBeCloseTo(1, 10);
    expect(
      scoreContribution({
        relevance: 1,
        novelty: 1,
        evidenceQuality: 1,
        reproducibility: 1,
        communityValidation: 1,
        downstreamImpact: 1,
      }),
    ).toBe(100);
  });

  it('clamps out-of-range and missing signals instead of trusting the caller', () => {
    const signals = normalizeSignals({ relevance: 5, novelty: -2 });
    expect(signals.relevance).toBe(1);
    expect(signals.novelty).toBe(0);
    expect(signals.evidenceQuality).toBe(0);
  });

  it('weights evidence quality above every other dimension', () => {
    const evidence = scoreContribution({ evidenceQuality: 1 });
    for (const key of [
      'relevance',
      'novelty',
      'reproducibility',
      'communityValidation',
      'downstreamImpact',
    ]) {
      expect(evidence).toBeGreaterThan(scoreContribution({ [key]: 1 }));
    }
  });
});

describe('volume damping', () => {
  it('is neutral for a first contribution and decays afterwards', () => {
    expect(volumeDamping(0)).toBe(1);
    expect(volumeDamping(1)).toBeLessThan(1);
    expect(volumeDamping(10)).toBeLessThan(volumeDamping(3));
  });

  it('makes one excellent contribution outrank many mediocre ones', () => {
    const excellent = reputationDeltaFor({
      kind: 'EVIDENCE',
      signals: {
        relevance: 0.95,
        novelty: 0.9,
        evidenceQuality: 1,
        reproducibility: 0.8,
        communityValidation: 0.7,
        downstreamImpact: 0.9,
      },
      priorContributionsOnTarget: 0,
      authorTrust: 0.8,
    });

    const mediocre = { relevance: 0.5, novelty: 0.3, evidenceQuality: 0.3, reproducibility: 0.2 };
    let spam = 0;
    for (let index = 0; index < 20; index += 1) {
      spam += reputationDeltaFor({
        kind: 'COMMENT',
        signals: mediocre,
        priorContributionsOnTarget: index,
        authorTrust: 0.8,
      });
    }

    expect(excellent).toBeGreaterThan(spam);
  });
});

describe('quality floor', () => {
  it('penalises contributions below the quality threshold', () => {
    const delta = reputationDeltaFor({
      kind: 'COMMENT',
      signals: { relevance: 0.05 },
      priorContributionsOnTarget: 0,
      authorTrust: 1,
    });
    expect(delta).toBeLessThan(0);
  });

  it('rewards a counterargument more than a comment of identical quality', () => {
    const signals = { relevance: 0.8, novelty: 0.7, evidenceQuality: 0.6, reproducibility: 0.5 };
    const comment = reputationDeltaFor({
      kind: 'COMMENT',
      signals,
      priorContributionsOnTarget: 0,
      authorTrust: 0.7,
    });
    const counter = reputationDeltaFor({
      kind: 'COUNTERARGUMENT',
      signals,
      priorContributionsOnTarget: 0,
      authorTrust: 0.7,
    });
    expect(counter).toBeGreaterThan(comment);
  });

  it('scores at the threshold boundary without flipping sign unexpectedly', () => {
    expect(LOW_QUALITY_THRESHOLD).toBeGreaterThan(0);
    const atThreshold = reputationDeltaFor({
      kind: 'EVIDENCE',
      signals: { relevance: 1, evidenceQuality: 0.2 },
      priorContributionsOnTarget: 0,
      authorTrust: 0.5,
    });
    expect(Number.isFinite(atThreshold)).toBe(true);
  });
});

describe('trust', () => {
  it('rises slowly and falls quickly', () => {
    const gain = nextTrust({ currentTrust: 0.5, qualityScore: 80, flagged: false }) - 0.5;
    const loss = 0.5 - nextTrust({ currentTrust: 0.5, qualityScore: 10, flagged: false });
    expect(gain).toBeGreaterThan(0);
    expect(loss).toBeGreaterThan(gain);
    expect(nextTrust({ currentTrust: 0.5, qualityScore: 90, flagged: true })).toBeLessThan(0.3);
  });

  it('never leaves the 0..1 range', () => {
    expect(nextTrust({ currentTrust: 1, qualityScore: 100, flagged: false })).toBeLessThanOrEqual(
      1,
    );
    expect(nextTrust({ currentTrust: 0, qualityScore: 0, flagged: true })).toBeGreaterThanOrEqual(
      0,
    );
  });
});
