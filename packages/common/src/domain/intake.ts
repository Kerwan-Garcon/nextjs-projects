import type { Reliability } from './enums.js';
import { findNearDuplicate, type DuplicateMatch } from './similarity.js';

/**
 * Intake relevance.
 *
 * The hard part of automated problem ingestion is not fetching. It is that most
 * of what a feed carries is not a problem: it is an announcement, an award, a
 * webinar, a correction, a job posting, or a finished result. Letting those
 * through would turn the board into a newsfeed with a serious typeface, which
 * is precisely the failure mode this product exists to avoid.
 *
 * The second failure mode is subtler and showed up the first time this ran
 * against live literature. A search for gap language returns a great deal of
 * perfectly good science that is not a problem for this board: a novel record
 * of a brown hyaena in a national park, xylem sap metabolomics in two bean
 * genotypes, a silage substitution trial. Every one of those states an open
 * question. None of them is a problem anybody needs solved at scale.
 *
 * So the gate asks three things, and a document has to answer all three:
 *
 *   1. Is something unresolved?   (GAP_PATTERNS)
 *   2. Does it harm someone or something at scale?  (STAKES_PATTERNS)
 *   3. Is the subject of the title societal rather than a specimen, a
 *      technique or a molecule?  (the title test)
 *
 * plus the disqualifiers, which reject outright regardless of score.
 *
 * Everything here is pure and inspectable. When the queue fills with rubbish,
 * the fix is a pattern in this file, and the test that pins it.
 */

/* ------------------------------------------------------------------ */
/* Signals                                                             */
/* ------------------------------------------------------------------ */

/** Language that marks something as unresolved. This is the core signal. */
export const GAP_PATTERNS: readonly { id: string; pattern: RegExp; weight: number }[] = Object.freeze([
  { id: 'REMAINS_UNRESOLVED', pattern: /\bremains?\s+(?:largely\s+|poorly\s+|still\s+)?(?:unresolved|unclear|unknown|uncertain|open|elusive|a\s+challenge|to\s+be\s+(?:determined|established|quantified))\b/i, weight: 3 },
  { id: 'NOT_ESTABLISHED', pattern: /\b(?:is|are|has|have)\s+not\s+(?:yet\s+)?(?:been\s+)?(?:well\s+|fully\s+|systematically\s+)?(?:established|quantified|understood|characteri[sz]ed|resolved|measured|evaluated|separated|captured)\b/i, weight: 3 },
  { id: 'POORLY_UNDERSTOOD', pattern: /\b(?:poorly|incompletely|insufficiently|not\s+well)\s+(?:understood|constrained|characteri[sz]ed|quantified|documented)\b/i, weight: 3 },
  { id: 'LITTLE_IS_KNOWN', pattern: /\b(?:little|less|few\s+studies?|limited\s+evidence|scarce\s+(?:data|evidence))\s+(?:is|are|have\s+been)?\s*(?:known|available|examined|investigated)?\b/i, weight: 2 },
  { id: 'FURTHER_RESEARCH', pattern: /\b(?:further|additional|more)\s+(?:research|work|study|studies|evidence|data)\s+(?:is|are)\s+(?:needed|required|warranted)\b/i, weight: 2 },
  { id: 'NO_CONSENSUS', pattern: /\b(?:no|lack\s+of)\s+(?:scientific\s+)?consensus\b|\b(?:remains?|is)\s+(?:debated|contested|controversial|disputed)\b/i, weight: 3 },
  { id: 'OPEN_QUESTION', pattern: /\bopen\s+(?:question|problem|gap|challenge)s?\b|\bknowledge\s+gaps?\b|\bevidence\s+gaps?\b/i, weight: 3 },
  { id: 'UNMET_NEED', pattern: /\b(?:unmet|unaddressed)\s+(?:need|demand|challenge)s?\b|\bno\s+(?:effective|proven|available)\s+(?:treatment|solution|method|approach)\b/i, weight: 3 },
  { id: 'TRADE_OFF', pattern: /\b(?:trade-?offs?|competing\s+(?:demands|priorities|objectives))\s+(?:between|among)\b/i, weight: 1 },
  { id: 'CHALLENGES_REMAIN', pattern: /\b(?:challenges?|gaps?|barriers?|obstacles?|uncertaint(?:y|ies)|questions?|concerns?|risks?)\s+(?:still\s+)?(?:remain|persist|continue)\b/i, weight: 3 },
  { id: 'FURTHER_ACTION', pattern: /\b(?:further|additional|more)\s+(?:action|effort|progress|investment)\s+(?:is|are)?\s*(?:needed|required)\b|\bmore\s+needs?\s+to\s+be\s+done\b/i, weight: 2 },
  { id: 'UNPREPARED', pattern: /\bunder-?prepared\b|\bill-prepared\b|\bnot\s+(?:well\s+)?prepared\b|\binsufficient(?:ly)?\s+(?:adapted|prepared|protected|funded)\b/i, weight: 3 },
  { id: 'UNEVEN', pattern: /\buneven(?:ly)?\b|\bpatchy\b|\blags?\s+behind\b|\bfalls?\s+short\b|\boff\s+track\b|\bnot\s+on\s+track\b/i, weight: 2 },
  { id: 'BARRIER', pattern: /\b(?:barriers?|bottlenecks?|binding\s+constraints?|obstacles?)\s+(?:to|remain|persist)\b/i, weight: 2 },
  // French, for francophone institutional feeds.
  { id: 'FR_MAL_CONNU', pattern: /\b(?:mal|peu|insuffisamment)\s+(?:connu|compris|documenté|quantifié)e?s?\b/i, weight: 3 },
  { id: 'FR_RESTE_A', pattern: /\breste(?:nt)?\s+(?:à|a)\s+(?:déterminer|établir|quantifier|démontrer)\b/i, weight: 3 },
]);

/**
 * What is at stake. An open question with nothing riding on it is a research
 * topic, not a problem. These name harm, loss, scarcity or exposure - the
 * reason a reader should care that the question is open.
 */
export const STAKES_PATTERNS: readonly { id: string; pattern: RegExp; weight: number }[] = Object.freeze([
  { id: 'MORTALITY', pattern: /\b(?:deaths?|mortality|fatalit(?:y|ies)|life\s+expectancy|years\s+of\s+life\s+lost|self-harm|suicides?)\b/i, weight: 4 },
  { id: 'MORBIDITY', pattern: /\b(?:disease\s+burden|hospitali[sz]ations?|morbidity|illnesss?|illnesses|infections?|malnutrition|stunting|disability)\b/i, weight: 3 },
  { id: 'EXPOSURE', pattern: /\bexposure\b|\bexposed\s+to\b|\bat\s+risk\b|\bvulnerable\s+(?:populations?|groups?|communities|households?)\b/i, weight: 3 },
  { id: 'SCARCITY', pattern: /\b(?:shortages?|scarcity|insecurity|famine|blackouts?|outages?|curtailment|supply\s+(?:risks?|shocks?|disruptions?|chain\s+risks?)|vulnerability\s+to)\b/i, weight: 3 },
  { id: 'HAZARD', pattern: /\bextreme\s+(?:heat|weather|events?|temperatures?)\b|\bheat\s?waves?\b|\b(?:floods?|flooding|droughts?|wildfires?|cyclones?|storm\s+surge)\b/i, weight: 3 },
  { id: 'DEGRADATION', pattern: /\b(?:deoxygenation|acidification|eutrophication|salini[sz]ation|desertification|erosion|deforestation|land\s+degradation|soil\s+loss)\b/i, weight: 3 },
  { id: 'ECOLOGICAL_LOSS', pattern: /\b(?:biodiversity\s+loss|habitat\s+loss|species\s+(?:loss|decline|extinctions?)|(?:critically\s+)?endangered|ecosystem\s+collapse|invasive\s+(?:alien\s+)?species)\b/i, weight: 3 },
  { id: 'THREATENS', pattern: /\bthreat(?:s|ens?|ened|ening)?\s+(?:to\s+)?(?:biodiversity|species|habitats?|ecosystems?|health|water\s+supply|food\s+security|security)\b/i, weight: 3 },
  { id: 'CONTAMINATION', pattern: /\b(?:contaminat\w+|pollution|pollutants?|toxic\w*|air\s+quality|unsafe\s+(?:drinking|water)|wastewater|microplastics?|pfas|heavy\s+metals?|chemicals?\s+in)\b/i, weight: 3 },
  { id: 'RESISTANCE', pattern: /\b(?:antimicrobial\s+resistance|antibiotic\s+resistance|drug-resistant|multidrug-resistant|treatment\s+failure|vaccine\s+hesitancy)\b/i, weight: 3 },
  { id: 'CLIMATE_FORCING', pattern: /\b(?:greenhouse\s+gas(?:es)?|carbon\s+(?:budget|storage|stocks?|sink)|global\s+warming|methane\s+emissions?|(?:co2|ghg)\s+emissions?|emissions?\s+(?:gap|reductions?)|net\s+zero|climate\s+adaptation)\b/i, weight: 2 },
  { id: 'ECONOMIC_LOSS', pattern: /\b(?:economic\s+(?:losses?|damages?|costs?)|yield\s+(?:loss|gap|decline)|crop\s+failure|billions?\s+of\s+(?:euros?|dollars?)|gdp\s+loss)\b/i, weight: 3 },
  { id: 'DISPLACEMENT', pattern: /\b(?:displacement|displaced\s+people|migration\s+pressure|refugees?|inequit(?:y|ies)|energy\s+poverty|inequalit(?:y|ies))\b/i, weight: 2 },
]);

/**
 * Who a problem is about. A title naming a population is about people; a title
 * naming a molecule is not.
 */
export const POPULATION_PATTERNS: readonly RegExp[] = Object.freeze([
  /\b(?:people|population(?:s|-level)?|inhabitants|residents|communities|households?)\b/i,
  /\b(?:children|infants?|newborns?|neonatal|adolescents?|adults?|older\s+adults|elderly|pregnan\w+|mothers?|workers?|patients?|farmers?|citizens?)\b/i,
  // Bare "health" counts: a title that says it is about health is about people.
  /\b(?:health|public\s+health|human\s+health|food\s+security|water\s+security|energy\s+security|livelihoods?)\b/i,
  /\b(?:cities|urban\s+areas|informal\s+settlements|low-\s?and\s?middle-income\s+countries|lmics?)\b/i,
]);

/**
 * Signals that a document is not a problem statement. These disqualify
 * outright: no accumulation of positive signal rescues a press release about a
 * prize, or a paper whose subject is a method rather than a problem.
 */
export const DISQUALIFYING_PATTERNS: readonly { id: string; pattern: RegExp; reason: string }[] =
  Object.freeze([
    { id: 'AWARD', pattern: /\b(?:wins?|won|awarded|receives?|honou?red\s+with)\s+(?:the\s+)?(?:\w+\s+){0,3}(?:prize|award|medal|fellowship)\b|\b(?:nobel|breakthrough)\s+prize\b/i, reason: 'Award or prize announcement' },
    { id: 'APPOINTMENT', pattern: /\b(?:appointed|named|elected|joins?|steps?\s+down|retires?|resigns?)\s+(?:as\s+)?(?:the\s+)?(?:new\s+)?(?:director|chair|president|professor|head|ceo|secretary|commissioner)\b/i, reason: 'Personnel announcement' },
    { id: 'PARTNERSHIP', pattern: /\b(?:sign(?:s|ed|ing)?|renew(?:s|ed|ing)?|cement(?:s|ed)?|strengthen(?:s|ed|ing)?|deepen(?:s|ed)?|map(?:s|ped)?\s+ahead)\s+(?:its\s+|their\s+|two\s+|the\s+|a\s+)?(?:new\s+|strategic\s+|joint\s+)?(?:partnerships?|cooperation|collaborations?|agreements?|memorandum|mou|priorities)\b/i, reason: 'Partnership or cooperation announcement' },
    { id: 'OBITUARY', pattern: /\b(?:obituary|in\s+memoriam|passed\s+away|remembering)\b/i, reason: 'Obituary' },
    { id: 'EVENT', pattern: /\b(?:webinar|register\s+now|save\s+the\s+date|registration\s+(?:is\s+)?open|call\s+for\s+(?:papers|applications|abstracts|proposals)|side\s+event|workshop\s+announcement)\b/i, reason: 'Event or call for participation' },
    { id: 'VACANCY', pattern: /\b(?:job\s+(?:opening|vacancy)|we(?:'re|\s+are)\s+hiring|apply\s+now|position\s+available|recruitment)\b/i, reason: 'Job posting' },
    { id: 'CORRECTION', pattern: /^\s*(?:correction|corrigendum|erratum|retraction|author\s+correction|publisher\s+correction|addendum|withdrawn)\b/i, reason: 'Correction or retraction notice' },
    { id: 'EDITORIAL_MATTER', pattern: /^\s*(?:editorial|book\s+review|news\s+in\s+brief|this\s+week\s+in|highlights?\s+of|table\s+of\s+contents|issue\s+information|cover\s+story)\b/i, reason: 'Editorial front matter' },
    // Journals tag their opinion sections in the title. An argued position is
    // not evidence, and this board's unit of intake is evidence.
    { id: 'JOURNAL_SECTION', pattern: /^\s*\[(?:comment|correspondence|editorial|perspectives?|newsdesk|obituary|world\s+report|department\s+of\s+error|book|profile|viewpoint|news)\b/i, reason: 'Journal opinion or news section, not a research finding' },
    { id: 'ANNIVERSARY', pattern: /\b(?:celebrat(?:es?|ing)|marks?\s+(?:its\s+)?\d+(?:st|nd|rd|th)\s+anniversary|\d+\s+years\s+of)\b/i, reason: 'Anniversary or celebration' },
    { id: 'FUNDING_NEWS', pattern: /\b(?:raises?|secures?|announces?)\s+(?:\$|€|£|usd|eur)\s?\d|\bfunding\s+round\b|\bseries\s+[a-d]\s+funding\b/i, reason: 'Funding announcement' },
    { id: 'PRODUCT_LAUNCH', pattern: /\b(?:launch(?:es|ed|ing)?|unveils?|introduc(?:es|ing)|now\s+available|out\s+now)\s+(?:a\s+|the\s+|its\s+|new\s+)/i, reason: 'Launch or product announcement' },
    { id: 'SOLVED', pattern: /\b(?:solv(?:es|ed)|resolves?|answers?|settles?)\s+(?:the\s+)?(?:long-standing\s+|decades-old\s+)?(?:mystery|puzzle|question|problem|debate)\b/i, reason: 'Claims the question is settled' },
    // Narrow scholarly forms. Each states an open question; none states a
    // problem the board can convene people around.
    { id: 'STUDY_PROTOCOL', pattern: /\bstudy\s+protocol\b|\bprotocol\s+for\s+(?:an?\s+)?(?:randomi|prospective|observational|cluster|pilot|feasibility|cohort)/i, reason: 'Study protocol, not a finding or a stated problem' },
    { id: 'LAB_SCOPE', pattern: /\b(?:in\s+vitro|in\s+silico|ex\s+vivo|cell\s+lines?|crystal\s+structure|druggable\s+conformation|knockout\s+mice|mouse\s+model|murine|rat\s+model|zebrafish|drosophila|c\.\s?elegans)\b/i, reason: 'Laboratory-scale study' },
    { id: 'TAXONOMIC_RECORD', pattern: /\b(?:sp\.\s?nov\.|gen\.\s?nov\.|new\s+(?:species|record|genus)|novel\s+record|first\s+record\s+of|checklist\s+of|redescription|annotated\s+list)\b/i, reason: 'Taxonomic or occurrence record' },
    { id: 'CASE_REPORT', pattern: /\bcase\s+report\b|\ba\s+case\s+of\s+[a-z]/i, reason: 'Single case report' },
    { id: 'OMICS_METHOD', pattern: /\b(?:untargeted\s+metabolomics|metabolomic|transcriptomics?|proteomics?|metagenom\w+|16s\s?rrna|rna-seq|genome\s+assembly|chloroplast\s+genome|mitochondrial\s+genome)\b/i, reason: 'Molecular methods paper' },
    { id: 'COMMUNITY_SURVEY', pattern: /\b(?:microbiomes?\s+of|(?:microbial|bacterial|fungal|viral)\s+communit(?:y|ies)|resistomes?|community\s+composition\s+of)\b/i, reason: 'Community composition survey' },
    { id: 'GENOMIC_SURVEY', pattern: /\b(?:genomic\s+(?:survey|analysis|characteri[sz]ation|epidemiology)|(?:museum|population|comparative)\s+genomics|molecular\s+characteri[sz]ation|whole[-\s]genome\s+sequencing|phylogenetic\s+analysis)\b/i, reason: 'Genomic characterisation of isolates' },
    { id: 'CLINICAL_MANAGEMENT', pattern: /\b(?:patients?\s+undergoing|undergoing\s+(?:surgery|endoscop|transplant|chemotherapy)|peri-?operative|post-?operative|efficacy\s+and\s+safety\s+of|dose[-\s]response|pharmacokinetics?|prophylaxis\s+in)\b/i, reason: 'Clinical management question for a specific procedure' },
    { id: 'STATED_PREFERENCE', pattern: /\b(?:willingness\s+to\s+pay|discrete\s+choice\s+experiment|contingent\s+valuation|knowledge,?\s+attitudes?\s+and\s+practices?)\b/i, reason: 'Stated-preference survey instrument' },
    { id: 'METHOD_PAPER', pattern: /^\s*(?:developing|development|design|designing|validation|validating|evaluation|evaluating|assessing|characteri[sz]ing|optimi[sz]ation|optimi[sz]ing|comparison|comparing)\b[^.]{0,60}\bof\b/i, reason: 'Method development or evaluation' },
  ]);

/** A magnitude makes a problem worth stating. Reused from the curation gate. */
const QUANTITY_PATTERNS: readonly RegExp[] = [
  /\d[\d.,]*\s*%/,
  /\d[\d.,]*\s*(?:percent|°c|km|ha|kwh|mwh|twh|gw|kt|mt|gt|tonnes?|eur|usd|€|\$)\b/i,
  /\b\d[\d.,]{2,}\b/,
  /\b\d[\d.,]*\s+(?:\w+\s+){0,2}(?:deaths?|people|persons?|patients?|years?|days?|million|billion|thousand|cases?|species|households?|hectares?)\b/i,
];

/** A problem applies somewhere, to someone. Generic prose usually does not. */
const SCOPE_PATTERNS: readonly RegExp[] = [
  /\b(?:in|across|throughout|within)\s+(?:the\s+)?[A-Z][a-zà-ÿ]+(?:\s+[A-Z][a-zà-ÿ]+)?\b/,
  /\b(?:global(?:ly)?|worldwide|europe(?:an)?|africa(?:n)?|asia(?:n)?|tropical|coastal|urban|rural|low-\s?and\s?middle-income)\b/i,
  ...POPULATION_PATTERNS,
];

/* ------------------------------------------------------------------ */
/* Assessment                                                          */
/* ------------------------------------------------------------------ */

export type IntakeVerdict = 'ACCEPT' | 'WEAK' | 'REJECT';

/**
 * Stable rejection codes. The human-readable reason carries the detail; the
 * code is what the run histogram counts, so a threshold number inside a
 * sentence does not fragment the tally.
 */
export type IntakeRejection =
  | 'DISQUALIFIED'
  | 'TOO_THIN'
  | 'NARROW_SUBJECT'
  | 'NO_GAP'
  | 'NO_STAKES'
  | 'DUPLICATE'
  | 'BELOW_FLOOR'
  | 'NO_SENTENCE_LEVEL_GAP';

export interface IntakeDocument {
  title: string;
  body: string;
  publisher: string;
  url: string;
  publishedAt: string | null;
}

export interface IntakeContext {
  /** Publisher reliability, from the platform's published policy. */
  reliability: Reliability;
  /** Titles already in the queue or on the board, for duplicate detection. */
  existingTitles: readonly string[];
  /** Domains the classifier assigned. An unclassifiable document is noise. */
  domains: readonly string[];
  /** Oldest publication date still considered current intake. */
  freshnessCutoff?: Date;
  now?: Date;
}

export interface IntakeAssessment {
  verdict: IntakeVerdict;
  /** 0..100. Comparable across connectors; used to order the curation queue. */
  score: number;
  /** Stable reason code on REJECT, null otherwise. */
  code: IntakeRejection | null;
  /** Signals that fired, for the curator and for tuning the filter. */
  matched: string[];
  /** Why it was downgraded or thrown out. Always populated on WEAK/REJECT. */
  reasons: string[];
  duplicateOf: DuplicateMatch | null;
  breakdown: {
    gap: number;
    stakes: number;
    quantified: boolean;
    scoped: boolean;
    substance: number;
    reliability: number;
    fresh: boolean;
  };
}

const MIN_BODY_LENGTH = 240;
const ACCEPT_THRESHOLD = 58;
const WEAK_THRESHOLD = 38;
const DEFAULT_FRESHNESS_DAYS = 400;

const RELIABILITY_POINTS: Record<Reliability, number> = {
  HIGH: 18,
  MEDIUM: 11,
  LOW: 4,
  UNKNOWN: 0,
};

export function assessIntake(document: IntakeDocument, context: IntakeContext): IntakeAssessment {
  const haystack = `${document.title}\n${document.body}`;
  const matched: string[] = [];
  const reasons: string[] = [];
  const empty = {
    gap: 0,
    stakes: 0,
    quantified: false,
    scoped: false,
    substance: 0,
    reliability: RELIABILITY_POINTS[context.reliability],
    fresh: true,
  };

  // 1. Disqualifiers first. Nothing below can rescue these.
  for (const entry of DISQUALIFYING_PATTERNS) {
    if (entry.pattern.test(document.title) || entry.pattern.test(document.body.slice(0, 600))) {
      return reject('DISQUALIFIED', entry.reason, [entry.id], empty);
    }
  }

  // 2. Substance. A headline with no body cannot state a problem.
  const bodyLength = document.body.trim().length;
  if (bodyLength < MIN_BODY_LENGTH) {
    return reject(
      'TOO_THIN',
      `Too thin to assess: ${bodyLength} characters of text (minimum ${MIN_BODY_LENGTH})`,
      matched,
      { ...empty, substance: bodyLength },
    );
  }

  // 3. The title test. The board's unit is a societal problem, so the title has
  // to name either what is at stake or who it happens to. A title that names
  // only a technique, a molecule or a specimen belongs in a journal, not here.
  const titleStakes = STAKES_PATTERNS.some((entry) => entry.pattern.test(document.title));
  const titlePopulation = POPULATION_PATTERNS.some((pattern) => pattern.test(document.title));
  if (!titleStakes && !titlePopulation) {
    return reject(
      'NARROW_SUBJECT',
      'The title names neither a consequence nor a population. This is a research topic, not a problem for this board.',
      matched,
      { ...empty, substance: bodyLength },
    );
  }

  // 4. Classification. If no domain fits, this is not a problem for this board.
  const meaningfulDomains = context.domains.filter((domain) => domain !== 'other');
  if (meaningfulDomains.length === 0) {
    reasons.push('No research domain could be assigned with confidence');
  }

  // 5. Freshness.
  const now = context.now ?? new Date();
  const cutoff =
    context.freshnessCutoff ?? new Date(now.getTime() - DEFAULT_FRESHNESS_DAYS * 24 * 60 * 60 * 1000);
  const publishedAt = parseDate(document.publishedAt);
  const fresh = publishedAt === null || publishedAt >= cutoff;
  if (!fresh) reasons.push(`Published ${document.publishedAt}, older than the intake window`);

  // 6. The core signal: does anything here say something is unresolved?
  let gap = 0;
  for (const entry of GAP_PATTERNS) {
    if (entry.pattern.test(haystack)) {
      matched.push(entry.id);
      gap += entry.weight;
    }
  }

  // 7. And does anything ride on it?
  let stakes = 0;
  for (const entry of STAKES_PATTERNS) {
    if (entry.pattern.test(haystack)) {
      matched.push(entry.id);
      stakes += entry.weight;
    }
  }

  const quantified = QUANTITY_PATTERNS.some((pattern) => pattern.test(haystack));
  const scoped = SCOPE_PATTERNS.some((pattern) => pattern.test(haystack));
  const duplicateOf = findNearDuplicate(document.title, context.existingTitles);

  const breakdown = {
    gap,
    stakes,
    quantified,
    scoped,
    substance: bodyLength,
    reliability: RELIABILITY_POINTS[context.reliability],
    fresh,
  };

  if (duplicateOf) {
    return {
      verdict: 'REJECT',
      score: 0,
      code: 'DUPLICATE',
      matched,
      reasons: [
        `Near-duplicate of "${duplicateOf.candidate}" (${Math.round(duplicateOf.similarity * 100)}% title overlap)`,
      ],
      duplicateOf,
      breakdown,
    };
  }

  if (gap === 0) {
    return {
      verdict: 'REJECT',
      score: 0,
      code: 'NO_GAP',
      matched,
      reasons: [
        'Nothing in the text says anything is unresolved. A finished result is not a problem.',
      ],
      duplicateOf: null,
      breakdown,
    };
  }

  if (stakes === 0) {
    return {
      verdict: 'REJECT',
      score: 0,
      code: 'NO_STAKES',
      matched,
      reasons: [
        'An open question with nothing riding on it. The text names no harm, loss, scarcity or exposure.',
      ],
      duplicateOf: null,
      breakdown,
    };
  }

  // 8. Score. Gap and stakes carry it; the rest modulates.
  const score = Math.min(
    100,
    Math.round(
      Math.min(34, gap * 7) +
        Math.min(26, stakes * 5) +
        (quantified ? 12 : 0) +
        (scoped ? 6 : 0) +
        Math.min(6, (bodyLength - MIN_BODY_LENGTH) / 160) +
        RELIABILITY_POINTS[context.reliability] * (meaningfulDomains.length > 0 ? 1 : 0.4) +
        (fresh ? 0 : -15),
    ),
  );

  if (score < WEAK_THRESHOLD) {
    reasons.push(`Relevance score ${score} is below the intake floor of ${WEAK_THRESHOLD}`);
    return { verdict: 'REJECT', score, code: 'BELOW_FLOOR', matched, reasons, duplicateOf: null, breakdown };
  }

  if (score < ACCEPT_THRESHOLD || meaningfulDomains.length === 0) {
    reasons.push(
      `Below the accept threshold of ${ACCEPT_THRESHOLD}: recorded for tuning, not queued for curation.`,
    );
    return { verdict: 'WEAK', score, code: null, matched, reasons, duplicateOf: null, breakdown };
  }

  return { verdict: 'ACCEPT', score, code: null, matched, reasons, duplicateOf: null, breakdown };
}

function reject(
  code: IntakeRejection,
  reason: string,
  matched: string[],
  breakdown: IntakeAssessment['breakdown'],
): IntakeAssessment {
  return {
    verdict: 'REJECT',
    score: 0,
    code,
    matched,
    reasons: [reason],
    duplicateOf: null,
    breakdown,
  };
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export const INTAKE_THRESHOLDS = Object.freeze({
  accept: ACCEPT_THRESHOLD,
  weak: WEAK_THRESHOLD,
  minBodyLength: MIN_BODY_LENGTH,
});
