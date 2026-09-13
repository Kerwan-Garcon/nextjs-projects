import type { ContributionKind } from '@saveus/common';

/**
 * Seed discussion generator. DEMO DATA.
 *
 * Contribution bodies are composed from the problem's and hypothesis's own
 * content - its open questions, its constraints, its declared assumptions and
 * the titles of the sources actually attached to it - so every seeded post is
 * specific to the thing it is attached to rather than filler.
 *
 * One rule constrains the RESULT template in particular: a seeded contribution
 * never reports an experimental finding, because inventing a result and
 * presenting it as real is exactly what this platform exists to prevent. The
 * RESULT template reports checks performed on the research record itself,
 * which is a real thing a contributor can do and verify.
 */

export interface ContributionContext {
  problemTitle: string;
  geography: string;
  openQuestion: string;
  secondOpenQuestion: string;
  constraintDimension: string;
  constraintText: string;
  hypothesisTitle: string;
  claim: string;
  assumption: string;
  unknown: string;
  risk: string;
  validationMethod: string;
  supportingSourceTitle: string;
  supportingPublisher: string;
  contradictingSourceTitle: string | null;
  supportingCount: number;
  contradictingCount: number;
}

type Template = (context: ContributionContext) => string;

const COMMENT: Template[] = [
  (c) =>
    `The part of this that matters is the scope. "${c.hypothesisTitle}" is stated generally, but the problem constrains it to ${c.geography}, and the evidence attached is not specific to that. That is not fatal, it just means the claim as written is broader than what is currently supported.`,
  (c) =>
    `Worth separating two things that keep getting merged in this thread. One is whether the mechanism works. The other is whether it can be deployed under the ${c.constraintDimension} constraint the problem states: "${c.constraintText}". The evidence here speaks to the first and is silent on the second.`,
  (c) =>
    `Reading the evidence set: ${c.supportingCount} supporting record(s), ${c.contradictingCount} contradicting. That ratio is not an argument by itself - the supporting side leans on ${c.supportingPublisher}, and one publisher is not independent replication.`,
  (c) =>
    `A note on framing. This hypothesis is written as if ${c.unknown} were a detail. It is not a detail; it is the quantity the whole expected impact depends on. I would rather see the claim narrowed than see that gap left implicit.`,
];

const QUESTION: Template[] = [
  (c) =>
    `What observation would answer this: ${c.openQuestion} Right now the record says UNKNOWN and the argument proceeds as though it did not matter. If nobody can name the measurement, that is itself a finding.`,
  (c) =>
    `Direct question to the author: does the claim survive if ${c.assumption.toLowerCase().replace(/\.$/, '')} turns out to be false only in ${c.geography}, rather than generally? I am trying to work out whether this is a global claim with a local test or a local claim stated globally.`,
  (c) =>
    `Has anyone checked whether ${c.secondOpenQuestion.replace(/\?$/, '')} is answerable from existing published data? Before designing a new study it would be worth knowing whether the answer is already sitting in someone's appendix.`,
];

const EVIDENCE: Template[] = [
  (c) =>
    `Adding "${c.supportingSourceTitle}" (${c.supportingPublisher}) to this thread. It is relevant to ${c.openQuestion.replace(/\?$/, '')}, and I want to be precise about what it does and does not do: it establishes the framing and the measurement basis, it does not establish the effect size this hypothesis needs.`,
  (c) =>
    `Attaching a source that speaks to the ${c.constraintDimension} constraint rather than to the mechanism: "${c.supportingSourceTitle}". Most of the evidence in this thread is about whether the thing works. This is about whether it could be deployed, which is the half that has been thin.`,
  (c) =>
    `"${c.supportingSourceTitle}" is already attached, but I do not think its limits have been stated in the thread. It is a ${c.supportingPublisher} record - useful as a reference point, not as a measurement of the specific quantity claimed here.`,
];

const COUNTERARGUMENT: Template[] = [
  (c) =>
    `The assumption "${c.assumption}" is carrying the entire claim, and nothing attached to this hypothesis establishes it. Invert it and the expected impact goes to roughly zero. That is not a nitpick about a caveat; it is the load-bearing element, and it is unsourced.`,
  (c) =>
    `Two problems with the mechanism as stated. First, ${c.unknown.charAt(0).toLowerCase()}${c.unknown.slice(1).replace(/\.$/, '')} is unresolved, and the impact estimate implicitly assumes a value for it. Second, the declared risk - "${c.risk}" - is listed and then not addressed anywhere in the mechanism. A risk that appears only in the risk list has not been handled.`,
  (c) =>
    c.contradictingSourceTitle
      ? `Pointing at the contradicting record rather than talking around it: "${c.contradictingSourceTitle}" cuts against this. The thread has been treating it as a caveat. It is not a caveat, it is a different answer to the same question, and the hypothesis needs to say why it is wrong or narrow the claim.`
      : `No contradicting evidence is recorded on this hypothesis at all. That is not reassuring, it is a gap: it almost certainly means nobody has searched for disconfirming work, not that none exists.`,
  (c) =>
    `Scope objection. The mechanism is plausible in general and the problem is specific to ${c.geography}. Transferring an effect across contexts is an assumption, and here it is an unstated one. I would like to see either evidence from ${c.geography} or the claim restated as conditional.`,
];

const MODIFICATION: Template[] = [
  (c) =>
    `Proposing a narrowing. Restrict the claim to the subset covered by the ${c.constraintDimension} constraint ("${c.constraintText}"). The broad version is not testable within the problem's stated horizon; the narrow version is, and it keeps most of what makes it interesting.`,
  (c) =>
    `Suggested amendment to the validation method. As written - "${c.validationMethod.slice(0, 140)}..." - it would not distinguish the proposed mechanism from a plausible alternative. Adding a second arm that varies only the disputed step would fix that at modest extra cost.`,
  () =>
    `The claim and the mechanism are currently doing different amounts of work. The claim says the effect is large enough to matter; the mechanism only establishes direction. Suggest splitting: keep the directional claim here, and open a separate hypothesis for the magnitude, which needs different evidence.`,
];

const EXPERIMENT: Template[] = [
  () =>
    `A concrete design for this, to move it out of the abstract. Take the validation method already stated and fix the parts it leaves open: pre-register the primary endpoint, define the matched control before allocation, and publish the analysis plan first. Sample size is the open question - with the effect size implied here, nobody in this thread has yet written down a power calculation.`,
  (c) =>
    `Cheapest discriminating test I can think of: instrument a small number of cases in ${c.geography} and measure only the quantity that separates this hypothesis from its main rival. Not a full trial - a design whose only job is to make one of the two hypotheses less likely.`,
  (c) =>
    `Before a field trial, the record itself is testable: ${c.openQuestion.replace(/\?$/, '')} could be answered from published data in weeks rather than seasons. Doing that first would tell us whether the trial is worth running.`,
];

const RESULT: Template[] = [
  () =>
    `Record check, reporting back. Went through the sources attached to this hypothesis and confirmed each one resolves to its publisher. Noting for the next person: some point to a series landing page rather than a specific document, which is fine for provenance but means the specific quantity still has to be located inside the publication.`,
  (c) =>
    `Cross-check against the problem statement. ${c.supportingCount} supporting record(s) are attached here, and ${c.contradictingCount} contradicting. Of the supporting ones, the ones from ${c.supportingPublisher} are the same records already cited on the problem page, so this hypothesis adds less independent evidence than the count suggests.`,
  () =>
    `Went looking for disconfirming work on this specific claim and did not find it in the corpus. Recording the negative result so it is not repeated: what I searched, and what I did not find, is at least as useful as another supporting citation.`,
];

const TEMPLATES: Record<ContributionKind, Template[]> = {
  COMMENT,
  QUESTION,
  EVIDENCE,
  COUNTERARGUMENT,
  MODIFICATION,
  EXPERIMENT,
  RESULT,
};

export function renderContribution(
  kind: ContributionKind,
  index: number,
  context: ContributionContext,
): string {
  const templates = TEMPLATES[kind];
  const template = templates[index % templates.length] as Template;
  return template(context);
}

export function templateCount(kind: ContributionKind): number {
  return TEMPLATES[kind].length;
}
