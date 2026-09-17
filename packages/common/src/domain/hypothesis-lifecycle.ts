import {
  AUTHOR_SETTABLE_STATUSES,
  VALIDATION_ONLY_STATUSES,
  type HypothesisStatus,
  type ValidationDecision,
} from './enums.js';
import { confidenceFromEvidence, type EvidenceLike } from './epistemics.js';

/**
 * Hypothesis lifecycle rules.
 *
 * The hard rule from the brief: nobody marks their own work VALIDATED. Those
 * statuses are reachable only through a recorded Validation with explicit
 * criteria, which is why this module is the single place transitions are
 * decided.
 */

export interface StatusChangeRequest {
  current: HypothesisStatus;
  next: HypothesisStatus;
  actor: 'AUTHOR' | 'VALIDATION' | 'SYSTEM';
}

export type StatusChangeResult = { ok: true } | { ok: false; reason: string };

const TERMINAL: readonly HypothesisStatus[] = ['VALIDATED', 'REJECTED'];

export function checkStatusChange(request: StatusChangeRequest): StatusChangeResult {
  const { current, next, actor } = request;

  if (current === next) return { ok: false, reason: 'Status is already ' + next };
  if (TERMINAL.includes(current) && actor !== 'VALIDATION') {
    return { ok: false, reason: `${current} can only be revised by a new validation record` };
  }

  if (actor === 'AUTHOR') {
    if (VALIDATION_ONLY_STATUSES.includes(next)) {
      return {
        ok: false,
        reason: `${next} is set by validation against explicit criteria, never by the author`,
      };
    }
    if (!AUTHOR_SETTABLE_STATUSES.includes(next)) {
      return { ok: false, reason: `${next} is derived from the evidence record, not set by hand` };
    }
    return { ok: true };
  }

  if (actor === 'SYSTEM') {
    if (VALIDATION_ONLY_STATUSES.includes(next)) {
      return { ok: false, reason: `${next} requires a validation record` };
    }
    return { ok: true };
  }

  return { ok: true };
}

export function statusFromValidation(decision: ValidationDecision): HypothesisStatus {
  switch (decision) {
    case 'VALIDATED':
      return 'VALIDATED';
    case 'REJECTED':
      return 'REJECTED';
    case 'INSUFFICIENT':
      return 'NEEDS_EVIDENCE';
  }
}

/**
 * Status the evidence record implies. Applied by the system after evidence
 * changes, and never allowed to reach a validation-only status.
 */
export function deriveStatusFromEvidence(
  current: HypothesisStatus,
  evidence: readonly EvidenceLike[],
): HypothesisStatus {
  if (TERMINAL.includes(current) || current === 'DRAFT') return current;

  if (evidence.length === 0) return 'NEEDS_EVIDENCE';

  const confidence = confidenceFromEvidence(evidence);
  switch (confidence) {
    case 'CONTESTED':
    case 'REFUTED':
      return 'CONTESTED';
    case 'SUPPORTED':
      return current === 'SIMULATION' ? 'SIMULATION' : 'TESTABLE';
    case 'PLAUSIBLE':
      return current === 'SIMULATION' || current === 'TESTABLE' ? current : 'UNDER_REVIEW';
    case 'UNCERTAIN':
      return 'NEEDS_EVIDENCE';
  }
}

/** Criteria a validation record must address before a decision is accepted. */
export const VALIDATION_CRITERIA: readonly string[] = Object.freeze([
  'The claim is stated precisely enough to be wrong',
  'The proposed mechanism is consistent with the cited evidence',
  'The required assumptions are listed and each is either sourced or marked UNKNOWN',
  'At least one independent source supports the central claim',
  'Contradicting evidence has been searched for and addressed',
  'The validation method is reproducible by a third party',
]);

export function validationIsComplete(criteria: readonly { criterion: string; met: boolean }[]): {
  complete: boolean;
  missing: string[];
} {
  const covered = new Set(criteria.map((entry) => entry.criterion));
  const missing = VALIDATION_CRITERIA.filter((criterion) => !covered.has(criterion));
  return { complete: missing.length === 0, missing };
}
