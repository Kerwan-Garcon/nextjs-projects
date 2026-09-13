import type { ContributionKind } from './enums.js';

/**
 * Contribution quality model.
 *
 * Deliberately NOT a like-counter. Every dimension is normalised to 0..1 and
 * weighted; the weights live here so the scoring engine stays one swappable,
 * deterministic unit. Nothing in this file touches I/O.
 */
export interface ContributionSignals {
  /** Does it engage with the actual problem/hypothesis at hand? */
  relevance: number;
  /** Does it add something not already present in the thread? */
  novelty: number;
  /** Strength and reliability of the sources it carries. */
  evidenceQuality: number;
  /** Could someone else repeat the check or the experiment? */
  reproducibility: number;
  /** What peers did with it afterwards (endorsements, upheld counterarguments). */
  communityValidation: number;
  /** Did it change the hypothesis, the status, or later work? */
  downstreamImpact: number;
}

export const SIGNAL_WEIGHTS: Readonly<Record<keyof ContributionSignals, number>> = Object.freeze({
  relevance: 0.18,
  novelty: 0.18,
  evidenceQuality: 0.24,
  reproducibility: 0.14,
  communityValidation: 0.12,
  downstreamImpact: 0.14,
});

/**
 * Kinds are not equal. A well-built counterargument or a reproducible result is
 * worth more than a comment, which is the whole point of section 8.
 */
export const KIND_MULTIPLIER: Readonly<Record<ContributionKind, number>> = Object.freeze({
  COMMENT: 0.55,
  QUESTION: 0.65,
  EVIDENCE: 1.0,
  MODIFICATION: 1.0,
  COUNTERARGUMENT: 1.15,
  EXPERIMENT: 1.2,
  RESULT: 1.25,
});

export const SIGNAL_KEYS = Object.keys(SIGNAL_WEIGHTS) as (keyof ContributionSignals)[];

const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

export function normalizeSignals(partial: Partial<ContributionSignals>): ContributionSignals {
  return {
    relevance: clamp01(partial.relevance ?? 0),
    novelty: clamp01(partial.novelty ?? 0),
    evidenceQuality: clamp01(partial.evidenceQuality ?? 0),
    reproducibility: clamp01(partial.reproducibility ?? 0),
    communityValidation: clamp01(partial.communityValidation ?? 0),
    downstreamImpact: clamp01(partial.downstreamImpact ?? 0),
  };
}

/** Weighted quality of a single contribution, 0..100, independent of its author. */
export function scoreContribution(partial: Partial<ContributionSignals>): number {
  const signals = normalizeSignals(partial);
  const raw = SIGNAL_KEYS.reduce((sum, key) => sum + signals[key] * SIGNAL_WEIGHTS[key], 0);
  return round2(raw * 100);
}

/**
 * Volume damping. The 40th comment on a problem is worth a fraction of the
 * first: someone posting 100 comments must not outrank the person who found the
 * one paper that mattered.
 */
export function volumeDamping(priorContributionsOnTarget: number): number {
  const n = Math.max(0, Math.floor(priorContributionsOnTarget));
  return 1 / (1 + 0.35 * n);
}

export interface ReputationDeltaInput {
  kind: ContributionKind;
  signals: Partial<ContributionSignals>;
  /** Contributions the same author already made on the same problem. */
  priorContributionsOnTarget: number;
  /** 0..1. Authors with a poor track record earn less until they recover it. */
  authorTrust: number;
}

export const LOW_QUALITY_THRESHOLD = 22;

/**
 * Reputation earned by one contribution. Below the quality threshold the delta
 * is negative: low-effort volume costs you something.
 */
export function reputationDeltaFor(input: ReputationDeltaInput): number {
  const quality = scoreContribution(input.signals);
  const trust = clamp01(input.authorTrust);

  if (quality < LOW_QUALITY_THRESHOLD) {
    // Penalty grows with how far below the bar it is, capped so one bad post is
    // never catastrophic.
    return -Math.min(8, Math.round((LOW_QUALITY_THRESHOLD - quality) / 3) + 1);
  }

  const earned =
    quality *
    KIND_MULTIPLIER[input.kind] *
    volumeDamping(input.priorContributionsOnTarget) *
    (0.4 + 0.6 * trust);
  return Math.round(earned / 4);
}

export interface TrustUpdateInput {
  currentTrust: number;
  qualityScore: number;
  flagged: boolean;
}

/** Trust moves slowly up and quickly down. */
export function nextTrust({ currentTrust, qualityScore, flagged }: TrustUpdateInput): number {
  const trust = clamp01(currentTrust);
  if (flagged) return round2(Math.max(0, trust - 0.25));
  if (qualityScore < LOW_QUALITY_THRESHOLD) return round2(Math.max(0, trust - 0.06));
  const gain = ((qualityScore - LOW_QUALITY_THRESHOLD) / 100) * 0.05;
  return round2(Math.min(1, trust + gain));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
