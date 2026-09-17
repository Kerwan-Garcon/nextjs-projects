import type { AgentRole } from './enums.js';

/**
 * Agent registry.
 *
 * Eleven narrow agents, not one omnipotent one. Each declares the tools it may
 * use and what it is allowed to write; the runtime refuses anything outside
 * that declaration, so "the model decided to" is never an explanation for a
 * write that should not have happened.
 */

export const AGENT_TOOLS = [
  'corpus.search',
  'corpus.read_source',
  'problem.read',
  'hypothesis.read',
  'evidence.read',
  'evidence.propose',
  'findings.write',
  'brief.write',
  'candidate.score',
  'simulation.run',
] as const;

export type AgentTool = (typeof AGENT_TOOLS)[number];

export interface AgentPermissions {
  /** May propose evidence links for human review. Never auto-attaches. */
  proposeEvidence: boolean;
  /** May write findings attached to its own run. */
  writeFindings: boolean;
  /** May assemble a research brief from other runs' findings. */
  writeBrief: boolean;
  /** May score an ingestion candidate. Publishing always stays human. */
  scoreCandidates: boolean;
  /** Hard ceiling on findings per run, so a loop cannot flood the record. */
  maxFindings: number;
}

export interface AgentDefinition {
  role: AgentRole;
  name: string;
  mission: string;
  description: string;
  tools: AgentTool[];
  permissions: AgentPermissions;
  /** The role prompt. Provider-agnostic: it describes the job, not a format. */
  instructions: string;
}

const base = (overrides: Partial<AgentPermissions> = {}): AgentPermissions => ({
  proposeEvidence: false,
  writeFindings: true,
  writeBrief: false,
  scoreCandidates: false,
  maxFindings: 8,
  ...overrides,
});

export const AGENTS: Readonly<Record<AgentRole, AgentDefinition>> = Object.freeze({
  SCOUT: {
    role: 'SCOUT',
    name: 'Scout',
    mission: 'Surface real-world situations that may contain an unsolved, well-posed problem.',
    description:
      'Reads incoming documents from source connectors and flags the ones that describe an unresolved gap rather than a finished result.',
    tools: ['corpus.search', 'corpus.read_source'],
    permissions: base({ maxFindings: 6 }),
    instructions:
      'Identify whether the supplied documents describe an open problem: something measurable that is not yet solved. Do not propose solutions. If the document only reports a completed result, say so.',
  },
  RESEARCHER: {
    role: 'RESEARCHER',
    name: 'Researcher',
    mission: 'Retrieve the literature, datasets and existing work that bear on a claim.',
    description:
      'Searches the evidence corpus and returns the records that actually bear on the claim, with the reason each one was retrieved.',
    tools: [
      'corpus.search',
      'corpus.read_source',
      'hypothesis.read',
      'problem.read',
      'evidence.propose',
    ],
    permissions: base({ proposeEvidence: true, maxFindings: 10 }),
    instructions:
      'Retrieve sources that bear on the claim. For each, state precisely what it is and why it was retrieved. Never summarise findings you have not read in the supplied material; if the source only establishes context, say that.',
  },
  SYNTHESIZER: {
    role: 'SYNTHESIZER',
    name: 'Synthesizer',
    mission: 'Turn a set of runs into one structured, readable state of the question.',
    description:
      'Assembles evidence, counterevidence, unknowns and a suggested next experiment into a single brief without adding new claims.',
    tools: ['hypothesis.read', 'problem.read', 'evidence.read', 'brief.write'],
    permissions: base({ writeBrief: true, maxFindings: 12 }),
    instructions:
      'Assemble the prior findings into a brief. Introduce no claim that is not already present in them. Where the record is empty, write UNKNOWN.',
  },
  SCIENTIST: {
    role: 'SCIENTIST',
    name: 'Scientist',
    mission: 'Assess whether the proposed mechanism is physically and biologically plausible.',
    description:
      'Checks the stated mechanism against the cited evidence and names the steps that are not established.',
    tools: ['hypothesis.read', 'evidence.read', 'corpus.read_source'],
    permissions: base(),
    instructions:
      'Evaluate the plausibility of the mechanism as stated. Separate the steps that the cited evidence supports from the steps that are assumed.',
  },
  ENGINEER: {
    role: 'ENGINEER',
    name: 'Engineer',
    mission:
      'Assess whether the thing could actually be built and deployed under the stated constraints.',
    description:
      'Confronts the hypothesis with the problem constraints: budget, time, geography, technology, and what is missing from the plan.',
    tools: ['hypothesis.read', 'problem.read', 'evidence.read'],
    permissions: base(),
    instructions:
      'Confront the proposal with the problem constraints. Name the deployment steps that are unspecified. Where a quantity is needed and absent, write UNKNOWN rather than estimating.',
  },
  ECONOMIST: {
    role: 'ECONOMIST',
    name: 'Economist',
    mission: 'Assess cost, who pays, and whether the incentive structure permits adoption.',
    description:
      'Examines the cost and scalability claims and identifies the actor who would have to fund the change.',
    tools: ['hypothesis.read', 'problem.read', 'evidence.read'],
    permissions: base(),
    instructions:
      'Examine the cost and scalability statements. Identify who pays, who benefits, and whether those are the same party. Do not invent figures.',
  },
  SKEPTIC: {
    role: 'SKEPTIC',
    name: 'Skeptic',
    mission: 'Find the weaknesses, the missing evidence and the contradictions.',
    description:
      'Attacks the evidence base: unsupported assumptions, single-source dependencies, scope mismatches and contradicting records.',
    tools: ['hypothesis.read', 'evidence.read', 'corpus.search', 'corpus.read_source'],
    permissions: base({ maxFindings: 10 }),
    instructions:
      'Attack the evidence base, not the author. Name each assumption that carries no supporting source, each dependency on a single publisher, and each mismatch between what a source covers and what the claim needs.',
  },
  RED_TEAM: {
    role: 'RED_TEAM',
    name: 'Red Team',
    mission: 'Try to make the hypothesis fail.',
    description:
      'Constructs the conditions under which the proposal would not work, and states what would have to be true.',
    tools: ['hypothesis.read', 'problem.read', 'evidence.read', 'corpus.search'],
    permissions: base(),
    instructions:
      'Construct concrete failure modes: the conditions under which this would not work. For each, state what observation would confirm the failure mode is real.',
  },
  SIMULATOR: {
    role: 'SIMULATOR',
    name: 'Simulator',
    mission: 'Run the computational models that are actually available.',
    description:
      'Runs registered deterministic models. When no model is registered for a question it reports that, rather than producing a number.',
    tools: ['hypothesis.read', 'simulation.run'],
    permissions: base({ maxFindings: 4 }),
    instructions:
      'Run only registered models. If no model covers the question, report UNKNOWN and name the model that would be needed.',
  },
  EDITOR: {
    role: 'EDITOR',
    name: 'Editor',
    mission: 'Make the research record readable without changing what it says.',
    description:
      'Rewrites findings for clarity, preserving every qualifier, source link and stated uncertainty.',
    tools: ['brief.write'],
    permissions: base({ writeBrief: true, writeFindings: false }),
    instructions:
      'Improve readability only. Never remove a qualifier, a source reference, or an uncertainty statement.',
  },
  CURATOR: {
    role: 'CURATOR',
    name: 'Curator',
    mission: 'Decide whether a candidate problem is even eligible for a human curator to review.',
    description:
      'Applies the publication checklist to an ingestion candidate. It can block; it cannot publish. Publication is always a human act.',
    tools: ['candidate.score', 'corpus.read_source'],
    permissions: base({ scoreCandidates: true, writeFindings: true, maxFindings: 12 }),
    instructions:
      'Apply the publication checklist. Report each failed check. You do not publish; a human curator decides.',
  },
});

export const AGENT_LIST: readonly AgentDefinition[] = Object.freeze(Object.values(AGENTS));

export function getAgent(role: AgentRole): AgentDefinition {
  return AGENTS[role];
}

export function agentMayUse(role: AgentRole, tool: AgentTool): boolean {
  return AGENTS[role].tools.includes(tool);
}

/** Throws rather than silently degrading: a permission bug must be loud. */
export function assertTool(role: AgentRole, tool: AgentTool): void {
  if (!agentMayUse(role, tool)) {
    throw new Error(`Agent ${role} is not permitted to use tool "${tool}"`);
  }
}
