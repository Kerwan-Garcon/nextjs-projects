import type { ReputationEventKind } from './enums.js';

/**
 * Fixed awards for discrete events. Contribution scoring (scoring.ts) handles
 * the continuous part; this handles the things that either happened or did not.
 */
export const EVENT_AWARDS: Readonly<Record<ReputationEventKind, number>> = Object.freeze({
  EVIDENCE_ACCEPTED: 12,
  COUNTERARGUMENT_UPHELD: 20,
  HYPOTHESIS_IMPROVED: 15,
  REPRODUCIBLE_RESULT: 30,
  VALIDATED_CONTRIBUTION: 45,
  CROSS_DOMAIN_LINK: 10,
  PEER_ASSIST: 6,
  ERROR_FOUND: 25,
  CONTRIBUTION_SCORED: 0, // variable, supplied by the scoring engine
  LOW_QUALITY_PENALTY: -6,
  SPAM_PENALTY: -25,
});

export interface ReputationTier {
  key: string;
  label: string;
  min: number;
}

/**
 * Tiers describe standing, they never gate participation: an anonymous account
 * at 0 can still post the evidence that changes a hypothesis.
 */
export const REPUTATION_TIERS: readonly ReputationTier[] = Object.freeze([
  { key: 'observer', label: 'OBSERVER', min: 0 },
  { key: 'contributor', label: 'CONTRIBUTOR', min: 60 },
  { key: 'analyst', label: 'ANALYST', min: 250 },
  { key: 'researcher', label: 'RESEARCHER', min: 700 },
  { key: 'senior', label: 'SENIOR RESEARCHER', min: 1600 },
  { key: 'principal', label: 'PRINCIPAL', min: 3500 },
]);

export function tierFor(reputation: number): ReputationTier {
  let current = REPUTATION_TIERS[0] as ReputationTier;
  for (const tier of REPUTATION_TIERS) {
    if (reputation >= tier.min) current = tier;
  }
  return current;
}

export function nextTierFor(reputation: number): ReputationTier | null {
  return REPUTATION_TIERS.find((tier) => tier.min > reputation) ?? null;
}

export function progressToNextTier(reputation: number): number {
  const current = tierFor(reputation);
  const next = nextTierFor(reputation);
  if (!next) return 1;
  return Math.min(1, Math.max(0, (reputation - current.min) / (next.min - current.min)));
}

export function awardFor(kind: ReputationEventKind, variableDelta = 0): number {
  return kind === 'CONTRIBUTION_SCORED' ? Math.round(variableDelta) : EVENT_AWARDS[kind];
}

/** Reputation is the running sum of recorded events — never a stored opinion. */
export function totalReputation(events: readonly { delta: number }[]): number {
  return events.reduce((sum, event) => sum + event.delta, 0);
}
