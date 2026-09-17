import { describe, expect, it } from 'vitest';
import {
  EPISTEMIC_DESCRIPTORS,
  VALIDATION_CRITERIA,
  checkStatusChange,
  confidenceFromEvidence,
  deriveStatusFromEvidence,
  enforceSourceRequirement,
  orUnknown,
  statusFromValidation,
  validationIsComplete,
} from '../src/index.js';

describe('epistemic kinds', () => {
  it('requires a source for FACT and SOURCE_CLAIM only', () => {
    expect(EPISTEMIC_DESCRIPTORS.FACT.requiresSource).toBe(true);
    expect(EPISTEMIC_DESCRIPTORS.SOURCE_CLAIM.requiresSource).toBe(true);
    expect(EPISTEMIC_DESCRIPTORS.INFERENCE.requiresSource).toBe(false);
  });

  it('degrades an unsourced fact to UNKNOWN rather than displaying it as a fact', () => {
    expect(enforceSourceRequirement('FACT', 0)).toBe('UNKNOWN');
    expect(enforceSourceRequirement('FACT', 1)).toBe('FACT');
    expect(enforceSourceRequirement('INFERENCE', 0)).toBe('INFERENCE');
  });

  it('writes UNKNOWN rather than an empty string', () => {
    expect(orUnknown(null)).toBe('UNKNOWN');
    expect(orUnknown('   ')).toBe('UNKNOWN');
    expect(orUnknown('a value')).toBe('a value');
  });
});

describe('confidence from evidence', () => {
  const support = (count: number, reliability: 'HIGH' | 'LOW' = 'HIGH') =>
    Array.from({ length: count }, () => ({
      stance: 'SUPPORTS' as const,
      strength: 5,
      reliability,
    }));
  const against = (count: number) =>
    Array.from({ length: count }, () => ({
      stance: 'CONTRADICTS' as const,
      strength: 5,
      reliability: 'HIGH' as const,
    }));

  it('is UNCERTAIN with no evidence', () => {
    expect(confidenceFromEvidence([])).toBe('UNCERTAIN');
  });

  it('is SUPPORTED only with several strong, reliable, agreeing sources', () => {
    expect(confidenceFromEvidence(support(4))).toBe('SUPPORTED');
    expect(confidenceFromEvidence(support(1))).not.toBe('SUPPORTED');
  });

  it('is REFUTED when the contradicting weight dominates', () => {
    expect(confidenceFromEvidence([...support(1), ...against(4)])).toBe('REFUTED');
  });

  it('is CONTESTED when comparable weights disagree', () => {
    expect(confidenceFromEvidence([...support(2), ...against(2)])).toBe('CONTESTED');
  });

  it('discounts low-reliability publishers', () => {
    expect(confidenceFromEvidence(support(4, 'LOW'))).not.toBe('SUPPORTED');
  });
});

describe('hypothesis lifecycle', () => {
  it('refuses to let an author mark their own work validated', () => {
    for (const status of ['VALIDATED', 'REJECTED', 'PROMISING'] as const) {
      const result = checkStatusChange({ current: 'UNDER_REVIEW', next: status, actor: 'AUTHOR' });
      expect(result.ok, status).toBe(false);
    }
  });

  it('lets an author move between draft-side statuses', () => {
    expect(checkStatusChange({ current: 'DRAFT', next: 'UNDER_REVIEW', actor: 'AUTHOR' }).ok).toBe(
      true,
    );
  });

  it('refuses validation-only statuses to the system too', () => {
    expect(
      checkStatusChange({ current: 'UNDER_REVIEW', next: 'VALIDATED', actor: 'SYSTEM' }).ok,
    ).toBe(false);
    expect(
      checkStatusChange({ current: 'UNDER_REVIEW', next: 'CONTESTED', actor: 'SYSTEM' }).ok,
    ).toBe(true);
  });

  it('only reopens a terminal status through a validation record', () => {
    expect(
      checkStatusChange({ current: 'VALIDATED', next: 'UNDER_REVIEW', actor: 'AUTHOR' }).ok,
    ).toBe(false);
    expect(
      checkStatusChange({ current: 'VALIDATED', next: 'NEEDS_EVIDENCE', actor: 'VALIDATION' }).ok,
    ).toBe(true);
  });

  it('maps a validation decision to a status', () => {
    expect(statusFromValidation('VALIDATED')).toBe('VALIDATED');
    expect(statusFromValidation('REJECTED')).toBe('REJECTED');
    expect(statusFromValidation('INSUFFICIENT')).toBe('NEEDS_EVIDENCE');
  });

  it('derives status from the evidence record without escalating to validated', () => {
    expect(deriveStatusFromEvidence('UNDER_REVIEW', [])).toBe('NEEDS_EVIDENCE');
    expect(
      deriveStatusFromEvidence('UNDER_REVIEW', [
        { stance: 'SUPPORTS', strength: 5, reliability: 'HIGH' },
        { stance: 'SUPPORTS', strength: 5, reliability: 'HIGH' },
        { stance: 'SUPPORTS', strength: 5, reliability: 'HIGH' },
        { stance: 'SUPPORTS', strength: 5, reliability: 'HIGH' },
      ]),
    ).toBe('TESTABLE');
    expect(deriveStatusFromEvidence('VALIDATED', [])).toBe('VALIDATED');
    expect(deriveStatusFromEvidence('DRAFT', [])).toBe('DRAFT');
  });

  it('requires every validation criterion to be addressed', () => {
    expect(validationIsComplete([]).complete).toBe(false);
    const all = VALIDATION_CRITERIA.map((criterion) => ({ criterion, met: true }));
    expect(validationIsComplete(all).complete).toBe(true);
  });
});
