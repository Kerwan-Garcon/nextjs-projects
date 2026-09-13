import type { ConfidenceLevel, EpistemicKind, EvidenceStance, Reliability } from './enums.js';

/**
 * The epistemic layer. Section 20 of the brief: a model conclusion must never be
 * rendered with the authority of a measured fact, so every statement in the
 * product carries one of these kinds and the UI styles them differently.
 */
export interface EpistemicDescriptor {
  kind: EpistemicKind;
  label: string;
  short: string;
  /** One line the UI can show on hover so the distinction is never mysterious. */
  definition: string;
  /** Does this kind require at least one source to be displayable? */
  requiresSource: boolean;
}

export const EPISTEMIC_DESCRIPTORS: Readonly<Record<EpistemicKind, EpistemicDescriptor>> =
  Object.freeze({
    FACT: {
      kind: 'FACT',
      label: 'FACT',
      short: 'F',
      definition:
        'A measured or officially recorded quantity, carried by at least one primary source.',
      requiresSource: true,
    },
    SOURCE_CLAIM: {
      kind: 'SOURCE_CLAIM',
      label: 'SOURCE CLAIM',
      short: 'SC',
      definition: 'A claim made by a named source. Attributed, not endorsed by this platform.',
      requiresSource: true,
    },
    HUMAN_HYPOTHESIS: {
      kind: 'HUMAN_HYPOTHESIS',
      label: 'HUMAN HYPOTHESIS',
      short: 'H',
      definition: 'A proposal by a human researcher. Not established; open to attack.',
      requiresSource: false,
    },
    AI_HYPOTHESIS: {
      kind: 'AI_HYPOTHESIS',
      label: 'AI HYPOTHESIS',
      short: 'AI',
      definition: 'A proposal produced by an agent run. Carries no authority until humans test it.',
      requiresSource: false,
    },
    INFERENCE: {
      kind: 'INFERENCE',
      label: 'INFERENCE',
      short: 'I',
      definition:
        'A conclusion derived from other statements on this page. Only as good as its inputs.',
      requiresSource: false,
    },
    UNKNOWN: {
      kind: 'UNKNOWN',
      label: 'UNKNOWN',
      short: '?',
      definition:
        'Nobody here knows. Recorded explicitly rather than filled with a plausible guess.',
      requiresSource: false,
    },
  });

export interface ConfidenceDescriptor {
  level: ConfidenceLevel;
  label: string;
  definition: string;
  /** Rough ordering for sorting, not a probability. */
  rank: number;
}

export const CONFIDENCE_DESCRIPTORS: Readonly<Record<ConfidenceLevel, ConfidenceDescriptor>> =
  Object.freeze({
    SUPPORTED: {
      level: 'SUPPORTED',
      label: 'SUPPORTED',
      definition: 'Multiple independent sources of acceptable reliability point the same way.',
      rank: 5,
    },
    PLAUSIBLE: {
      level: 'PLAUSIBLE',
      label: 'PLAUSIBLE',
      definition: 'Consistent with the retrieved evidence, but thinly sourced.',
      rank: 4,
    },
    UNCERTAIN: {
      level: 'UNCERTAIN',
      label: 'UNCERTAIN',
      definition: 'The retrieved evidence does not settle this either way.',
      rank: 3,
    },
    CONTESTED: {
      level: 'CONTESTED',
      label: 'CONTESTED',
      definition: 'Sources of comparable reliability disagree.',
      rank: 2,
    },
    REFUTED: {
      level: 'REFUTED',
      label: 'REFUTED',
      definition: 'The retrieved evidence contradicts the statement.',
      rank: 1,
    },
  });

const RELIABILITY_WEIGHT: Record<Reliability, number> = {
  HIGH: 1,
  MEDIUM: 0.65,
  LOW: 0.3,
  UNKNOWN: 0.15,
};

export function reliabilityWeight(reliability: Reliability): number {
  return RELIABILITY_WEIGHT[reliability];
}

export interface EvidenceLike {
  stance: EvidenceStance;
  strength: number;
  reliability: Reliability;
}

/**
 * Derive a confidence level from an evidence set. Deterministic, auditable, and
 * the same rule for human-entered and agent-retrieved evidence.
 */
export function confidenceFromEvidence(evidence: readonly EvidenceLike[]): ConfidenceLevel {
  const supporting = weigh(evidence.filter((e) => e.stance === 'SUPPORTS'));
  const contradicting = weigh(evidence.filter((e) => e.stance === 'CONTRADICTS'));

  if (supporting === 0 && contradicting === 0) return 'UNCERTAIN';
  if (contradicting > supporting * 1.5) return 'REFUTED';

  const ratio = supporting / (supporting + contradicting);
  if (ratio >= 0.4 && ratio <= 0.6 && contradicting >= 1.5) return 'CONTESTED';
  if (supporting >= 6 && ratio >= 0.75) return 'SUPPORTED';
  if (supporting >= 2 && ratio >= 0.6) return 'PLAUSIBLE';
  return 'UNCERTAIN';
}

function weigh(evidence: readonly EvidenceLike[]): number {
  return evidence.reduce(
    (sum, e) => sum + (e.strength / 5) * 2 * reliabilityWeight(e.reliability),
    0,
  );
}

/**
 * A statement claiming FACT or SOURCE_CLAIM status without a source is not
 * displayable as such — it degrades to UNKNOWN rather than silently passing.
 */
export function enforceSourceRequirement(kind: EpistemicKind, sourceCount: number): EpistemicKind {
  if (EPISTEMIC_DESCRIPTORS[kind].requiresSource && sourceCount === 0) return 'UNKNOWN';
  return kind;
}

export const UNKNOWN_TEXT = 'UNKNOWN';

/** Use everywhere a value is genuinely missing. Never invent a plausible filler. */
export function orUnknown(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : UNKNOWN_TEXT;
}
