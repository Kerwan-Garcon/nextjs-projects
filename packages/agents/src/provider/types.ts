import { z } from 'zod';
import { ConfidenceLevel, EpistemicKind, type AgentRole } from '@saveus/common';

/**
 * AI provider abstraction.
 *
 * The product is not built around one vendor. An agent hands the provider a
 * fully-built, already-sanitised context and gets back findings that are
 * validated before anything is persisted.
 */

export const FINDING_KINDS = [
  'EVIDENCE',
  'COUNTEREVIDENCE',
  'ASSUMPTION',
  'RISK',
  'UNKNOWN',
  'EXISTING_SOLUTION',
  'TEST_DESIGN',
  'COMPARISON',
  'SUMMARY',
] as const;

export const RawFindingSchema = z.object({
  kind: z.enum(FINDING_KINDS),
  statement: z.string().trim().min(10).max(1200),
  epistemicKind: EpistemicKind,
  confidence: ConfidenceLevel,
  sourceIds: z.array(z.string().uuid()).max(10).default([]),
  reasoning: z.string().trim().min(10).max(1600),
  unresolved: z.string().trim().max(800).nullable().default(null),
});
export type RawFinding = z.infer<typeof RawFindingSchema>;

export const GenerateOutputSchema = z.object({
  findings: z.array(RawFindingSchema).max(20),
});

/** A source as an agent sees it: metadata only, never unverified prose. */
export interface SourceContext {
  id: string;
  title: string;
  publisher: string;
  publicationDate: string | null;
  sourceType: string;
  reliability: string;
  url: string;
  /** Abstract or note, already wrapped as untrusted content. */
  excerpt: string | null;
}

export interface HypothesisContext {
  id: string;
  ref: string;
  title: string;
  claim: string;
  mechanism: string;
  expectedImpact: string;
  assumptions: string[];
  unknowns: string[];
  risks: string[];
  estimatedCost: string | null;
  estimatedScalability: string | null;
  validationMethod: string;
  status: string;
  supporting: { sourceId: string; claim: string; strength: number }[];
  contradicting: { sourceId: string; claim: string; strength: number }[];
}

export interface ProblemContext {
  id: string;
  ref: string;
  title: string;
  summary: string;
  geographyLabel: string;
  domains: string[];
  constraints: Record<string, string | null>;
  successCriteria: { metric: string; target: string; horizon: string }[];
  openQuestions: string[];
}

export interface AgentContextPayload {
  question: string;
  problem: ProblemContext | null;
  hypothesis: HypothesisContext | null;
  /** Candidates retrieved by the search provider for this run. */
  retrieved: SourceContext[];
  /** Findings produced earlier in the same pipeline. */
  priorFindings: { role: AgentRole; kind: string; statement: string; confidence: string }[];
}

export interface GenerateRequest {
  agentRole: AgentRole;
  action: string;
  instructions: string;
  context: AgentContextPayload;
  /** Only these source ids may be cited. Anything else is dropped. */
  allowedSourceIds: string[];
  maxFindings: number;
}

export interface GenerateResult {
  findings: RawFinding[];
  provider: string;
  model: string;
  tokensIn: number | null;
  tokensOut: number | null;
  /** Citations the provider produced that were not in the allowed set. */
  rejectedCitations: string[];
  /** Findings dropped because they failed validation. */
  droppedFindings: number;
}

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  generate(request: GenerateRequest): Promise<GenerateResult>;
}

/**
 * Output validation applied to every provider, including the deterministic one.
 * A citation to a source that was not in the retrieval set is the classic
 * fabricated-reference failure, so it is removed and counted.
 */
export function validateFindings(
  raw: unknown,
  allowedSourceIds: readonly string[],
  maxFindings: number,
): { findings: RawFinding[]; rejectedCitations: string[]; dropped: number } {
  const allowed = new Set(allowedSourceIds);
  const rejectedCitations: string[] = [];
  let dropped = 0;

  const parsed = z.array(z.unknown()).safeParse(raw);
  if (!parsed.success) return { findings: [], rejectedCitations, dropped: 1 };

  const findings: RawFinding[] = [];
  for (const entry of parsed.data) {
    const result = RawFindingSchema.safeParse(entry);
    if (!result.success) {
      dropped += 1;
      continue;
    }
    const kept: string[] = [];
    for (const id of result.data.sourceIds) {
      if (allowed.has(id)) kept.push(id);
      else rejectedCitations.push(id);
    }
    // A statement presented as a fact or a source claim must carry a source.
    const needsSource =
      result.data.epistemicKind === 'FACT' || result.data.epistemicKind === 'SOURCE_CLAIM';
    const epistemicKind = needsSource && kept.length === 0 ? 'UNKNOWN' : result.data.epistemicKind;

    findings.push({ ...result.data, sourceIds: kept, epistemicKind });
    if (findings.length >= maxFindings) break;
  }

  return { findings, rejectedCitations, dropped };
}
