import type { DomainKey } from '@saveus/common';
import type { LessonBlock } from '../schema.js';

/**
 * The courses.
 *
 * Written to one rule, which is the platform's own: a lesson makes no factual
 * claim it cannot attribute. Every STATEMENT block carries the kind of claim it
 * is and the source key it comes from, drawn from the same library the problems
 * cite. PROSE blocks explain and frame; they assert nothing that would need a
 * citation. Where the honest answer is that nobody knows, the block says
 * UNKNOWN, because a course that hides the open questions teaches the opposite
 * of what this place is for.
 *
 * The second rule is that every course ends by pointing at real problems on the
 * board. Somebody who finishes a track should not be left with facts; they
 * should be left with somewhere to put them.
 */

export interface SeedQuestion {
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface SeedLesson {
  slug: string;
  title: string;
  hook: string;
  minutes: number;
  blocks: LessonBlock[];
  problemRefs: string[];
  questions: SeedQuestion[];
}

export interface SeedCourse {
  slug: string;
  title: string;
  summary: string;
  outcome: string;
  track: 'METHOD' | 'SYSTEMS';
  domainKey: DomainKey | null;
  /** Derived from the lessons - see SEED_COURSES. Never written by hand. */
  estimatedMinutes: number;
  lessons: SeedLesson[];
}

/** A course as it is written below: everything except the derived total. */
type CourseDefinition = Omit<SeedCourse, 'estimatedMinutes'>;

const prose = (text: string): LessonBlock => ({ kind: 'PROSE', text });

const claim = (text: string, sourceKeys: string[]): LessonBlock => ({
  kind: 'STATEMENT',
  text,
  epistemicKind: 'SOURCE_CLAIM',
  sourceKeys,
});

const unknown = (text: string): LessonBlock => ({
  kind: 'STATEMENT',
  text,
  epistemicKind: 'UNKNOWN',
  sourceKeys: [],
});

const inference = (text: string, sourceKeys: string[] = []): LessonBlock => ({
  kind: 'STATEMENT',
  text,
  epistemicKind: 'INFERENCE',
  sourceKeys,
});

const callout = (title: string, text: string): LessonBlock => ({ kind: 'CALLOUT', title, text });

const compare = (
  caption: string,
  wrong: { label: string; text: string },
  right: { label: string; text: string },
): LessonBlock => ({ kind: 'COMPARE', caption, wrong, right });

const checklist = (title: string, items: string[]): LessonBlock => ({
  kind: 'CHECKLIST',
  title,
  items,
});

/* ------------------------------------------------------------------ */
/* Track 1: how to work here                                           */
/* ------------------------------------------------------------------ */

const METHOD: CourseDefinition[] = [
  {
    slug: 'what-counts-as-a-problem',
    title: 'What counts as a problem',
    summary:
      'The difference between a topic everybody agrees is bad and a problem somebody could actually work on.',
    outcome: 'You can tell whether something on this board is stated well enough to attack.',
    track: 'METHOD',
    domainKey: null,
    lessons: [
      {
        slug: 'a-topic-is-not-a-problem',
        title: 'A topic is not a problem',
        hook: '"Climate change" is a subject. It is not something anybody can be wrong about.',
        minutes: 4,
        blocks: [
          prose(
            'Most public conversation about difficult subjects never gets past naming them. "Plastic pollution", "antibiotic resistance", "urban heat" — everyone agrees these are bad, and agreeing is where it stops. Nothing follows from agreement, because a subject has no shape: there is nothing in it to be right or wrong about, and therefore nothing to work on.',
          ),
          prose(
            'A problem has edges. It says what is happening, to whom, how much of it there is, what would count as solving it, and what you are not allowed to do on the way. Those five things are what turn a subject into something a stranger can pick up and argue with.',
          ),
          compare(
            'The same subject, twice',
            {
              label: 'A topic',
              text: 'Cities are getting dangerously hot and we need to do something about it.',
            },
            {
              label: 'A problem',
              text: 'Reduce heat-related deaths in Paris within three to five summers, without replacing the existing housing stock, under a municipal adaptation budget — measured against city mortality registries.',
            },
          ),
          prose(
            'The second version can be attacked. You can say the budget is wrong, that three summers is impossible, that mortality registries lag too much to measure anything, or that the housing constraint makes it unsolvable. Every one of those is a contribution. The first version can only be agreed with.',
          ),
          claim(
            'The World Health Organization documents heat as a direct cause of excess mortality, with older adults, people with chronic conditions and socially isolated people at elevated risk, and the exposure concentrated in dense urban areas.',
            ['who-heat-health'],
          ),
          unknown(
            "How much of a given city's heat mortality is attributable specifically to dwelling type — top floor, uninsulated, single-aspect — rather than to age and isolation, is not separated in the record.",
          ),
          callout(
            'Why the unknown is written down',
            'That last line is not a gap in the lesson. It is a gap in what anybody knows, and stating it is how somebody finds out this is a place they could contribute. A course that only lists settled facts tells you nothing about where the work is.',
          ),
        ],
        problemRefs: ['004821'],
        questions: [
          {
            prompt: 'Which of these is stated well enough to be argued with?',
            options: [
              'We must urgently address the biodiversity crisis.',
              'Establish whether terrestrial insect abundance is declining globally, and what would reverse it.',
              'Insects matter more than people realise.',
              'Biodiversity loss is accelerating worldwide.',
            ],
            correctIndex: 1,
            explanation:
              'Only the second names a question with a determinate answer. Someone can show the trend is regional rather than global, or that the monitoring cannot support either conclusion — and both would be real contributions. The others invite agreement, which is not work.',
          },
          {
            prompt: 'A problem statement on this board includes constraints. What are they for?',
            options: [
              'To make the problem look harder than it is.',
              'To rule out solutions that ignore reality — budget, time, geography, what you may not change.',
              'To limit who is allowed to propose a solution.',
              'To make the problem easier to score.',
            ],
            correctIndex: 1,
            explanation:
              'Constraints are what stop a proposal being "just rebuild the city". A solution that violates the stated budget or the stated time horizon is not a solution to this problem, and saying so up front saves everybody the argument.',
          },
        ],
      },
      {
        slug: 'six-kinds-of-statement',
        title: 'Six kinds of statement',
        hook: "A measured fact and somebody's guess should never look alike on a screen.",
        minutes: 5,
        blocks: [
          prose(
            'This is the rule the whole platform is built on, and the one thing worth taking away even if you read nothing else. Every claim here is labelled with what kind of claim it is. Not whether it is true — whether it is the sort of thing that could be checked, and how.',
          ),
          prose(
            "Six kinds. A FACT is measured or officially recorded, and it carries a source or it is not a fact. A SOURCE CLAIM is something a named publication asserts — attributed to them, not endorsed by us. A HUMAN HYPOTHESIS is a person's proposal, argued rather than asserted. An AI HYPOTHESIS is a machine's proposal, marked as such always. An INFERENCE is derived from other statements on the page, and the derivation is shown. An UNKNOWN is an admitted gap.",
          ),
          callout(
            'The load-bearing part',
            "They are different colours and different shapes on screen, on purpose. You should be able to tell what you are reading before you have read it. Most of the internet fails at exactly this: a model's guess and a measured quantity are rendered in the same font.",
          ),
          claim(
            'The Global Carbon Project publishes an annual budget of anthropogenic carbon emissions and sinks, assembled from multiple independent estimates.',
            ['global-carbon-budget'],
          ),
          prose('That is a SOURCE CLAIM: a named publication says it, and you can go and check.'),
          inference(
            'Because the budget is assembled from independent estimates rather than a single measurement, disagreement between those estimates is information about uncertainty rather than a flaw to be averaged away.',
            ['global-carbon-budget'],
          ),
          prose(
            'That is an INFERENCE: it follows from the statement above, but no publication says it in those words, so it is not dressed up as one.',
          ),
          unknown(
            "Whether the platform's own labelling makes readers better at judging evidence, or merely makes them feel better, has not been tested.",
          ),
          prose(
            'And that is an UNKNOWN. It would be easy to leave it out. Leaving it out would be the beginning of the thing this product exists to avoid.',
          ),
        ],
        problemRefs: ['004831'],
        questions: [
          {
            prompt:
              'A statement reads: "Night ventilation is the cheapest available intervention." It carries no source. What should it be labelled?',
            options: [
              'FACT — it is obviously true',
              'SOURCE CLAIM — someone must have published it',
              'HUMAN HYPOTHESIS or UNKNOWN — it is a proposal until something backs it',
              'INFERENCE — it can be worked out',
            ],
            correctIndex: 2,
            explanation:
              "Without a source it cannot be a FACT or a SOURCE CLAIM — the platform degrades both to UNKNOWN automatically when the citation is missing. As a person's argued proposal it is a HUMAN HYPOTHESIS, which is a perfectly respectable thing to be.",
          },
          {
            prompt:
              'Why is AI HYPOTHESIS a separate kind rather than being folded into HUMAN HYPOTHESIS?',
            options: [
              'Because machine proposals are worth less.',
              'Because a reader deciding how much to check something needs to know where it came from.',
              'Because the law requires it.',
              'Because machines make more mistakes.',
            ],
            correctIndex: 1,
            explanation:
              'It is not a ranking. A machine proposal can be excellent and a human one can be careless. But they fail differently — a model will produce a fluent, plausible, entirely invented citation in a way a person usually will not — so a reader deciding where to spend their scepticism needs to know which they are looking at.',
          },
        ],
      },
      {
        slug: 'a-hypothesis-you-can-attack',
        title: 'A hypothesis you can attack',
        hook: 'If nobody can tell you what would prove you wrong, you have not proposed anything.',
        minutes: 4,
        blocks: [
          prose(
            'A hypothesis here is not a comment. It is a structured object with required parts, and the parts are required because each one is something a reader needs in order to attack the idea properly.',
          ),
          checklist('What a hypothesis has to declare', [
            'The claim — precise enough to be wrong.',
            'The mechanism — how the effect happens, step by step.',
            'The expected impact — what changes, and roughly by how much.',
            'The required assumptions — what has to be true for it to work.',
            'The unknowns — what the author could not check.',
            'The risks — how it fails, and who it fails on.',
            'The validation method — what would settle it.',
          ]),
          prose(
            'The assumptions list is the interesting one. Most bad proposals are not wrong in their conclusion; they are resting on one unstated assumption doing all the work. Writing them down is how you find that out before somebody else does.',
          ),
          compare(
            'The same idea, twice',
            {
              label: 'Not attackable',
              text: 'We should use night ventilation to cool buildings during heatwaves. It is cheap and effective.',
            },
            {
              label: 'Attackable',
              text: 'Night ventilation reduces indoor peak temperature at near-zero capital cost, assuming outdoor night temperature drops far enough below indoor, residents can physically open shutters twice daily, and security concerns do not prevent opening windows overnight.',
            },
          ),
          prose(
            'The second version hands you three places to aim at. If night temperatures in that city no longer drop far enough, the whole thing collapses — and now that is a checkable question rather than a vague doubt.',
          ),
          callout(
            'Attack the idea, never the person',
            'This is enforced socially and reflected in how contributions are scored. A counterargument that names a failing assumption is the most valuable thing you can post here. A counterargument that names a failing in the author is worth nothing and will be treated as such.',
          ),
        ],
        problemRefs: ['004821', '004834'],
        questions: [
          {
            prompt: 'Which counterargument is worth the most here?',
            options: [
              'This author clearly does not understand building physics.',
              'I disagree, this will not work.',
              'The first assumption carries no source and does all the work: if night temperatures no longer drop far enough in this city, the expected impact collapses without the mechanism being wrong anywhere else.',
              'This has been tried before and failed.',
            ],
            correctIndex: 2,
            explanation:
              'It names a specific assumption, explains why it is load-bearing, and states what would follow if it fails — while being careful to say the mechanism itself may be fine. That is a contribution somebody can act on. The last option might be true but gives nobody anything to check.',
          },
        ],
      },
      {
        slug: 'what-earns-standing',
        title: 'What earns standing',
        hook: 'Nobody here can mark their own work as validated. Not even the machines.',
        minutes: 4,
        blocks: [
          prose(
            'Reputation on this platform is research reputation. It is not points for showing up, and it is deliberately hard to farm.',
          ),
          checklist('What a contribution is scored on', [
            'Relevance — does it bear on the actual question.',
            'Novelty — has this already been said on this page.',
            'Evidence quality — what is behind it.',
            'Reproducibility — could somebody else check it.',
            'Community validation — did others find it useful.',
            'Downstream impact — did the work change because of it.',
          ]),
          prose(
            "Two rules matter more than the weights. The first: posting more does not earn more. A contribution's award is damped by how much the same author has already posted on the same problem, so twenty shallow comments are worth less than one good objection — by construction, not by moderation.",
          ),
          prose(
            'The second: nobody validates their own work. The statuses that mean "this holds up" cannot be set by an author, and cannot be set by the system either. They require a recorded validation against explicit criteria, by somebody else. The agents cannot do it. That is not a limitation of the current version; it is the point.',
          ),
          callout(
            'An anonymous account is worth exactly as much',
            'There are no passwords here, and registering anonymously is a first-class option. What the platform needs is a stable author for a contribution, not proof of who you are. An anonymous account with good evidence outranks a credentialed one without.',
          ),
          unknown(
            'Whether this scoring actually selects for good research over time, or merely for people who write in the style it rewards, is an open question about the platform itself.',
          ),
        ],
        problemRefs: [],
        questions: [
          {
            prompt:
              'You have found a paper that contradicts a popular hypothesis on the board. What is the highest-value thing to do?',
            options: [
              'Post twenty comments so more people see it.',
              'Attach it as contradicting evidence, with what the source actually establishes.',
              'Wait for somebody more qualified to do it.',
              'Mark the hypothesis as refuted.',
            ],
            correctIndex: 1,
            explanation:
              'Attaching contradicting evidence is among the most valuable actions here, and volume damping makes the first option actively counterproductive. You cannot mark anything refuted yourself — that requires a recorded validation by someone else. And there is no "more qualified": the evidence is the qualification.',
          },
        ],
      },
    ],
  },
  {
    slug: 'reading-evidence',
    title: 'Reading evidence',
    summary:
      'Where a number came from, why two reliable sources disagree, and when the right answer is that nobody knows.',
    outcome: 'You can judge a source instead of counting sources.',
    track: 'METHOD',
    domainKey: null,
    lessons: [
      {
        slug: 'where-a-number-comes-from',
        title: 'Where a number comes from',
        hook: 'Every figure you have ever read was produced by a method, and the method is the number.',
        minutes: 4,
        blocks: [
          prose(
            'When you meet a quantity — deaths, tonnes, degrees, percent — the useful question is almost never "is it true". It is "how was it arrived at, and what would change it".',
          ),
          prose(
            'Three broad kinds, and they behave very differently. A measurement comes from an instrument: a thermometer, a satellite, a meter. A count comes from a register: deaths recorded, vehicles sold, cases reported. A model output comes from assumptions run forward, and is only as good as its assumptions.',
          ),
          claim(
            'NASA maintains a global surface temperature analysis assembled from instrumental station and ocean records.',
            ['nasa-gistemp'],
          ),
          claim(
            'The IPCC Sixth Assessment Report synthesises the physical science basis of climate change across the published literature.',
            ['ipcc-ar6-wg1'],
          ),
          prose(
            'The first is closer to a measurement, the second is a synthesis of thousands of them. Neither is "the truth" in a way that makes the other redundant — they answer different questions, and treating them as interchangeable is how people end up arguing past each other.',
          ),
          callout(
            'Counts are not neutral',
            'A count reflects what somebody chose to record. Road deaths counted at the scene and road deaths counted thirty days later are different numbers about the same events. Disease cases depend on who was tested. This is not a conspiracy; it is what counting is.',
          ),
          claim(
            'The World Health Organization publishes global road traffic injury statistics, and notes that low- and middle-income countries carry a disproportionate share of deaths relative to their share of vehicles.',
            ['who-road-traffic'],
          ),
        ],
        problemRefs: ['004839'],
        questions: [
          {
            prompt:
              'A report states that a policy will avoid 40 000 deaths by 2040. What kind of number is that?',
            options: [
              'A measurement — it was observed.',
              'A count — somebody recorded it.',
              'A model output — assumptions run forward, and only as good as them.',
              'A fact, since it is in a published report.',
            ],
            correctIndex: 2,
            explanation:
              'Nothing in 2040 has been measured or counted yet. It is a projection, which makes the assumptions behind it the thing worth reading. That does not make it worthless — projections are how decisions get made — but it makes "what would change this" the right question.',
          },
        ],
      },
      {
        slug: 'sources-are-not-equal',
        title: 'Sources are not equal, and neither is disagreement',
        hook: 'Two careful sources disagreeing is information. Two careless ones agreeing is not.',
        minutes: 4,
        blocks: [
          prose(
            'This platform grades every source it stores: HIGH, MEDIUM, LOW or UNKNOWN. The grade is about the publisher and the kind of document, not about whether we like the conclusion. An intergovernmental assessment and a specialist analysis desk are both useful and are not the same thing.',
          ),
          checklist('What raises a source in practice', [
            'It says how it got its numbers.',
            'It states its own uncertainty.',
            'It can be checked — the data or method is available.',
            'It has been through review by people positioned to catch errors.',
            'It says what it does not cover.',
          ]),
          prose(
            'Counting sources is the common mistake. Ten articles reporting one press release are one source. This is why the platform stores a canonical URL and a content hash for everything: the same document arriving by three routes collapses into one record, on purpose.',
          ),
          callout(
            'When good sources disagree',
            'Disagreement between careful sources usually means they measured different things, covered different periods, or made different assumptions. The productive move is to find which — not to average them, and not to pick the one you prefer.',
          ),
          claim(
            'Analysis published in Geophysical Research Letters evaluated how well past climate model projections matched subsequently observed warming.',
            ['hausfather-projections'],
          ),
          prose(
            'That is the honest way to treat a disagreement about models: go back and check which ones tracked reality. It is also, not coincidentally, one of the problems on this board.',
          ),
        ],
        problemRefs: ['004841'],
        questions: [
          {
            prompt:
              'You find fifteen news articles making the same claim, and one peer-reviewed paper contradicting it. What have you found?',
            options: [
              'Fifteen sources against one — the claim is probably right.',
              'Possibly one source against one, if the articles all trace to the same release.',
              'A conspiracy.',
              'Nothing useful either way.',
            ],
            correctIndex: 1,
            explanation:
              'Follow the articles back. If they all cite the same press release or the same study, they are one source repeated, not fifteen. This is why the platform deduplicates by canonical URL and content hash rather than counting mentions.',
          },
        ],
      },
      {
        slug: 'saying-unknown',
        title: 'Saying UNKNOWN',
        hook: 'The hardest sentence to write is "nobody knows this yet".',
        minutes: 3,
        blocks: [
          prose(
            'Most writing about difficult subjects is fluent in a way the underlying evidence is not. Gaps get smoothed over, because a paragraph with a hole in it reads as weak writing rather than as honest reporting.',
          ),
          prose(
            'Here, the gap is the point. UNKNOWN is a first-class label, it renders differently from everything else, and a problem with well-stated open questions is more valuable than one that pretends to be settled — because the open questions are where somebody can start.',
          ),
          claim(
            'IPBES assesses invasive alien species and the measures used to control them, and reports that the evidence base for cost-effectiveness is uneven across regions.',
            ['ipbes-invasive'],
          ),
          unknown(
            'Whether early detection and rapid response outperforms long-run containment in a given region is not settled, and the island and mainland evidence bases are not comparable.',
          ),
          callout(
            'This is the differentiator',
            'A language model will fill that gap with a confident sentence if you let it. Every agent on this platform is instructed that UNKNOWN is a valid and valued answer, its citations are checked against a fixed list, and anything it cites outside that list is stripped and counted against the run.',
          ),
          prose(
            'If you take one habit from this course: when you do not know, write that you do not know, and say what would settle it. It is worth more than a confident guess, and it is the thing almost nobody does.',
          ),
        ],
        problemRefs: ['004827'],
        questions: [
          {
            prompt: 'Why does this platform treat "UNKNOWN" as valuable rather than as a failure?',
            options: [
              'To lower expectations of contributors.',
              'Because a stated gap is where somebody can start work, and a hidden gap is where everybody wastes it.',
              'Because the data is incomplete.',
              'To avoid legal liability.',
            ],
            correctIndex: 1,
            explanation:
              'An admitted gap is actionable: it tells a reader precisely where the work is. A gap smoothed over with confident prose sends people past it. That is the difference between a research record and a magazine article.',
          },
        ],
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Track 2: the systems the problems live in                           */
/* ------------------------------------------------------------------ */

const SYSTEMS: CourseDefinition[] = [
  {
    slug: 'climate-and-energy',
    title: 'Climate and energy systems',
    summary:
      'Why a renewable grid is a storage problem, why some emissions are much harder than others, and what a carbon budget actually is.',
    outcome: 'You can read the energy problems on this board without needing the jargon explained.',
    track: 'SYSTEMS',
    domainKey: 'energy',
    lessons: [
      {
        slug: 'the-carbon-budget',
        title: 'What a carbon budget is, and is not',
        hook: "Warming tracks the total ever emitted, not this year's rate. That one fact reorganises everything.",
        minutes: 5,
        blocks: [
          prose(
            'The single most useful idea in climate science for a newcomer is that the warming we get is governed roughly by the cumulative total of carbon dioxide emitted, not by the rate in any one year. Carbon dioxide stays in the system for a very long time.',
          ),
          claim(
            'The IPCC Sixth Assessment Report Working Group I sets out the physical science basis, including the relationship between cumulative carbon emissions and global surface warming.',
            ['ipcc-ar6-wg1'],
          ),
          claim(
            'The Global Carbon Project publishes an annual accounting of anthropogenic carbon emissions and the land and ocean sinks that absorb part of them.',
            ['global-carbon-budget'],
          ),
          prose(
            'Two consequences follow, and both are counter-intuitive. First: an emissions cut delayed by ten years is not the same cut. The total is what counts, so the delay itself is permanent even if the eventual rate is identical. Second: "net zero" is not an arbitrary slogan — it is the condition under which the total stops growing, which is the condition under which warming stops.',
          ),
          inference(
            'Because the total is what matters, arguments about which country or sector should cut first are arguments about fairness and feasibility, not about physics. The physics is indifferent to whose tonne it is.',
            ['ipcc-ar6-wg1'],
          ),
          callout(
            'What this does not tell you',
            'A budget says nothing about how to spend it. Every hard question — who cuts, how fast, at what cost, with what technology — sits downstream of this and is not settled by it. That is where the problems on this board live.',
          ),
        ],
        problemRefs: ['004836', '004841'],
        questions: [
          {
            prompt: 'Why is a delayed emissions cut not equivalent to the same cut made earlier?',
            options: [
              'Because technology gets more expensive over time.',
              'Because warming tracks the cumulative total emitted, so the extra years of emissions are permanently added.',
              'Because political will decreases.',
              'It is equivalent, as long as the end point is the same.',
            ],
            correctIndex: 1,
            explanation:
              'The total is the governing quantity. Emissions during the delay are added to it and do not come back out on any timescale that matters, so the same end-state rate arrives with a larger total behind it.',
          },
        ],
      },
      {
        slug: 'a-grid-is-a-storage-problem',
        title: 'A renewable grid is a storage problem',
        hook: 'The hard part is not the average. It is the week when the wind does not blow.',
        minutes: 5,
        blocks: [
          prose(
            'Electricity has an unusual property: supply and demand must match continuously, second by second. There is no warehouse in the system by default. Every grid ever built solved this by keeping controllable generators — coal, gas, hydro, nuclear — ready to follow demand.',
          ),
          prose(
            'Wind and solar are not controllable in that way. Their cost has fallen dramatically, which solves the easy problem: producing enough energy on average. It does not solve the hard one: producing it at the moment it is needed.',
          ),
          claim(
            'The International Energy Agency analyses the role of electricity grids in secure energy transitions, including grid investment, connection queues for renewable projects, and the ageing of existing transmission and distribution infrastructure.',
            ['iea-grids'],
          ),
          claim(
            'The IEA publishes analysis of renewable energy deployment and of electricity system trends.',
            ['iea-renewables', 'iea-electricity'],
          ),
          prose(
            'The awkward case is not a windless night — batteries handle hours comfortably. It is a multi-day, continent-scale period of low wind and low sun in winter, when demand is highest. Storage that is cheap per unit of power is not necessarily cheap per unit of energy held for five days, and those are different engineering problems with different answers.',
          ),
          unknown(
            'Which combination of long-duration storage, overbuilt generation, interconnection and demand flexibility is cheapest for a specific system is contested, and the answer depends on assumptions about weather years that are only a few decades deep.',
          ),
          callout(
            'Where to aim',
            'If you want to argue about grids productively, argue about the multi-day gap. Most disagreements that look like "renewables work / do not work" turn out to be disagreements about how to cover that week.',
          ),
        ],
        problemRefs: ['004822', '004840'],
        questions: [
          {
            prompt: 'What makes a multi-day low-wind, low-sun period harder than a single night?',
            options: [
              'It is colder.',
              'Storage cheap enough for hours is not automatically cheap enough to hold days of energy.',
              'The sun produces no power at night.',
              'Demand is lower.',
            ],
            correctIndex: 1,
            explanation:
              'Cost per unit of power delivered and cost per unit of energy stored are different quantities. A technology optimised for the first is not necessarily viable for the second, which is why long-duration storage is its own field rather than a bigger version of a battery.',
          },
        ],
      },
      {
        slug: 'the-hard-third',
        title: 'The part that is genuinely hard',
        hook: 'Some emissions come from chemistry, not from burning fuel. You cannot electrify chemistry.',
        minutes: 4,
        blocks: [
          prose(
            'Electricity and light road transport have a clear path: make the electricity clean, then electrify. A large fraction of emissions has no such path, and lumping it in with the rest is how people end up baffled by why this is taking so long.',
          ),
          prose(
            'Cement is the clearest example. Making clinker releases carbon dioxide from the limestone itself as a chemical reaction, before any fuel is burned. A perfectly clean kiln still emits. That is a different problem from a dirty kiln.',
          ),
          claim(
            'The IEA publishes analysis of the cement sector and its emissions, and the Global Cement and Concrete Association has published an industry roadmap towards net zero concrete.',
            ['iea-cement', 'gcca-concrete-future'],
          ),
          claim(
            'The IEA analyses the iron and steel sector, including low-emissions production routes, and separately analyses hydrogen and carbon capture, utilisation and storage.',
            ['iea-steel', 'iea-hydrogen', 'iea-ccus'],
          ),
          prose(
            "Steel, long-haul shipping and aviation share the awkward shape: the physics or chemistry resists the obvious substitution, and the alternatives are expensive in ways that do not obviously fall with scale. These are the sectors where the interesting arguments are, and where several of this board's problems sit.",
          ),
          unknown(
            'Whether hydrogen-based primary steel can reach cost parity without permanent subsidy, and on what timescale, is not established.',
          ),
        ],
        problemRefs: ['004823', '004828', '004829', '004830'],
        questions: [
          {
            prompt:
              'Why is cement described as harder to decarbonise than, say, a coal power station?',
            options: [
              'Cement plants are older.',
              'A large part of the emissions comes from the chemical reaction making clinker, not from the fuel burned.',
              'Cement is used in larger quantities.',
              'There is no alternative to concrete.',
            ],
            correctIndex: 1,
            explanation:
              "Replacing the fuel does not remove process emissions, because those come from the limestone itself. That is why the sector's roadmaps involve capture, alternative chemistries or reduced clinker content rather than simply cleaner heat.",
          },
        ],
      },
    ],
  },
  {
    slug: 'cities-heat-and-water',
    title: 'Cities, heat and water',
    summary:
      'Why heat kills at night, why a city runs on water nobody can see, and why the existing buildings are the constraint.',
    outcome:
      'You can read the urban problems and see why the obvious answers are already ruled out.',
    track: 'SYSTEMS',
    domainKey: 'cities',
    lessons: [
      {
        slug: 'why-heat-kills-at-night',
        title: 'Why heat kills at night',
        hook: 'The dangerous part of a heatwave is the hours when it is supposed to cool down and does not.',
        minutes: 4,
        blocks: [
          prose(
            'The intuitive picture of heat danger is midday sun. The actual mechanism is closer to the opposite: the body tolerates a hot day considerably better if it can recover overnight. When night temperatures stay high, recovery does not happen, and the physiological strain accumulates across days.',
          ),
          claim(
            'The World Health Organization describes the physiological mechanisms of heat-related illness, the populations at elevated risk, and the components of a heat-health action plan.',
            ['who-heat-health'],
          ),
          claim(
            'Dense built-up areas retain heat released overnight, a pattern documented as the urban heat island effect.',
            ['lbnl-heat-island'],
          ),
          prose(
            'This is why cooling centres that close in the evening address the wrong hours, and why the building matters more than the weather station. A top-floor, uninsulated, single-aspect flat can stay above the outdoor temperature all night. The person inside experiences a different heatwave from the one the city measured.',
          ),
          claim(
            'Santé publique France operates surveillance and prevention programmes for heat, and the European Environment Agency maintains the Climate-ADAPT platform documenting adaptation measures.',
            ['santepublique-france', 'climate-adapt'],
          ),
          unknown(
            "How much of a given city's heat mortality is attributable to dwelling typology specifically, separated from age and social isolation, is not resolved in the record.",
          ),
        ],
        problemRefs: ['004821', '004834'],
        questions: [
          {
            prompt: 'Why does the night matter more than the afternoon?',
            options: [
              'It is darker.',
              'Without overnight recovery the physiological strain accumulates across days.',
              'Most people are asleep and cannot react.',
              'Air quality is worse at night.',
            ],
            correctIndex: 1,
            explanation:
              'Recovery is the mechanism. A hot day followed by a cool night is survivable in a way that a hot day followed by a hot night is not, and dense urban fabric is precisely what prevents the second half.',
          },
        ],
      },
      {
        slug: 'water-you-cannot-see',
        title: 'A city runs on water nobody can see',
        hook: 'Take out enough groundwater and the ground itself comes down. It does not go back up.',
        minutes: 4,
        blocks: [
          prose(
            "Surface water is visible and therefore argued about. A great deal of the world's water use is groundwater, which is invisible, slow to respond, and easy to overdraw for decades before anything obvious happens.",
          ),
          claim(
            'The FAO maintains AQUASTAT, a global information system on water and agriculture, and the World Resources Institute publishes basin-level water stress indicators through Aqueduct.',
            ['fao-aquastat', 'wri-aqueduct'],
          ),
          claim(
            'The United States Geological Survey publishes water resource data including groundwater monitoring.',
            ['usgs-water'],
          ),
          prose(
            'When an aquifer beneath a city is depleted, the sediments compact and the surface subsides. The crucial property is that this is largely irreversible: refilling the aquifer does not lift the ground back. A coastal city that subsides is effectively raising sea level against itself, faster than the ocean is doing it.',
          ),
          inference(
            'Because subsidence is irreversible and depletion is gradual, the moment when action is cheapest is long before the damage is visible — which is exactly the moment at which it is hardest to justify spending.',
            ['usgs-water'],
          ),
          callout(
            'The shape of the trap',
            'This pattern recurs across this board: a slow, invisible, irreversible process where the cheap intervention is early and the political pressure arrives late. Recognising the shape is useful well beyond water.',
          ),
        ],
        problemRefs: ['004825', '004832'],
        questions: [
          {
            prompt:
              'Why is groundwater-driven land subsidence especially serious in coastal cities?',
            options: [
              'Salt water damages the aquifer.',
              'The city sinks relative to the sea, and refilling the aquifer does not lift it back.',
              'Coastal soils are softer.',
              'It contaminates drinking water.',
            ],
            correctIndex: 1,
            explanation:
              'Compaction is largely irreversible, so the subsidence is permanent. For a coastal city that adds to relative sea level rise, often faster than the ocean component.',
          },
        ],
      },
      {
        slug: 'retrofit-is-the-constraint',
        title: 'The buildings already exist',
        hook: 'Most of the buildings that will exist in 2050 are standing today. That is the whole constraint.',
        minutes: 4,
        blocks: [
          prose(
            'Almost every proposal about cities founders on the same rock: you do not get to design the city. It is already there, people live in it, they cannot move out while you work, and a large share of it is protected, privately owned, or both.',
          ),
          claim(
            'The IEA analyses the buildings sector and energy efficiency, including the role of the existing stock.',
            ['iea-buildings', 'iea-efficiency'],
          ),
          claim('UN-Habitat publishes the World Cities Report on urbanisation and urban policy.', [
            'un-habitat-wcr',
          ]),
          prose(
            'This turns elegant solutions into unusable ones. A measure that requires vacating a flat, or altering a protected facade, or getting a majority of co-owners to agree, is not cheaper than doing nothing — it is often impossible at any price. That is why this board\'s urban problems carry constraints like "without replacing the existing housing stock" and "must work on occupied buildings".',
          ),
          checklist('Questions worth asking about any urban proposal', [
            'Can it be done while people are living there?',
            'Does it require changing the outside of a protected building?',
            'Who has to agree, and how many of them are there?',
            'Does it survive a landlord with no incentive to pay?',
            'Does it work on the worst-performing tenth, or only the average?',
          ]),
          unknown(
            'Which retrofit measures deliver the largest reduction in indoor peak temperature per unit of cost, on occupied dense urban housing specifically, is not well established.',
          ),
        ],
        problemRefs: ['004821'],
        questions: [
          {
            prompt:
              'Why do this board\'s urban problems carry constraints like "without replacing the existing housing stock"?',
            options: [
              'To make them harder.',
              'Because the stock is already built and occupied, so solutions requiring replacement are not solutions.',
              'Because demolition is unpopular.',
              'To limit costs.',
            ],
            correctIndex: 1,
            explanation:
              'The constraint encodes reality. Most of the buildings that will be standing in 2050 are standing now, occupied, often protected. A proposal that assumes otherwise is answering a different question.',
          },
        ],
      },
    ],
  },
  {
    slug: 'health-under-pressure',
    title: 'Health under pressure',
    summary:
      'Why antibiotics are failing for economic reasons rather than scientific ones, and what happens when diseases move.',
    outcome: 'You can see why some health problems are market failures wearing a lab coat.',
    track: 'SYSTEMS',
    domainKey: 'health',
    lessons: [
      {
        slug: 'amr-is-a-market-failure',
        title: 'Antimicrobial resistance is a market failure',
        hook: 'A successful new antibiotic must be used as little as possible. That destroys the revenue that funded it.',
        minutes: 5,
        blocks: [
          prose(
            'Antimicrobial resistance is usually framed as a scientific race — bacteria evolve, we need new drugs. The science is hard, but it is not the binding constraint. The economics are.',
          ),
          claim(
            'The World Health Organization describes the burden of drug-resistant infections, the drivers of resistance in human and animal use, and the state of the development pipeline.',
            ['who-amr'],
          ),
          claim(
            'The GRAM study published in The Lancet estimated the global burden of bacterial antimicrobial resistance.',
            ['lancet-gram-amr'],
          ),
          prose(
            'Here is the trap. A new antibiotic effective against resistant organisms should be held in reserve and used sparingly, precisely because using it breeds resistance to it. Good stewardship means low sales. The drug that most deserves to exist is the one that generates the least revenue — so the companies that would develop it do not.',
          ),
          inference(
            'Because the failure is in how the product is paid for rather than in whether it can be made, the promising interventions are changes to the payment model rather than to the chemistry.',
            ['who-amr'],
          ),
          callout(
            'A shape worth recognising',
            'This is not unique to antibiotics. Whenever the socially valuable behaviour is the one that destroys the revenue, you have a market failure rather than a technical problem, and technical effort alone will not fix it.',
          ),
          unknown(
            'Which payment model — subscription, market entry rewards, public development — actually sustains a pipeline against resistant Gram-negative pathogens is not settled.',
          ),
        ],
        problemRefs: ['004824'],
        questions: [
          {
            prompt:
              'Why does good antibiotic stewardship undermine the business case for developing antibiotics?',
            options: [
              'Because stewardship makes the drugs less effective.',
              'Because the right clinical behaviour is to use the new drug as little as possible, which means low sales.',
              'Because generics arrive too fast.',
              'Because regulators are slow.',
            ],
            correctIndex: 1,
            explanation:
              'Reserving a new antibiotic is exactly the right medicine and exactly the wrong business. The drug most worth having generates the least revenue, which is why the proposed fixes are about how it gets paid for rather than how it gets made.',
          },
        ],
      },
      {
        slug: 'when-diseases-move',
        title: 'When diseases move',
        hook: 'A mosquito does not need a passport. It needs a temperature.',
        minutes: 4,
        blocks: [
          prose(
            'Many infectious diseases are limited not by human behaviour but by whether their vector can survive and reproduce in a given place. Change the temperature and rainfall, and the map of what is possible changes with it.',
          ),
          claim(
            'The World Health Organization publishes guidance and surveillance on dengue and on malaria, and separately on climate change and health.',
            ['who-dengue', 'who-malaria', 'who-climate-health'],
          ),
          claim(
            'The European Centre for Disease Prevention and Control monitors vector-borne disease risk in Europe.',
            ['ecdc'],
          ),
          claim('The Lancet Countdown tracks indicators on health and climate change.', [
            'lancet-countdown',
          ]),
          prose(
            'The important asymmetry is preparedness. A region where a disease has always been present has clinicians who recognise it, laboratories that test for it, and a population that knows the symptoms. A region where it has just become possible has none of those, so the first outbreak is detected late and handled badly — which is why newly suitable regions are the interesting problem rather than endemic ones.',
          ),
          unknown(
            'Whether established transmission in newly suitable temperate regions can be prevented, as opposed to merely detected earlier, is not established.',
          ),
        ],
        problemRefs: ['004833'],
        questions: [
          {
            prompt: 'Why is a newly suitable region a harder problem than an endemic one?',
            options: [
              'The disease is more virulent there.',
              'There is no clinical recognition, testing capacity or public awareness yet, so the first outbreak is caught late.',
              'The vectors are more numerous.',
              'Vaccines do not work in temperate climates.',
            ],
            correctIndex: 1,
            explanation:
              'Endemic regions have built detection and response over decades. A region where transmission has only just become possible lacks all of it, and that gap — not the biology — is what makes the first outbreak dangerous.',
          },
        ],
      },
    ],
  },
  {
    slug: 'food-land-and-what-lives-on-it',
    title: 'Food, land, and what lives on it',
    summary:
      'Food lost after it is grown, carbon leaving soil, and a decline nobody can yet measure properly.',
    outcome: 'You can tell a measurement problem from a policy problem in land and food questions.',
    track: 'SYSTEMS',
    domainKey: 'food',
    lessons: [
      {
        slug: 'loss-after-harvest',
        title: 'Food lost after it is already grown',
        hook: 'Growing more is the expensive way to get more. Losing less is the cheap one, and nobody funds it.',
        minutes: 4,
        blocks: [
          prose(
            'Debates about feeding people usually become debates about yield. But a significant share of food is lost after harvest and before it reaches anyone — in storage, in transport, at market — and preventing that loss requires no new agronomy at all.',
          ),
          claim(
            'The FAO maintains a technical platform on the measurement and reduction of food loss and waste, and publishes the annual State of Food Security and Nutrition in the World.',
            ['fao-food-loss-platform', 'fao-sofi'],
          ),
          claim(
            'The FAO publishes FAOSTAT, a global database of food and agriculture statistics.',
            ['fao-faostat'],
          ),
          prose(
            'The standard answer is a cold chain — refrigeration from field to market. It works, and it is capital-intensive, electricity-hungry and fragile in places where the grid is not. So the interesting question is what can be done where a continuous cold chain is not realistic, which is a genuinely open engineering and logistics problem rather than a funding one.',
          ),
          unknown(
            'Which combination of storage, processing and market timing reduces post-harvest loss most per unit of cost, without a continuous cold chain, is not established for sub-Saharan African contexts specifically.',
          ),
        ],
        problemRefs: ['004826'],
        questions: [
          {
            prompt: 'Why is post-harvest loss an attractive place to look for gains?',
            options: [
              'Because it is easy to fix.',
              'Because the food already exists — no additional land, water or fertiliser is needed to recover it.',
              'Because it is well funded.',
              'Because it only affects rich countries.',
            ],
            correctIndex: 1,
            explanation:
              'Every tonne recovered after harvest is a tonne that did not need to be grown again. That makes it cheap in resource terms even where it is difficult in logistical ones.',
          },
        ],
      },
      {
        slug: 'carbon-in-soil',
        title: 'Carbon leaving the soil',
        hook: 'Soil holds more carbon than the atmosphere. It is also the part nobody measures.',
        minutes: 4,
        blocks: [
          prose(
            'Soil organic carbon does two jobs at once: it stores carbon, and it is most of what makes soil fertile. Losing it is therefore both a climate problem and an agricultural one, which is unusual — normally these trade against each other.',
          ),
          claim(
            'The FAO runs the Global Soil Partnership, and the IPCC has published a special report on climate change and land.',
            ['fao-soils', 'ipcc-srccl'],
          ),
          claim(
            "The European Commission's Joint Research Centre maintains the European Soil Data Centre.",
            ['jrc-esdac'],
          ),
          prose(
            'The awkward part is measurement. Soil carbon varies enormously over short distances and changes slowly, so detecting a real change against that background takes either a great many samples or a long time. This makes paying for soil carbon difficult in a way that paying for, say, solar panels is not: you cannot easily verify what you bought.',
          ),
          inference(
            'Because verification is the bottleneck rather than the practice, schemes that pay for measured outcomes and schemes that pay for adopted practices face genuinely different risks — the first may be unaffordable to verify, the second may pay for nothing.',
            ['fao-soils'],
          ),
          unknown(
            'How to halt soil organic carbon loss on European cropland without reducing yield is not resolved.',
          ),
        ],
        problemRefs: ['004837', '004836'],
        questions: [
          {
            prompt:
              'What makes paying farmers for soil carbon harder than paying for renewable electricity?',
            options: [
              'Farmers are harder to contract with.',
              'Soil carbon varies over short distances and changes slowly, so verifying a real change is expensive.',
              'Soil carbon is worth less.',
              'There is no market for it.',
            ],
            correctIndex: 1,
            explanation:
              'A megawatt-hour is metered. A change in soil carbon has to be detected against high natural variability over years, which is why measurement and verification is the live problem rather than the agronomy.',
          },
        ],
      },
      {
        slug: 'are-the-insects-declining',
        title: 'Are the insects actually declining?',
        hook: 'A question that sounds simple, is genuinely important, and cannot currently be answered.',
        minutes: 4,
        blocks: [
          prose(
            'This one is included because it is an excellent example of a measurement problem masquerading as a factual dispute — and because the honest answer is uncomfortable.',
          ),
          claim('IPBES published a global assessment of biodiversity and ecosystem services.', [
            'ipbes-global-assessment',
          ]),
          claim(
            'The IUCN maintains the Red List of Threatened Species, and GBIF aggregates biodiversity occurrence records.',
            ['iucn-red-list', 'gbif'],
          ),
          prose(
            'Widely reported studies have found steep declines in insect abundance. Others, in different places and with different methods, have found no such trend. Both can be reported honestly, because long-run insect monitoring is sparse, geographically skewed toward Europe and North America, and uses methods that are not comparable between studies.',
          ),
          unknown(
            'Whether terrestrial insect abundance is declining globally — as opposed to in the specific, unrepresentative places where it has been measured for long enough to tell — is not established.',
          ),
          callout(
            'What to do with a question like this',
            'Not "pick a side". The productive contribution is about the measurement: what monitoring would settle it, what the existing series can and cannot support, and which regions are missing. A problem framed as "establish whether" rather than "stop the decline" is framed honestly.',
          ),
        ],
        problemRefs: ['004827'],
        questions: [
          {
            prompt:
              'Two credible studies report opposite trends in insect abundance. What is the most likely explanation?',
            options: [
              'One of them is fraudulent.',
              'They measured different places with different methods, and the monitoring is too sparse to generalise.',
              'Insects fluctuate randomly, so neither means anything.',
              'The more recent study is correct.',
            ],
            correctIndex: 1,
            explanation:
              'Long-run insect monitoring is thin and geographically skewed, and methods are often not comparable. That makes the disagreement informative about the state of measurement rather than about who is lying.',
          },
        ],
      },
    ],
  },
];

export const SEED_COURSES: readonly SeedCourse[] = [...METHOD, ...SYSTEMS].map((course) => ({
  ...course,
  estimatedMinutes: course.lessons.reduce((total, lesson) => total + lesson.minutes, 0),
}));
