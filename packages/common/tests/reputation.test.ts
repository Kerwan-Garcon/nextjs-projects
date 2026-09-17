import { describe, expect, it } from 'vitest';
import {
  EVENT_AWARDS,
  REPUTATION_TIERS,
  awardFor,
  nextTierFor,
  progressToNextTier,
  tierFor,
  totalReputation,
} from '../src/index.js';

describe('reputation events', () => {
  it('rewards discovery and rigour above participation', () => {
    expect(EVENT_AWARDS.VALIDATED_CONTRIBUTION).toBeGreaterThan(EVENT_AWARDS.PEER_ASSIST);
    expect(EVENT_AWARDS.REPRODUCIBLE_RESULT).toBeGreaterThan(EVENT_AWARDS.EVIDENCE_ACCEPTED);
    expect(EVENT_AWARDS.COUNTERARGUMENT_UPHELD).toBeGreaterThan(EVENT_AWARDS.PEER_ASSIST);
  });

  it('penalises spam', () => {
    expect(EVENT_AWARDS.SPAM_PENALTY).toBeLessThan(0);
    expect(EVENT_AWARDS.LOW_QUALITY_PENALTY).toBeLessThan(0);
  });

  it('takes the variable delta only for scored contributions', () => {
    expect(awardFor('CONTRIBUTION_SCORED', 17.6)).toBe(18);
    expect(awardFor('ERROR_FOUND', 999)).toBe(EVENT_AWARDS.ERROR_FOUND);
  });

  it('is the running sum of events, not a stored opinion', () => {
    expect(totalReputation([{ delta: 10 }, { delta: -4 }, { delta: 30 }])).toBe(36);
    expect(totalReputation([])).toBe(0);
  });
});

describe('tiers', () => {
  it('starts everyone at the first tier', () => {
    expect(tierFor(0).key).toBe('observer');
    expect(tierFor(-50).key).toBe('observer');
  });

  it('is monotonic in reputation', () => {
    const thresholds = REPUTATION_TIERS.map((tier) => tier.min);
    for (const threshold of thresholds) {
      expect(tierFor(threshold).min).toBe(threshold);
      expect(tierFor(threshold + 1).min).toBe(threshold);
    }
  });

  it('reports progress toward the next tier and saturates at the top', () => {
    expect(progressToNextTier(0)).toBeGreaterThanOrEqual(0);
    expect(progressToNextTier(30)).toBeCloseTo(0.5, 1);
    const top = REPUTATION_TIERS[REPUTATION_TIERS.length - 1]!;
    expect(nextTierFor(top.min)).toBeNull();
    expect(progressToNextTier(top.min + 1000)).toBe(1);
  });
});
