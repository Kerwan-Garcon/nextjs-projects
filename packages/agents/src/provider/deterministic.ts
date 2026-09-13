import { yearOf } from '@saveus/common';
import type {
  AIProvider,
  AgentContextPayload,
  GenerateRequest,
  GenerateResult,
  RawFinding,
  SourceContext,
} from './types.js';
import { validateFindings } from './types.js';

/**
 * Corpus-grounded deterministic provider.
 *
 * This is the provider the application runs on with no API key configured, and
 * it is built on one rule: it never asserts a fact it was not given. Everything
 * it produces is computed from records that are already in the database - which
 * sources were retrieved, which assumptions carry no evidence, which publisher
 * the evidence base depends on, which constraint the hypothesis does not
 * address. Where a value is genuinely absent it writes UNKNOWN.
 *
 * The consequence is that its output is dull compared with a language model's,
 * and completely checkable. That trade is the point.
 */

const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'of',
  'in',
  'on',
  'for',
  'to',
  'and',
  'or',
  'is',
  'are',
  'be',
  'by',
  'with',
  'that',
  'this',
  'it',
  'as',
  'at',
  'from',
  'can',
  'could',
  'would',
  'may',
  'might',
  'not',
  'no',
  'do',
  'does',
  'how',
  'what',
  'why',
  'we',
  'they',
  'their',
  'its',
  'more',
  'less',
  'than',
]);

export function keyTerms(text: string, limit = 12): string[] {
  const counts = new Map<string, number>();
  for (const word of text.toLowerCase().match(/[a-zà-ÿ][a-zà-ÿ0-9-]{2,}/g) ?? []) {
    if (STOP_WORDS.has(word)) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, limit)
    .map(([word]) => word);
}

function matchedTerms(source: SourceContext, terms: readonly string[]): string[] {
  const haystack = `${source.title} ${source.publisher} ${source.excerpt ?? ''}`.toLowerCase();
  return terms.filter((term) => haystack.includes(term));
}

function describe(source: SourceContext): string {
  const year = yearOf(source.publicationDate);
  return `"${source.title}" (${source.publisher}${year ? `, ${year}` : ''})`;
}

const NO_FINDINGS_NOTE =
  "The corpus contains no record matching this question. That is a statement about this platform's corpus, not about the world.";

export class DeterministicProvider implements AIProvider {
  readonly name = 'deterministic-corpus';
  readonly model = 'corpus-rules-v1';

  async generate(request: GenerateRequest): Promise<GenerateResult> {
    const produced = this.produce(request);
    const { findings, rejectedCitations, dropped } = validateFindings(
      produced,
      request.allowedSourceIds,
      request.maxFindings,
    );

    return {
      findings,
      provider: this.name,
      model: this.model,
      tokensIn: null,
      tokensOut: null,
      rejectedCitations,
      droppedFindings: dropped,
    };
  }

  private produce(request: GenerateRequest): RawFinding[] {
    const { context } = request;
    switch (request.agentRole) {
      case 'RESEARCHER':
        return researcherFindings(context);
      case 'SKEPTIC':
        return skepticFindings(context);
      case 'ENGINEER':
        return engineerFindings(context);
      case 'ECONOMIST':
        return economistFindings(context);
      case 'SCIENTIST':
        return scientistFindings(context);
      case 'RED_TEAM':
        return redTeamFindings(context);
      case 'SIMULATOR':
        return simulatorFindings(context);
      case 'SYNTHESIZER':
      case 'EDITOR':
        return synthesizerFindings(context);
      case 'SCOUT':
        return scoutFindings(context);
      case 'CURATOR':
        return curatorFindings(context);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Role rules                                                          */
/* ------------------------------------------------------------------ */

function researcherFindings(context: AgentContextPayload): RawFinding[] {
  const terms = keyTerms(
    [context.question, context.hypothesis?.claim ?? '', context.problem?.title ?? ''].join(' '),
  );

  if (context.retrieved.length === 0) {
    return [
      {
        kind: 'UNKNOWN',
        statement: `No source in the corpus matches this question: ${context.question}`,
        epistemicKind: 'UNKNOWN',
        confidence: 'UNCERTAIN',
        sourceIds: [],
        reasoning: `corpus.search was run on the terms [${terms.slice(0, 6).join(', ')}] and returned nothing.`,
        unresolved: NO_FINDINGS_NOTE,
      },
    ];
  }

  const findings: RawFinding[] = context.retrieved.map((source) => {
    const matched = matchedTerms(source, terms);
    return {
      kind: 'EVIDENCE',
      statement: `${describe(source)} is in scope for this question: ${source.sourceType
        .replace(/_/g, ' ')
        .toLowerCase()}, publisher reliability ${source.reliability}.`,
      epistemicKind: 'SOURCE_CLAIM',
      confidence: source.reliability === 'HIGH' ? 'PLAUSIBLE' : 'UNCERTAIN',
      sourceIds: [source.id],
      reasoning: `Retrieved by corpus.search. Matched ${matched.length} of ${terms.length} query terms${
        matched.length > 0 ? ` (${matched.slice(0, 5).join(', ')})` : ''
      } against catalogue metadata.`,
      unresolved:
        'Retrieval reads catalogue metadata, not the full text. Whether this source answers the question, and whether its population and geography match, is for a human reader to establish.',
    };
  });

  const highCount = context.retrieved.filter((source) => source.reliability === 'HIGH').length;
  findings.push({
    kind: 'SUMMARY',
    statement: `Retrieved ${context.retrieved.length} source(s); ${highCount} from publishers classified HIGH reliability.`,
    epistemicKind: 'INFERENCE',
    confidence: highCount >= 2 ? 'SUPPORTED' : 'UNCERTAIN',
    sourceIds: context.retrieved.map((source) => source.id).slice(0, 10),
    reasoning:
      'Counted over the retrieval set. Reliability comes from the platform publisher policy, not from a model.',
    unresolved:
      highCount === 0 ? 'No high-reliability publisher was retrieved for this question.' : null,
  });

  return findings;
}

function skepticFindings(context: AgentContextPayload): RawFinding[] {
  const hypothesis = context.hypothesis;
  if (!hypothesis) {
    return [unknownFinding('No hypothesis was supplied, so there is nothing to attack.')];
  }

  const findings: RawFinding[] = [];
  const supportingIds = hypothesis.supporting.map((entry) => entry.sourceId);
  const byId = new Map(context.retrieved.map((source) => [source.id, source]));

  // 1. Assumptions carrying no evidence of their own.
  for (const assumption of hypothesis.assumptions.slice(0, 4)) {
    findings.push({
      kind: 'ASSUMPTION',
      statement: `Assumption carries no source of its own: "${assumption}"`,
      epistemicKind: 'INFERENCE',
      confidence: 'UNCERTAIN',
      sourceIds: [],
      reasoning:
        'Evidence on this hypothesis is attached to the hypothesis as a whole, not to individual assumptions. Until an assumption is linked to a source, the claim inherits its uncertainty.',
      unresolved: `Which source establishes: ${assumption}`,
    });
  }

  // 2. Dependence on a single publisher.
  const publishers = supportingIds
    .map((id) => byId.get(id)?.publisher)
    .filter((publisher): publisher is string => Boolean(publisher));
  const counts = new Map<string, number>();
  for (const publisher of publishers) counts.set(publisher, (counts.get(publisher) ?? 0) + 1);
  const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (dominant && dominant[1] >= 2 && dominant[1] / publishers.length >= 0.5) {
    findings.push({
      kind: 'RISK',
      statement: `The supporting evidence depends on one publisher: ${dominant[0]} accounts for ${dominant[1]} of ${publishers.length} supporting sources.`,
      epistemicKind: 'INFERENCE',
      confidence: 'SUPPORTED',
      sourceIds: supportingIds.slice(0, 6),
      reasoning: 'Counted over the publishers of the supporting evidence records.',
      unresolved: 'An independent replication from a different publisher has not been recorded.',
    });
  }

  // 3. Recorded contradicting evidence.
  if (hypothesis.contradicting.length > 0) {
    findings.push({
      kind: 'COUNTEREVIDENCE',
      statement: `${hypothesis.contradicting.length} record(s) on this hypothesis are filed as contradicting the claim.`,
      epistemicKind: 'SOURCE_CLAIM',
      confidence: 'CONTESTED',
      sourceIds: hypothesis.contradicting.map((entry) => entry.sourceId).slice(0, 6),
      reasoning:
        'Read directly from the evidence record. Each contradicting entry names the source it comes from.',
      unresolved:
        'Whether the contradiction is about the mechanism or about the context has not been separated.',
    });
  } else {
    findings.push({
      kind: 'RISK',
      statement: 'No contradicting evidence is recorded against this hypothesis.',
      epistemicKind: 'INFERENCE',
      confidence: 'UNCERTAIN',
      sourceIds: [],
      reasoning:
        'The evidence table contains no CONTRADICTS row. Absence of recorded counterevidence is not evidence that none exists; it usually means nobody has looked.',
      unresolved: 'Has anyone searched specifically for disconfirming results?',
    });
  }

  // 4. Declared unknowns are surfaced rather than buried in a field.
  for (const unknown of hypothesis.unknowns.slice(0, 3)) {
    findings.push({
      kind: 'UNKNOWN',
      statement: unknown,
      epistemicKind: 'UNKNOWN',
      confidence: 'UNCERTAIN',
      sourceIds: [],
      reasoning: 'Declared by the hypothesis author as unresolved.',
      unresolved: unknown,
    });
  }

  // 5. Geographic scope mismatch.
  const geography = context.problem?.geographyLabel;
  if (geography && geography.toLowerCase() !== 'global') {
    const term = geography.toLowerCase().split(/[\s,]+/)[0] ?? '';
    const localised = context.retrieved.filter((source) =>
      `${source.title} ${source.publisher}`.toLowerCase().includes(term),
    );
    if (term.length > 3 && localised.length === 0) {
      findings.push({
        kind: 'RISK',
        statement: `No retrieved source is specific to ${geography}; the evidence base is transferred from other contexts.`,
        epistemicKind: 'INFERENCE',
        confidence: 'PLAUSIBLE',
        sourceIds: [],
        reasoning: `Matched "${term}" against the titles and publishers of the ${context.retrieved.length} retrieved sources; no match.`,
        unresolved: `Does the effect hold in ${geography}, with its building stock, climate and institutions?`,
      });
    }
  }

  // 6. Age of the evidence base.
  const years = context.retrieved
    .map((source) => yearOf(source.publicationDate))
    .filter((year): year is number => year !== null);
  const newest = years.length > 0 ? Math.max(...years) : null;
  if (newest !== null && new Date().getUTCFullYear() - newest >= 8) {
    findings.push({
      kind: 'RISK',
      statement: `The most recent retrieved source dates from ${newest}.`,
      epistemicKind: 'INFERENCE',
      confidence: 'SUPPORTED',
      sourceIds: [],
      reasoning: 'Maximum publication year over the retrieval set.',
      unresolved: 'Whether more recent work has superseded these results.',
    });
  }

  return findings;
}

function engineerFindings(context: AgentContextPayload): RawFinding[] {
  const { hypothesis, problem } = context;
  if (!hypothesis || !problem) {
    return [unknownFinding('Feasibility needs both a hypothesis and the problem constraints.')];
  }

  const findings: RawFinding[] = [];
  const plan =
    `${hypothesis.mechanism} ${hypothesis.expectedImpact} ${hypothesis.validationMethod}`.toLowerCase();

  for (const [dimension, constraint] of Object.entries(problem.constraints)) {
    if (!constraint) continue;
    const terms = keyTerms(constraint, 6);
    const covered = terms.filter((term) => plan.includes(term));
    const addressed = covered.length >= Math.max(1, Math.ceil(terms.length / 3));
    findings.push({
      kind: addressed ? 'COMPARISON' : 'RISK',
      statement: addressed
        ? `The ${dimension} constraint is at least touched by the proposed mechanism.`
        : `The ${dimension} constraint is not addressed by the proposed mechanism: "${constraint}"`,
      epistemicKind: 'INFERENCE',
      confidence: addressed ? 'PLAUSIBLE' : 'SUPPORTED',
      sourceIds: [],
      reasoning: `Compared the ${dimension} constraint against the mechanism, impact and validation text. ${covered.length} of ${terms.length} constraint terms appear in the plan.`,
      unresolved: addressed ? null : `How does the proposal satisfy the ${dimension} constraint?`,
    });
  }

  if (!hypothesis.estimatedCost) {
    findings.push({
      kind: 'UNKNOWN',
      statement: 'Deployment cost is UNKNOWN: the hypothesis states no cost estimate.',
      epistemicKind: 'UNKNOWN',
      confidence: 'UNCERTAIN',
      sourceIds: [],
      reasoning: 'The estimated_cost field is empty. No figure is substituted.',
      unresolved: 'Cost per unit deployed, and the total for the stated geography.',
    });
  }

  if (!hypothesis.estimatedScalability) {
    findings.push({
      kind: 'UNKNOWN',
      statement: 'Scalability is UNKNOWN: the hypothesis states no scaling limit.',
      epistemicKind: 'UNKNOWN',
      confidence: 'UNCERTAIN',
      sourceIds: [],
      reasoning: 'The estimated_scalability field is empty.',
      unresolved:
        'What is the binding constraint on scale: material, labour, permitting, or capital?',
    });
  }

  const uncoveredCriteria = problem.successCriteria.filter(
    (criterion) => !plan.includes((keyTerms(criterion.metric, 3)[0] ?? '###').toLowerCase()),
  );
  for (const criterion of uncoveredCriteria.slice(0, 2)) {
    findings.push({
      kind: 'TEST_DESIGN',
      statement: `The proposal does not say how it moves the success criterion "${criterion.metric}" (target ${criterion.target} by ${criterion.horizon}).`,
      epistemicKind: 'INFERENCE',
      confidence: 'PLAUSIBLE',
      sourceIds: [],
      reasoning:
        'The problem success criteria were compared with the mechanism and expected-impact text.',
      unresolved: `Expected effect size on ${criterion.metric}.`,
    });
  }

  return findings;
}

function economistFindings(context: AgentContextPayload): RawFinding[] {
  const hypothesis = context.hypothesis;
  if (!hypothesis) return [unknownFinding('No hypothesis supplied.')];

  const findings: RawFinding[] = [
    {
      kind: hypothesis.estimatedCost ? 'COMPARISON' : 'UNKNOWN',
      statement: hypothesis.estimatedCost
        ? `Stated cost: ${hypothesis.estimatedCost}. The record does not say who pays it.`
        : 'Cost is UNKNOWN and no payer is identified.',
      epistemicKind: hypothesis.estimatedCost ? 'INFERENCE' : 'UNKNOWN',
      confidence: 'UNCERTAIN',
      sourceIds: [],
      reasoning:
        'Read from the hypothesis cost field; the payer is not a field in the schema and was not stated in prose.',
      unresolved: 'Who funds this, and do they capture the benefit?',
    },
  ];

  const budget = context.problem?.constraints.budget;
  if (budget) {
    findings.push({
      kind: 'RISK',
      statement: `The problem states a budget constraint ("${budget}") that the hypothesis does not price against.`,
      epistemicKind: 'INFERENCE',
      confidence: hypothesis.estimatedCost ? 'UNCERTAIN' : 'PLAUSIBLE',
      sourceIds: [],
      reasoning: 'Compared the problem budget constraint against the hypothesis cost statement.',
      unresolved: 'Cost per unit of outcome, comparable with the alternatives.',
    });
  }

  return findings;
}

function scientistFindings(context: AgentContextPayload): RawFinding[] {
  const hypothesis = context.hypothesis;
  if (!hypothesis) return [unknownFinding('No hypothesis supplied.')];

  const steps = hypothesis.mechanism
    .split(/(?:\.|;|→|->)\s+/)
    .map((step) => step.trim())
    .filter((step) => step.length > 25);

  const findings: RawFinding[] = steps.slice(0, 4).map((step, index) => ({
    kind: 'ASSUMPTION' as const,
    statement: `Mechanism step ${index + 1} is asserted, not yet sourced: "${step}"`,
    epistemicKind: 'INFERENCE' as const,
    confidence: 'UNCERTAIN' as const,
    sourceIds: [],
    reasoning:
      'The mechanism was split into sequential steps. Evidence is attached at hypothesis level, so no individual step is currently backed by a specific source.',
    unresolved: `Which source establishes this step?`,
  }));

  findings.push({
    kind: 'SUMMARY',
    statement: `The mechanism decomposes into ${steps.length} step(s); ${hypothesis.supporting.length} supporting source(s) are attached to the hypothesis as a whole.`,
    epistemicKind: 'INFERENCE',
    confidence: hypothesis.supporting.length >= steps.length ? 'PLAUSIBLE' : 'UNCERTAIN',
    sourceIds: hypothesis.supporting.map((entry) => entry.sourceId).slice(0, 8),
    reasoning: 'Counted over the mechanism text and the evidence record.',
    unresolved: 'A per-step evidence map does not exist yet.',
  });

  return findings;
}

function redTeamFindings(context: AgentContextPayload): RawFinding[] {
  const hypothesis = context.hypothesis;
  if (!hypothesis) return [unknownFinding('No hypothesis supplied.')];

  const findings: RawFinding[] = hypothesis.assumptions.slice(0, 3).map((assumption) => ({
    kind: 'RISK' as const,
    statement: `Failure mode: the hypothesis fails if this assumption is false - "${assumption}"`,
    epistemicKind: 'INFERENCE' as const,
    confidence: 'PLAUSIBLE' as const,
    sourceIds: [],
    reasoning: 'Each declared assumption is inverted to produce a concrete failure condition.',
    unresolved: `What observation would show that "${assumption}" does not hold in the target setting?`,
  }));

  for (const risk of hypothesis.risks.slice(0, 3)) {
    findings.push({
      kind: 'RISK',
      statement: `Author-declared risk, restated as a test: ${risk}`,
      epistemicKind: 'INFERENCE',
      confidence: 'UNCERTAIN',
      sourceIds: [],
      reasoning: 'Taken from the hypothesis risk list; no independent assessment was performed.',
      unresolved: 'Has this risk been quantified anywhere in the record?',
    });
  }

  if (findings.length === 0) {
    findings.push(
      unknownFinding('The hypothesis declares neither assumptions nor risks to attack.'),
    );
  }
  return findings;
}

function simulatorFindings(context: AgentContextPayload): RawFinding[] {
  return [
    {
      kind: 'UNKNOWN',
      statement:
        'No computational model is registered for this question, so no simulation was run.',
      epistemicKind: 'UNKNOWN',
      confidence: 'UNCERTAIN',
      sourceIds: [],
      reasoning:
        'The simulator only executes models registered in the simulation registry. The registry is empty in this deployment, so it reports that rather than producing a number.',
      unresolved: `A model capable of answering: ${context.question}`,
    },
  ];
}

function synthesizerFindings(context: AgentContextPayload): RawFinding[] {
  if (context.priorFindings.length === 0) {
    return [unknownFinding('No prior findings to synthesise.')];
  }

  const byKind = new Map<string, number>();
  for (const finding of context.priorFindings) {
    byKind.set(finding.kind, (byKind.get(finding.kind) ?? 0) + 1);
  }

  const findings: RawFinding[] = [
    {
      kind: 'SUMMARY',
      statement: `Synthesised ${context.priorFindings.length} finding(s) from ${
        new Set(context.priorFindings.map((entry) => entry.role)).size
      } agent run(s): ${[...byKind.entries()].map(([kind, count]) => `${count} ${kind.toLowerCase()}`).join(', ')}.`,
      epistemicKind: 'INFERENCE',
      confidence: 'SUPPORTED',
      sourceIds: [],
      reasoning:
        'Counted over the findings produced earlier in this pipeline. No new claim is introduced here.',
      unresolved: null,
    },
  ];

  const unknowns = context.priorFindings.filter((entry) => entry.kind === 'UNKNOWN');
  if (unknowns.length > 0) {
    findings.push({
      kind: 'UNKNOWN',
      statement: `${unknowns.length} open unknown(s) remain after this pipeline.`,
      epistemicKind: 'UNKNOWN',
      confidence: 'UNCERTAIN',
      sourceIds: [],
      reasoning: 'Collected from the UNKNOWN findings of the preceding runs.',
      unresolved: unknowns
        .slice(0, 3)
        .map((entry) => entry.statement)
        .join(' | '),
    });
  }

  return findings;
}

function scoutFindings(context: AgentContextPayload): RawFinding[] {
  if (context.retrieved.length === 0) {
    return [unknownFinding('No candidate documents supplied.')];
  }
  return context.retrieved.slice(0, 6).map((source) => ({
    kind: 'SUMMARY' as const,
    statement: `${describe(source)} describes a situation that may contain an open problem.`,
    epistemicKind: 'SOURCE_CLAIM' as const,
    confidence: source.reliability === 'HIGH' ? 'PLAUSIBLE' : 'UNCERTAIN',
    sourceIds: [source.id],
    reasoning:
      'Flagged from the connector intake. Whether an open, well-posed problem exists is decided downstream.',
    unresolved: 'What specifically is unresolved in this document?',
  }));
}

function curatorFindings(context: AgentContextPayload): RawFinding[] {
  return [
    {
      kind: 'SUMMARY',
      statement:
        'Curation checks are computed by the publication checklist, not by a model. This run records the checklist outcome only.',
      epistemicKind: 'INFERENCE',
      confidence: 'SUPPORTED',
      sourceIds: context.retrieved.map((source) => source.id).slice(0, 8),
      reasoning:
        'The curator agent applies evaluateProblemCandidate and reports its blocking checks.',
      unresolved: 'A human curator still decides whether this is published.',
    },
  ];
}

function unknownFinding(statement: string): RawFinding {
  return {
    kind: 'UNKNOWN',
    statement,
    epistemicKind: 'UNKNOWN',
    confidence: 'UNCERTAIN',
    sourceIds: [],
    reasoning: 'Produced by the deterministic provider when the required context was not present.',
    unresolved: statement,
  };
}
