import type { DomainKey, Reliability } from './enums.js';

/**
 * Publication gate for problems.
 *
 * Section 12 of the brief: a problem must never become public just because a
 * model produced it. This module answers "is this candidate even eligible for a
 * human curator to look at", and a curator still has to say yes afterwards.
 */

export interface ProblemCandidateDraft {
  title: string;
  summary: string;
  description: string;
  whyItMatters: readonly { text: string; sourceIds: readonly string[] }[];
  successCriteria: readonly { metric: string; target: string; horizon: string }[];
  constraints: {
    budget: string | null;
    time: string | null;
    geography: string | null;
    technology: string | null;
    political: string | null;
  };
  openQuestions: readonly string[];
  domains: readonly DomainKey[];
  sources: readonly { id: string; reliability: Reliability; sourceType: string }[];
  /** Content hashes of already-published problems, for duplicate detection. */
  existingTitles?: readonly string[];
}

export interface CurationCheck {
  id: string;
  label: string;
  passed: boolean;
  blocking: boolean;
  detail: string;
}

export interface CurationReport {
  checks: CurationCheck[];
  blocking: string[];
  warnings: string[];
  /** 0..100. High does not mean publishable - only a curator decides that. */
  score: number;
  eligibleForCuration: boolean;
}

const MIN_SOURCES = 3;
const MIN_HIGH_RELIABILITY_SOURCES = 1;
/**
 * A consequence is "quantified" if it carries a magnitude: a percentage, a
 * number with a unit, a number large enough to be a count rather than an
 * enumeration, or a number followed within a couple of words by a countable
 * noun ("70000 excess deaths"). Deliberately permissive about word order,
 * because English puts the unit wherever it likes.
 */
const QUANTITY_PATTERNS: readonly RegExp[] = [
  /\d[\d.,]*\s*%/,
  /\d[\d.,]*\s*(?:percent|°c|km|ha|kwh|mwh|twh|gw|kt|mt|gt|tonnes?|eur|usd|€|\$)\b/i,
  /\b\d[\d.,]{2,}\b/,
  /\b\d[\d.,]*\s+(?:\w+\s+){0,2}(?:deaths?|people|persons?|years?|days?|million|billion|thousand|cases?|species|households?|hectares?)\b/i,
];

function isQuantified(text: string): boolean {
  return QUANTITY_PATTERNS.some((pattern) => pattern.test(text));
}

export function evaluateProblemCandidate(draft: ProblemCandidateDraft): CurationReport {
  const checks: CurationCheck[] = [];

  const push = (check: CurationCheck): void => {
    checks.push(check);
  };

  push({
    id: 'TITLE_SHAPE',
    label: 'Title states a problem, not a topic',
    passed: draft.title.trim().length >= 20 && draft.title.trim().length <= 200,
    blocking: true,
    detail: 'Between 20 and 200 characters.',
  });

  push({
    id: 'DESCRIPTION_DEPTH',
    label: 'Factual description present',
    passed: draft.description.trim().length >= 300,
    blocking: true,
    detail: 'At least 300 characters of factual description.',
  });

  const sourceCount = draft.sources.length;
  push({
    id: 'SOURCE_COUNT',
    label: `At least ${MIN_SOURCES} distinct sources`,
    passed: sourceCount >= MIN_SOURCES,
    blocking: true,
    detail: `Has ${sourceCount}.`,
  });

  const highReliability = draft.sources.filter((source) => source.reliability === 'HIGH').length;
  push({
    id: 'SOURCE_QUALITY',
    label: 'At least one primary/high-reliability source',
    passed: highReliability >= MIN_HIGH_RELIABILITY_SOURCES,
    blocking: true,
    detail: `Has ${highReliability} HIGH-reliability source(s).`,
  });

  const citedConsequences = draft.whyItMatters.filter((item) => item.sourceIds.length > 0);
  push({
    id: 'CONSEQUENCES_CITED',
    label: 'Consequences are traceable to sources',
    passed: citedConsequences.length >= 1,
    blocking: true,
    detail: `${citedConsequences.length} of ${draft.whyItMatters.length} statements carry a source.`,
  });

  const quantified = draft.whyItMatters.some((item) => isQuantified(item.text));
  push({
    id: 'CONSEQUENCES_QUANTIFIED',
    label: 'At least one quantified consequence',
    passed: quantified,
    blocking: true,
    detail: 'A magnitude, a rate or a count, not just an adjective.',
  });

  const measurableCriteria = draft.successCriteria.filter(
    (criterion) =>
      criterion.metric.trim().length >= 5 &&
      criterion.target.trim().length >= 1 &&
      criterion.horizon.trim().length >= 1,
  );
  push({
    id: 'SUCCESS_CRITERIA',
    label: 'Measurable success criteria',
    passed: measurableCriteria.length >= 1,
    blocking: true,
    detail: `${measurableCriteria.length} complete criterion/criteria (metric + target + horizon).`,
  });

  const constraintCount = Object.values(draft.constraints).filter(
    (value) => typeof value === 'string' && value.trim().length > 0,
  ).length;
  push({
    id: 'CONSTRAINTS',
    label: 'Constraints stated',
    passed: constraintCount >= 2,
    blocking: true,
    detail: `${constraintCount} of 5 constraint dimensions filled.`,
  });

  push({
    id: 'DOMAINS',
    label: 'At least one research domain assigned',
    passed: draft.domains.length >= 1,
    blocking: true,
    detail: draft.domains.join(', ') || 'none',
  });

  push({
    id: 'OPEN_QUESTIONS',
    label: 'Open questions listed',
    passed: draft.openQuestions.length >= 2,
    blocking: false,
    detail: `${draft.openQuestions.length} listed. A problem with no open questions is a report, not a problem.`,
  });

  const normalizedTitle = draft.title.trim().toLowerCase();
  const duplicate = (draft.existingTitles ?? []).some(
    (title) => title.trim().toLowerCase() === normalizedTitle,
  );
  push({
    id: 'NOT_DUPLICATE',
    label: 'Not a duplicate of a published problem',
    passed: !duplicate,
    blocking: true,
    detail: duplicate ? 'An identical title is already published.' : 'No exact title collision.',
  });

  const blocking = checks
    .filter((check) => check.blocking && !check.passed)
    .map((check) => check.label);
  const warnings = checks
    .filter((check) => !check.blocking && !check.passed)
    .map((check) => check.label);
  const passedCount = checks.filter((check) => check.passed).length;

  return {
    checks,
    blocking,
    warnings,
    score: Math.round((passedCount / checks.length) * 100),
    eligibleForCuration: blocking.length === 0,
  };
}
