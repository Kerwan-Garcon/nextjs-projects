import type { DomainKey, EpistemicKind, GeographicScale, ProblemStatus } from '@saveus/common';

/**
 * Seed problems.
 *
 * Twenty real, documented, unsolved problems. The framing, constraints and
 * success criteria are written for this platform; the facts they rest on are
 * attributed to the seeded source records, and anything the record does not
 * establish is written as UNKNOWN rather than filled in.
 */

export interface SeedStatement {
  text: string;
  kind: EpistemicKind;
  sourceKeys: string[];
  note?: string;
}

export interface SeedProblem {
  key: string;
  ref: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  whyItMatters: SeedStatement[];
  constraints: {
    budget: string | null;
    time: string | null;
    geography: string | null;
    technology: string | null;
    political: string | null;
  };
  successCriteria: {
    metric: string;
    target: string;
    horizon: string;
    measurement: string | null;
  }[];
  currentKnowledge: SeedStatement[];
  openQuestions: string[];
  geographyLabel: string;
  geographyScale: GeographicScale;
  countryCode: string | null;
  difficulty: number;
  urgency: number;
  status: ProblemStatus;
  domains: DomainKey[];
  sourceKeys: string[];
}

export const SEED_PROBLEMS: readonly SeedProblem[] = [
  {
    key: 'paris-heat',
    ref: '004821',
    slug: 'reducing-extreme-heat-mortality-in-paris',
    title: 'Reducing extreme heat mortality in Paris without replacing the existing housing stock',
    summary:
      'Paris concentrates dense mineral urban fabric, a large share of small top-floor dwellings and an ageing population. Heat kills there, and the buildings that kill will still be standing in 2050.',
    description: [
      'Dense European cities built before mechanical cooling was assumed now face heat episodes their building stock was not designed for. Paris is the canonical case: a compact, highly mineralised core, a large stock of pre-1945 buildings with zinc roofs and uninsulated top-floor dwellings, limited retrofit rights in protected areas, and an ageing, partly isolated population.',
      '',
      'The mitigation path - replace or deep-retrofit the stock - is real but slow: turnover of the residential building stock is on the order of one percent a year. Anything that only works after a full retrofit programme arrives too late for the people who die in the next twenty summers.',
      '',
      'So the problem is narrower and harder than "adapt cities to heat". It is: what reduces heat mortality in an occupied, protected, largely un-retrofittable housing stock, on a timescale of years rather than decades, at a cost a municipality can actually carry?',
    ].join('\n'),
    whyItMatters: [
      {
        text: 'WHO documents heat as a direct cause of excess mortality, with older adults, people with chronic conditions and socially isolated people at elevated risk; the exposure is concentrated in dense urban areas.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['who-heat-health'],
      },
      {
        text: 'IPCC AR6 WGII assesses that the frequency and intensity of heat extremes in Europe increase with further warming, and that European cities are a hotspot for heat risk.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['ipcc-ar6-wg2', 'ipcc-ar6-wg1'],
      },
      {
        text: 'The number of Paris heat deaths attributable specifically to dwelling typology - top-floor, uninsulated, single-aspect - is UNKNOWN in this record. No source here separates building type from age and isolation as a risk factor.',
        kind: 'UNKNOWN',
        sourceKeys: [],
      },
    ],
    constraints: {
      budget:
        'Municipal adaptation budget, not national reconstruction money. Interventions costing more than a few hundred euros per exposed dwelling will not be deployed at scale.',
      time: 'Must reduce mortality within 3-5 summers. Measures that only pay off after a 25-year retrofit cycle do not address this problem.',
      geography:
        'Dense Paris intra-muros: roughly 2.1 million residents, high building density, limited open ground for new planting.',
      technology:
        'Must work on occupied buildings without displacing residents. No structural modification in protected architectural zones.',
      political:
        'Roof and facade changes in protected sectors require heritage approval. Split ownership (copropriété) means per-building decisions need owner majorities.',
    },
    successCriteria: [
      {
        metric: 'Excess mortality during defined heat episodes, age-standardised',
        target: 'Statistically detectable reduction versus a matched control population',
        horizon: '5 summers',
        measurement:
          'National mortality surveillance compared against modelled expected mortality for the same episode severity.',
      },
      {
        metric: 'Indoor operative temperature in exposed top-floor dwellings during episodes',
        target: 'Peak reduced by at least 2 °C versus untreated matched dwellings',
        horizon: '2 summers',
        measurement:
          'Paired logger campaign in treated and untreated dwellings of the same typology.',
      },
      {
        metric: 'Cost per exposed dwelling treated',
        target: 'Under EUR 500 for the measure to be municipally scalable',
        horizon: 'At deployment',
        measurement:
          'Programme accounting, including access and administration, not just materials.',
      },
    ],
    currentKnowledge: [
      {
        text: 'High-albedo (cool) roofing materials are commercially available and rated: the Cool Roof Rating Council maintains a directory of measured solar reflectance and thermal emittance values for real products.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['cool-roof-rating-council', 'lbnl-heat-island'],
      },
      {
        text: 'Urban tree canopy has measurable cooling and health effects, and tools exist to quantify them at street level.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['itree', 'iucn-nbs'],
      },
      {
        text: 'Heat-health action plans are established public-health practice, but attribution of avoided deaths to any single component of such a plan is not resolved.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['who-heat-health', 'climate-adapt'],
      },
      {
        text: 'Whether ambient street-level cooling or indoor-temperature reduction dominates the mortality effect is an INFERENCE contested between the urban-climate and epidemiological literatures as represented in this corpus.',
        kind: 'INFERENCE',
        sourceKeys: ['lancet-countdown'],
      },
    ],
    openQuestions: [
      'Does reducing indoor peak temperature in top-floor dwellings reduce deaths more than reducing ambient street temperature by the same amount?',
      'What fraction of Paris roof area is legally and structurally treatable with a reflective coating?',
      'Do cool roofs shift the heating-season penalty enough to matter at Paris latitude?',
      'Which is the binding constraint on deployment: cost, heritage approval, or copropriété decision-making?',
      'Can the at-risk population be identified before an episode rather than after it?',
    ],
    geographyLabel: 'Paris, France',
    geographyScale: 'CITY',
    countryCode: 'FR',
    difficulty: 7,
    urgency: 9,
    status: 'ACTIVE_RESEARCH',
    domains: ['cities', 'health', 'climate'],
    sourceKeys: [
      'who-heat-health',
      'ipcc-ar6-wg2',
      'ipcc-ar6-wg1',
      'lancet-countdown',
      'lbnl-heat-island',
      'cool-roof-rating-council',
      'itree',
      'apur',
      'santepublique-france',
      'meteo-france',
      'climate-adapt',
      'cdc-heat-tracking',
      'globalabc',
      'iucn-nbs',
      'insee-statistics',
    ],
  },

  {
    key: 'dunkelflaute',
    ref: '004822',
    slug: 'multi-day-low-wind-low-sun-periods-on-a-renewable-european-grid',
    title: 'Covering multi-day low-wind, low-sun periods on a majority-renewable European grid',
    summary:
      'Batteries solve hours. Europe periodically gets a week of still, overcast winter weather across the whole synchronous area. What covers that, at what cost, is not settled.',
    description: [
      'A power system dominated by wind and solar has to survive correlated low-output periods. In north-west Europe these occur in winter, can last several days, and are spatially correlated across the interconnected area - which means neighbours cannot reliably help, because they are in the same weather.',
      '',
      'Lithium-ion storage is economic for intra-day shifting and is being deployed at scale. It is not obviously economic for multi-day energy, where the cost that matters is cost per unit of energy stored rather than per unit of power. The candidates for that duration - hydrogen and derived fuels, long-duration electrochemical and thermal storage, retained dispatchable capacity, large-scale demand response, expanded interconnection - have very different cost structures, lead times and political footprints.',
      '',
      'The unresolved question is not whether a solution exists. It is which portfolio is cheapest and deliverable given that most of these assets would run for a small number of hours a year, which is exactly the situation markets price worst.',
    ].join('\n'),
    whyItMatters: [
      {
        text: 'IEA analysis identifies grids and system flexibility, not generation cost, as the emerging binding constraint on clean electricity deployment.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['iea-grids', 'iea-electricity'],
      },
      {
        text: "RTE's Futurs énergétiques 2050 assesses French system adequacy under scenarios with very high renewable shares, and treats flexibility and firm capacity as explicit requirements rather than assumptions.",
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['rte-futurs-2050'],
      },
      {
        text: 'The cost of unserved energy during a multi-day European shortfall is UNKNOWN in this record.',
        kind: 'UNKNOWN',
        sourceKeys: [],
      },
    ],
    constraints: {
      budget:
        'Any portfolio must be defensible against the counterfactual of retaining gas capacity for a handful of hours a year.',
      time: 'Assets must be deliverable by the 2035-2040 decarbonisation milestones, which means permitting starts this decade.',
      geography:
        'North-west European synchronous area, where wind lulls are spatially correlated over 1000+ km.',
      technology:
        'Must work with existing market design or come with a specific market-design change. Round-trip efficiency below 40% changes the sizing problem qualitatively.',
      political:
        'Cross-border capacity sharing requires agreements that currently do not bind in scarcity conditions.',
    },
    successCriteria: [
      {
        metric: 'Loss-of-load expectation under a reconstructed historical worst-case weather year',
        target: 'Meets the national adequacy standard without fossil backup',
        horizon: '2040',
        measurement: 'Adequacy simulation over multi-decade reanalysis weather data.',
      },
      {
        metric: 'System cost of the flexibility portfolio',
        target: 'Within 10% of the retained-gas counterfactual',
        horizon: '2040',
        measurement: 'Whole-system cost modelling with transparent assumptions.',
      },
    ],
    currentKnowledge: [
      {
        text: 'Multi-decade reanalysis datasets (ERA5) exist at the resolution needed to reconstruct historical low-wind, low-sun events.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['copernicus-cds'],
      },
      {
        text: 'Hydrogen is assessed by the IEA as a candidate for long-duration and seasonal storage, with efficiency and infrastructure as the open questions.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['iea-hydrogen'],
      },
      {
        text: 'Technology cost trajectories for storage and renewables are published and updated annually.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['nrel-atb', 'irena-publications'],
      },
    ],
    openQuestions: [
      'What is the longest correlated low-output event in the reanalysis record for the interconnected area?',
      'At what energy-to-power ratio does hydrogen beat electrochemical storage on delivered cost?',
      'Does demand response deliver under conditions where every consumer faces the same shortage simultaneously?',
      'What market design pays for an asset that runs 40 hours a year?',
    ],
    geographyLabel: 'North-west Europe',
    geographyScale: 'CONTINENTAL',
    countryCode: null,
    difficulty: 9,
    urgency: 8,
    status: 'ACTIVE_RESEARCH',
    domains: ['energy', 'climate'],
    sourceKeys: [
      'iea-grids',
      'iea-electricity',
      'iea-hydrogen',
      'iea-renewables',
      'iea-wind',
      'iea-solar-pv',
      'rte-futurs-2050',
      'nrel-atb',
      'irena-publications',
      'copernicus-cds',
      'doe-storage-challenge',
      'ademe-transitions',
    ],
  },

  {
    key: 'cement-process-co2',
    ref: '004823',
    slug: 'eliminating-process-co2-from-cement-without-losing-performance',
    title:
      'Eliminating process CO2 from cement clinker without losing structural performance or buildability',
    summary:
      'Most cement CO2 comes from the chemistry, not the fuel. Decarbonising the kiln does not solve it, and the substitutes that do are supply-limited or unproven at structural scale.',
    description: [
      'Cement is the second most used substance on earth after water, and its emissions are unusual: roughly two thirds come from calcination - limestone releasing CO2 as it becomes clinker - not from burning fuel. Electrifying or fuel-switching the kiln therefore leaves the majority of the problem untouched.',
      '',
      'The routes that address calcination are: supplementary cementitious materials that replace clinker (fly ash, slag, calcined clay), alternative chemistries, and carbon capture on the kiln. Each has a specific unsolved part. Fly ash and slag are byproducts of industries that are themselves shrinking. Calcined clay depends on local clay quality. Alternative chemistries face a certification system built around Portland cement. Capture faces the cost of a dispersed, mid-size point-source fleet.',
      '',
      'Standards are part of the problem: structural codes specify what a binder must be, not only what it must do, which means a material that performs can still be unbuildable.',
    ].join('\n'),
    whyItMatters: [
      {
        text: 'The IEA assesses cement as one of the hardest industrial sectors to abate, with process emissions from calcination as the structural difficulty.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['iea-cement'],
      },
      {
        text: 'Cement and concrete production is commonly assessed as responsible for around 7% of global CO2 emissions - a share large enough that no credible global pathway leaves it unaddressed.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['iea-cement', 'gcca-concrete-future'],
      },
      {
        text: "The industry's own 2050 roadmap depends on carbon capture for a large share of the remaining abatement, which makes the capture cost assumption load-bearing.",
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['gcca-concrete-future', 'iea-ccus'],
      },
    ],
    constraints: {
      budget:
        'Cement is a low-margin commodity shipped short distances. A cost premium above roughly 30% does not survive competitive tendering without a carbon price or a procurement mandate.',
      time: 'Kilns are 30-50 year assets. Investment decisions taken this decade determine 2060 emissions.',
      geography:
        'Global, but the binding constraints are local: clay quality, limestone chemistry, and whether CO2 transport and storage exists within reach of the plant.',
      technology:
        'Must meet structural performance and durability requirements, including long-term behaviour that by definition has not been observed for a new binder.',
      political:
        'Structural codes are prescriptive in most jurisdictions. Changing them is slow and conservative for good reasons.',
    },
    successCriteria: [
      {
        metric: 'CO2 per tonne of binder delivered at equivalent structural performance',
        target: 'Reduction of at least 50% versus ordinary Portland cement',
        horizon: '2035',
        measurement: 'Life-cycle assessment with a published, auditable inventory.',
      },
      {
        metric: 'Cost premium over ordinary Portland cement at plant gate',
        target: 'Under 30%',
        horizon: '2035',
        measurement: 'Delivered cost including any capture, transport and storage.',
      },
      {
        metric: 'Code acceptance',
        target: 'Accepted in at least one national structural code for load-bearing use',
        horizon: '2035',
        measurement: 'Published standard or technical approval.',
      },
    ],
    currentKnowledge: [
      {
        text: 'Calcined clay and limestone blends are an established clinker-substitution route with published industrial experience.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['iea-cement', 'gcca-concrete-future'],
      },
      {
        text: 'Carbon capture, utilisation and storage is assessed by the IEA across industrial applications, including cement.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['iea-ccus'],
      },
      {
        text: 'Long-term durability data for novel binders under real exposure is thin by construction: the materials have not existed long enough.',
        kind: 'INFERENCE',
        sourceKeys: [],
      },
    ],
    openQuestions: [
      'What share of global cement demand is within economic reach of suitable clay deposits?',
      'Can performance-based codes replace prescriptive ones without unacceptable risk?',
      'Does CO2 curing of concrete lock up enough carbon to matter, or is it a rounding error?',
      'What is the realistic capture cost for a mid-size dispersed kiln fleet, as opposed to a flagship demonstrator?',
    ],
    geographyLabel: 'Global',
    geographyScale: 'GLOBAL',
    countryCode: null,
    difficulty: 8,
    urgency: 7,
    status: 'OPEN',
    domains: ['materials', 'climate', 'energy'],
    sourceKeys: [
      'iea-cement',
      'gcca-concrete-future',
      'iea-ccus',
      'nasem-negative-emissions',
      'unep-resource-panel',
      'materials-project',
      'globalabc',
      'epa-ghg-sources',
      'ipcc-ar6-wg3',
    ],
  },

  {
    key: 'gram-negative-amr',
    ref: '004824',
    slug: 'restoring-an-antibiotic-pipeline-for-resistant-gram-negative-infections',
    title:
      'Restoring a viable development pipeline for antibiotics against resistant Gram-negative pathogens',
    summary:
      'The scientific problem and the market problem are entangled: a successful new antibiotic must be used as little as possible, which destroys the revenue that funded it.',
    description: [
      'Carbapenem-resistant Gram-negative organisms are among the pathogens of greatest concern in clinical medicine. The outer membrane that makes them hard to treat also makes them hard to drug: compounds that would work cannot get in, or are pumped back out.',
      '',
      'Layered on top is an economic structure unlike any other in pharmaceuticals. Stewardship - the correct clinical response - reserves a new agent for the cases nothing else treats. That is precisely the behaviour that prevents a developer from recovering development costs, and several companies that brought approved antibiotics to market have subsequently failed.',
      '',
      'This is therefore a problem where a purely scientific solution does not solve the problem, and a purely economic solution has nothing to sell. Proposals that address only one half are common; proposals that address both, and survive contact with procurement systems, are not.',
    ].join('\n'),
    whyItMatters: [
      {
        text: 'The GRAM study published in The Lancet estimated that 1.27 million deaths in 2019 were directly attributable to bacterial antimicrobial resistance, with resistant Gram-negative organisms prominent among them.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['lancet-gram-amr'],
      },
      {
        text: 'WHO classifies antimicrobial resistance among the top global public health threats and maintains a priority pathogen framework.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['who-amr'],
      },
      {
        text: 'How much of the pipeline failure is scientific difficulty versus market structure is CONTESTED and not separated in this record.',
        kind: 'UNKNOWN',
        sourceKeys: [],
      },
    ],
    constraints: {
      budget:
        'Any pull mechanism must be affordable to health systems that are simultaneously being asked to restrain antibiotic spending.',
      time: 'Development timelines are 10+ years; resistance spreads faster than that.',
      geography:
        'Global. The burden is highest where purchasing power is lowest, which breaks market-based incentives.',
      technology:
        'Must overcome Gram-negative outer-membrane permeability and efflux - a physical chemistry problem, not only a screening problem.',
      political:
        'Delinking revenue from volume requires coordinated action by multiple national payers.',
    },
    successCriteria: [
      {
        metric: 'Novel-mechanism agents against priority Gram-negative pathogens entering phase 3',
        target: 'At least 5 in a rolling 5-year window',
        horizon: '2035',
        measurement: 'Public clinical trial registries.',
      },
      {
        metric: 'Developer financial viability post-approval',
        target: 'No approved-antibiotic developer insolvency attributable to volume-based revenue',
        horizon: '2035',
        measurement: 'Company filings.',
      },
      {
        metric: 'Access in low- and middle-income settings',
        target: 'Registered and supplied in at least 30 LMICs within 3 years of approval',
        horizon: 'Per agent',
        measurement: 'Registration and procurement records.',
      },
    ],
    currentKnowledge: [
      {
        text: 'WHO maintains analyses of the clinical antibacterial pipeline and of priority pathogens.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['who-amr'],
      },
      {
        text: 'Subscription-style "delinked" payment pilots exist in some national health systems; their transferability is not established in this record.',
        kind: 'INFERENCE',
        sourceKeys: ['who-amr'],
      },
      {
        text: 'Structural biology and structure prediction have improved dramatically, which changes what is screenable but not necessarily what is permeable.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['nature-alphafold', 'rcsb-pdb'],
      },
    ],
    openQuestions: [
      'Are there general rules for Gram-negative permeability that would make rational design tractable?',
      'What size of pull incentive actually changes portfolio decisions inside a developer?',
      'Can diagnostics that identify resistance fast enough change the economics by expanding appropriate use?',
      'Does phage therapy or a non-antibiotic modality change the framing, and at what regulatory cost?',
    ],
    geographyLabel: 'Global',
    geographyScale: 'GLOBAL',
    countryCode: null,
    difficulty: 9,
    urgency: 9,
    status: 'OPEN',
    domains: ['health', 'other'],
    sourceKeys: [
      'who-amr',
      'lancet-gram-amr',
      'ihme-gbd',
      'nature-alphafold',
      'rcsb-pdb',
      'ecdc',
      'who-gho',
      'nih-pubmed',
    ],
  },

  {
    key: 'groundwater-depletion',
    ref: '004825',
    slug: 'reversing-groundwater-depletion-in-intensively-irrigated-basins',
    title:
      'Reversing groundwater depletion in intensively irrigated basins without collapsing farm incomes',
    summary:
      "Aquifers are being drawn down faster than they recharge in several of the world's most productive agricultural regions. Every technical fix so far has been absorbed by expanded irrigation.",
    description: [
      'In several major irrigated regions, groundwater extraction exceeds recharge. The physical outcome is falling water tables, rising pumping costs, land subsidence and, in coastal aquifers, saline intrusion. The social outcome is that the households who lose access first are the ones who cannot afford to deepen a well.',
      '',
      'What makes this hard is not that efficient irrigation technology is missing. It is that efficiency gains have repeatedly been reinvested in irrigating more land or growing thirstier crops, so basin-level extraction does not fall - the well-documented efficiency paradox. Meanwhile electricity for pumping is subsidised in several of the affected regions, which removes the price signal that would otherwise limit extraction.',
      '',
      'A solution has to reduce basin-level net extraction, not field-level use per hectare, while leaving farm households solvent.',
    ].join('\n'),
    whyItMatters: [
      {
        text: "WRI's Aqueduct dataset maps basin-level water stress and groundwater depletion indicators globally, identifying regions where withdrawals persistently exceed renewable supply.",
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['wri-aqueduct'],
      },
      {
        text: 'FAO AQUASTAT documents the dominance of agriculture in global freshwater withdrawals.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['fao-aquastat'],
      },
      {
        text: 'IPCC AR6 WGII assesses water scarcity as a major climate-linked risk with strong regional concentration.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['ipcc-ar6-wg2'],
      },
    ],
    constraints: {
      budget:
        'Compensation schemes must be affordable to state-level budgets, not only to donor pilots.',
      time: 'Aquifer recovery is slow; the measurable target is halting decline before it is reversing it.',
      geography: 'Intensively irrigated alluvial basins with millions of individual wells.',
      technology:
        'Metering millions of dispersed wells is expensive; remote-sensed proxies are cheaper but coarser.',
      political:
        'Electricity subsidies for agricultural pumping are politically entrenched. Removing them directly has repeatedly failed.',
    },
    successCriteria: [
      {
        metric: 'Basin-level net groundwater extraction',
        target: 'Below recharge in a defined pilot basin',
        horizon: '10 years',
        measurement: 'Water-table monitoring network plus gravimetric satellite estimates.',
      },
      {
        metric: 'Farm household net income in the pilot basin',
        target: 'No decline versus matched control',
        horizon: '5 years',
        measurement: 'Household panel survey.',
      },
    ],
    currentKnowledge: [
      {
        text: 'Satellite and in-situ monitoring capable of detecting basin-scale storage change exists and is publicly available.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['nasa-earthdata', 'usgs-water'],
      },
      {
        text: 'The efficiency paradox - efficiency gains absorbed by expanded irrigated area - is reported across multiple irrigation contexts.',
        kind: 'INFERENCE',
        sourceKeys: ['fao-aquastat'],
      },
      {
        text: 'Whether crop switching or extraction caps is the more durable lever is UNKNOWN in this record.',
        kind: 'UNKNOWN',
        sourceKeys: [],
      },
    ],
    openQuestions: [
      'Can a tradable extraction right be enforced where wells are unmetered?',
      'Does paying farmers for reduced extraction outperform paying them for efficient equipment?',
      'What is the actual recharge rate, and how badly is it misestimated in the basins that matter?',
      'Which crop substitutions are agronomically and commercially viable for smallholders?',
    ],
    geographyLabel: 'Intensively irrigated basins (South Asia, North China Plain, US High Plains)',
    geographyScale: 'REGIONAL',
    countryCode: null,
    difficulty: 8,
    urgency: 8,
    status: 'OPEN',
    domains: ['water', 'food'],
    sourceKeys: [
      'wri-aqueduct',
      'fao-aquastat',
      'ipcc-ar6-wg2',
      'usgs-water',
      'nasa-earthdata',
      'worldbank-wdi',
      'fao-faostat',
      'unccd',
    ],
  },

  {
    key: 'post-harvest-loss',
    ref: '004826',
    slug: 'reducing-post-harvest-loss-without-a-continuous-cold-chain',
    title: 'Reducing post-harvest loss in sub-Saharan Africa without a continuous cold chain',
    summary:
      'A large share of food is lost between harvest and market. Cold chains are the standard answer and need reliable electricity, which is exactly what is missing.',
    description: [
      'Food lost after harvest and before it reaches a consumer represents wasted land, water, labour and fertiliser - and, for smallholder households, wasted income. In sub-Saharan Africa the losses are concentrated in the first links of the chain: on-farm storage, aggregation, and the first transport leg.',
      '',
      'The default intervention, refrigeration, assumes a grid that can hold a temperature continuously. Where power is intermittent, a cold chain that breaks is sometimes worse than none, because it produces a false expectation of shelf life. Alternatives exist - hermetic storage bags, evaporative cooling, solar dryers, improved aggregation logistics - but their measured effect at scale, and which link in the chain they should be applied to, is not well established.',
      '',
      'The measurement problem is itself part of the problem: loss is commonly estimated from recall surveys, which are known to be unreliable.',
    ].join('\n'),
    whyItMatters: [
      {
        text: "FAO estimates that around 13% of the world's food is lost between harvest and retail, with losses concentrated in the early stages of the chain in low-income settings.",
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['fao-food-loss-platform', 'fao-sofi'],
      },
      {
        text: "FAO's SOFI reporting documents persistent food insecurity affecting hundreds of millions of people, with sub-Saharan Africa among the most affected regions.",
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['fao-sofi'],
      },
      {
        text: 'UNEP works on food waste reduction as a resource-efficiency and emissions issue as well as a food-security one.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['fao-food-waste'],
      },
    ],
    constraints: {
      budget:
        'Interventions must be affordable at smallholder scale - tens of dollars, not thousands - or come with a functioning finance mechanism.',
      time: 'Benefits must appear within one or two harvest cycles or adoption collapses.',
      geography: 'Rural sub-Saharan Africa with intermittent or absent grid electricity.',
      technology:
        'Must tolerate intermittent power, high ambient humidity, and maintenance by the user.',
      political:
        'Aggregation depends on cooperative structures whose strength varies enormously between districts.',
    },
    successCriteria: [
      {
        metric: 'Measured physical loss between harvest and first sale',
        target: 'Reduction of at least 30% versus baseline',
        horizon: '2 harvest cycles',
        measurement: 'Direct weighing at defined chain points, not recall survey.',
      },
      {
        metric: 'Net household income from the treated crop',
        target: 'Increase versus matched control',
        horizon: '2 harvest cycles',
        measurement: 'Household panel with a control group.',
      },
      {
        metric: 'Retention of the practice after subsidy ends',
        target: 'Above 60% at 24 months',
        horizon: '2 years',
        measurement: 'Follow-up adoption survey.',
      },
    ],
    currentKnowledge: [
      {
        text: 'FAO maintains a technical platform on measuring and reducing food loss and waste, including methodology for loss measurement.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['fao-food-loss-platform'],
      },
      {
        text: 'CGIAR centres run applied agricultural research programmes in the affected regions.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['cgiar-research', 'ifpri'],
      },
      {
        text: 'Recall-based loss estimates and direct measurement are known to diverge; the size of the divergence is UNKNOWN in this record.',
        kind: 'UNKNOWN',
        sourceKeys: [],
      },
    ],
    openQuestions: [
      'Which link in the chain carries the largest measured loss - on-farm storage, aggregation, or first transport?',
      'Does hermetic storage outperform intermittent refrigeration for staples, and for which crops does it not?',
      'What finance structure gets a $40 device into the hands of a household with no collateral?',
      'How much of the reported loss reduction in pilots survives the end of the pilot?',
    ],
    geographyLabel: 'Sub-Saharan Africa',
    geographyScale: 'REGIONAL',
    countryCode: null,
    difficulty: 6,
    urgency: 8,
    status: 'OPEN',
    domains: ['food', 'energy'],
    sourceKeys: [
      'fao-sofi',
      'fao-food-loss-platform',
      'fao-faostat',
      'fao-food-waste',
      'cgiar-research',
      'ifpri',
      'worldbank-wdi',
      'iea-efficiency',
    ],
  },

  {
    key: 'insect-decline',
    ref: '004827',
    slug: 'measuring-and-reversing-terrestrial-insect-decline',
    title:
      'Establishing whether terrestrial insect abundance is declining globally, and what would reverse it',
    summary:
      'Regional studies report steep declines; the global picture rests on sparse, unevenly distributed monitoring. Both the measurement and the intervention are unsolved.',
    description: [
      'Insect populations underpin pollination, decomposition and food webs. A series of regional studies has reported substantial declines in insect biomass and abundance, and these findings have been influential. They have also been criticised on sampling grounds: monitoring is concentrated in a few well-studied regions, time series are short relative to natural population variability, and methods differ between programmes.',
      '',
      'So there are two entangled problems. The first is epistemic: what would it take to know, at global scale, whether insect abundance is falling and by how much? The second is causal and practical: if it is, which driver - land-use change, pesticide load, climate, light, nitrogen deposition - carries enough of the effect that acting on it would reverse the trend?',
      '',
      'This problem is included partly because it is a good test of the platform: the honest answer to large parts of it is currently UNKNOWN.',
    ].join('\n'),
    whyItMatters: [
      {
        text: "IPBES's global assessment concluded that around one million species are threatened with extinction, and identified land-use change as the dominant driver on land.",
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['ipbes-global-assessment'],
      },
      {
        text: 'The IUCN Red List documents assessed extinction risk by taxon, and insect coverage is sparse relative to vertebrates.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['iucn-red-list'],
      },
      {
        text: 'The magnitude of global insect abundance change is CONTESTED in the literature and is not settled by the sources in this record.',
        kind: 'UNKNOWN',
        sourceKeys: [],
      },
    ],
    constraints: {
      budget:
        'Long-term monitoring is chronically underfunded; any design must be cheap enough to run for decades.',
      time: 'Detecting a trend against natural variability requires a decade or more of consistent method.',
      geography:
        'Monitoring is heavily biased toward Europe and North America; the tropics hold most of the diversity.',
      technology:
        'Automated monitoring (acoustic, camera, DNA) is promising but not yet comparable across sites.',
      political: 'Pesticide regulation is the most contested lever and moves slowly.',
    },
    successCriteria: [
      {
        metric:
          'Number of standardised, comparable long-term insect monitoring sites in tropical regions',
        target: 'At least 100 with 10 years of consistent method',
        horizon: '2040',
        measurement: 'Registry of monitoring programmes with published protocols.',
      },
      {
        metric: 'Attribution of abundance change to drivers',
        target: 'A published attribution with quantified uncertainty for at least one major taxon',
        horizon: '2035',
        measurement: 'Peer-reviewed analysis over the standardised network.',
      },
    ],
    currentKnowledge: [
      {
        text: 'GBIF aggregates occurrence records globally and exposes the geographic bias in sampling effort directly.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['gbif'],
      },
      {
        text: 'IPBES has assessed invasive alien species as a driver of biodiversity loss with regionally uneven evidence.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['ipbes-invasive'],
      },
      {
        text: 'Occurrence records are not abundance records; inferring population trends from presence data is an INFERENCE with known bias.',
        kind: 'INFERENCE',
        sourceKeys: ['gbif'],
      },
    ],
    openQuestions: [
      'Can automated sensors produce abundance estimates comparable to standardised manual trapping?',
      'Which regions would most reduce global uncertainty per monitoring euro spent?',
      'Is there any dataset long enough to separate a trend from a multi-decadal cycle?',
      'Which driver would have to change for a measurable reversal, and by how much?',
    ],
    geographyLabel: 'Global',
    geographyScale: 'GLOBAL',
    countryCode: null,
    difficulty: 9,
    urgency: 6,
    status: 'NEEDS_EVIDENCE',
    domains: ['biodiversity', 'food'],
    sourceKeys: [
      'ipbes-global-assessment',
      'ipbes-invasive',
      'iucn-red-list',
      'gbif',
      'wwf-living-planet',
      'cbd-gbf',
      'global-forest-watch',
      'our-world-in-data',
    ],
  },

  {
    key: 'green-steel',
    ref: '004828',
    slug: 'hydrogen-based-primary-steel-at-competitive-cost',
    title: 'Making hydrogen-based primary steel competitive without a permanent subsidy',
    summary:
      'Hydrogen direct reduction works technically. Whether it works economically depends on cheap hydrogen, suitable ore, and a market willing to pay - none of which is settled.',
    description: [
      'Primary steelmaking via blast furnace uses coke both as fuel and as the chemical reductant, which is why it is hard to decarbonise by electrification alone. Hydrogen direct reduction replaces the reductant, and pilot and first commercial plants exist.',
      '',
      'The open questions are downstream of the chemistry. Direct reduction is sensitive to iron ore grade, and high-grade pellet feed is a minority of global supply. The hydrogen has to be cheap and available continuously, which reopens the renewable-intermittency problem. And the product has to sell into a commodity market where a green premium has so far been demonstrated only in small, symbolic volumes.',
      '',
      'A credible answer has to address ore supply, hydrogen cost and offtake together. Answers that address only one are common.',
    ].join('\n'),
    whyItMatters: [
      {
        text: 'The IEA identifies iron and steel as one of the largest industrial sources of CO2 and analyses hydrogen-based reduction among the principal near-zero routes.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['iea-steel'],
      },
      {
        text: 'Low-emission hydrogen supply is assessed by the IEA as growing but far below the volumes assumed in net-zero pathways.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['iea-hydrogen'],
      },
      {
        text: 'The share of global iron ore suitable for direct reduction without additional beneficiation is UNKNOWN in this record.',
        kind: 'UNKNOWN',
        sourceKeys: [],
      },
    ],
    constraints: {
      budget:
        'Steel is traded globally with thin margins; an unsubsidised premium above roughly 20% is not sustainable against imports.',
      time: 'Blast furnace relining decisions occur on a 15-20 year cycle and are happening now.',
      geography:
        'Economics favour co-location of cheap renewables, ore and port access - a short list of places.',
      technology: 'Direct reduction is sensitive to ore grade and to hydrogen supply continuity.',
      political:
        'Border carbon adjustment changes the calculation, and its scope is still being decided.',
    },
    successCriteria: [
      {
        metric: 'Delivered cost of hydrogen-reduced steel versus blast furnace steel',
        target: 'Within 20% without production subsidy',
        horizon: '2035',
        measurement: 'Plant-gate cost with transparent input assumptions.',
      },
      {
        metric: 'Annual near-zero primary steel output',
        target: 'Above 50 Mt/yr globally',
        horizon: '2040',
        measurement: 'Industry production statistics.',
      },
    ],
    currentKnowledge: [
      {
        text: 'IEA industry analysis covers both the steel process routes and the hydrogen supply that would feed them.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['iea-steel', 'iea-hydrogen'],
      },
      {
        text: 'Critical mineral and materials supply chains for the transition are assessed with explicit attention to concentration risk.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['iea-critical-minerals', 'unep-resource-panel'],
      },
    ],
    openQuestions: [
      'Is there enough DR-grade ore, and what does beneficiating lower grades cost in energy and money?',
      'Does hydrogen storage at the plant solve intermittency cheaper than oversizing electrolysis?',
      'Will a green premium survive outside symbolic volumes?',
      'Does scrap-based secondary steel displace enough primary demand to change the target?',
    ],
    geographyLabel: 'Global',
    geographyScale: 'GLOBAL',
    countryCode: null,
    difficulty: 8,
    urgency: 7,
    status: 'ACTIVE_RESEARCH',
    domains: ['materials', 'energy', 'climate'],
    sourceKeys: [
      'iea-steel',
      'iea-hydrogen',
      'iea-critical-minerals',
      'unep-resource-panel',
      'ipcc-ar6-wg3',
      'irena-publications',
      'nrel-atb',
    ],
  },

  {
    key: 'shipping-fuels',
    ref: '004829',
    slug: 'decarbonising-long-haul-shipping-fuels',
    title: 'Choosing a long-haul shipping fuel before the fleet turns over the wrong way',
    summary:
      'Ships last 25-30 years. Every fuel candidate has a disqualifying open question, and ordering decisions are being made now.',
    description: [
      'International shipping moves most of world trade and runs on heavy fuel oil and marine gas oil. The candidate replacements - ammonia, methanol, hydrogen, biofuels, wind assistance - each fail on a different axis: toxicity and NOx for ammonia, feedstock availability for methanol and biofuels, volumetric energy density and cryogenics for hydrogen.',
      '',
      'The timing makes it acute. A vessel ordered now will still be operating in the 2050s. Ordering the wrong fuel locks in either stranded assets or continued emissions, and the bunkering infrastructure that would make any fuel viable will only be built once someone commits.',
      '',
      'This is a coordination problem with a real technical core, and the coordination half is at least as unsolved as the technical half.',
    ].join('\n'),
    whyItMatters: [
      {
        text: 'The IMO has adopted a strategy on reduction of GHG emissions from ships and maintains the regulatory framework under which any fuel transition would occur.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['imo-ghg'],
      },
      {
        text: 'International shipping is commonly assessed as responsible for roughly 3% of global greenhouse gas emissions.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['imo-ghg', 'iea-transport'],
      },
      {
        text: 'Whole-life emissions of ammonia produced from current hydrogen feedstocks are not established in this record.',
        kind: 'UNKNOWN',
        sourceKeys: [],
      },
    ],
    constraints: {
      budget:
        'Fuel is the dominant operating cost; charterers do not pay premiums without regulation.',
      time: 'Vessels ordered this decade operate into the 2050s.',
      geography:
        'Bunkering must exist at both ends of the route, which is a global coordination problem.',
      technology:
        'Engine, storage and safety systems differ per fuel; retrofit options are limited.',
      political:
        'IMO decision-making requires broad agreement among member states with divergent interests.',
    },
    successCriteria: [
      {
        metric: 'Share of newbuild long-haul tonnage ordered with near-zero-capable propulsion',
        target: 'Above 50%',
        horizon: '2035',
        measurement: 'Order book statistics.',
      },
      {
        metric: 'Bunkering availability for the chosen fuel on major trade lanes',
        target: 'At least 2 ports per major lane',
        horizon: '2035',
        measurement: 'Port infrastructure registry.',
      },
    ],
    currentKnowledge: [
      {
        text: 'The IEA analyses transport energy demand including international shipping.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['iea-transport'],
      },
      {
        text: 'ICCT publishes technical analysis of marine fuel and efficiency policy.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['icct'],
      },
      {
        text: 'Hydrogen production pathways and their emissions intensity are analysed separately and determine the answer for ammonia and methanol.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['iea-hydrogen'],
      },
    ],
    openQuestions: [
      "Does ammonia's toxicity risk profile survive contact with port-city regulators?",
      'Is there enough sustainable biogenic carbon for methanol at fleet scale?',
      'Can wind assistance deliver a large enough fraction to change the fuel requirement?',
      'What regulatory instrument actually moves an order book?',
    ],
    geographyLabel: 'Global shipping lanes',
    geographyScale: 'GLOBAL',
    countryCode: null,
    difficulty: 8,
    urgency: 7,
    status: 'OPEN',
    domains: ['transport', 'energy', 'climate'],
    sourceKeys: ['imo-ghg', 'iea-transport', 'icct', 'iea-hydrogen', 'itf-outlook', 'ipcc-ar6-wg3'],
  },

  {
    key: 'saf-supply',
    ref: '004830',
    slug: 'scaling-sustainable-aviation-fuel-without-competing-for-land',
    title:
      'Scaling sustainable aviation fuel without competing for land, food or scarce clean hydrogen',
    summary:
      'Aviation has no electrification path for long-haul. Every SAF feedstock is either limited, contested, or expensive - and all three at once for the synthetic route.',
    description: [
      'Short-haul flight may eventually electrify. Long-haul will not within the relevant timeframe, because of energy density. That leaves drop-in liquid fuels, and the question becomes where the carbon and hydrogen come from.',
      '',
      'Waste oils are genuinely low-carbon but supply-limited, and demand already exceeds credible collection volumes. Crop-based routes raise land-use competition with food. Synthetic fuels made from captured CO2 and clean hydrogen have no feedstock ceiling in principle, but need very large amounts of cheap clean electricity - competing with every other decarbonisation use for the same resource.',
      '',
      'So this is a resource allocation problem, not only a chemistry problem: if clean hydrogen is scarce, is aviation where it should go?',
    ].join('\n'),
    whyItMatters: [
      {
        text: 'The IEA analyses aviation as a sector with limited alternatives to liquid fuels for long-haul operation.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['iea-aviation'],
      },
      {
        text: 'Aviation is commonly assessed as responsible for roughly 2-3% of global CO2 emissions, with additional non-CO2 warming effects that are less well quantified.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['iea-aviation', 'icct'],
      },
      {
        text: 'The magnitude of aviation non-CO2 (contrail) forcing carries wide uncertainty and is not resolved in this record.',
        kind: 'UNKNOWN',
        sourceKeys: [],
      },
    ],
    constraints: {
      budget:
        'Fuel is a large share of airline operating cost; multiples of jet fuel price require mandates.',
      time: 'Aircraft in service today fly into the 2045-2050 period.',
      geography: 'Feedstock availability is regional; fuel demand is concentrated at hub airports.',
      technology: 'Must be drop-in compatible with existing engines and fuel infrastructure.',
      political: 'Mandates create competitiveness concerns between jurisdictions.',
    },
    successCriteria: [
      {
        metric: 'SAF share of global jet fuel',
        target: 'Above 10% with verified life-cycle reduction over 70%',
        horizon: '2035',
        measurement: 'Fuel supply statistics plus certified LCA.',
      },
      {
        metric: 'Land-use change attributable to SAF feedstock',
        target: 'No net increase in cropland displacement',
        horizon: 'Continuous',
        measurement: 'Feedstock traceability and land-use monitoring.',
      },
    ],
    currentKnowledge: [
      {
        text: 'ICCT publishes technical analysis of aviation fuel pathways and policy.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['icct'],
      },
      {
        text: 'Clean hydrogen supply is the shared upstream constraint across synthetic fuel routes.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['iea-hydrogen'],
      },
      {
        text: 'Land-use competition between energy crops and food is assessed by IPCC in its land special report.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['ipcc-srccl'],
      },
    ],
    openQuestions: [
      'What is the realistic global ceiling on waste-oil feedstock?',
      'Is aviation the highest-value use of scarce clean hydrogen, or should it queue behind industry?',
      'Do contrail-avoidance routing strategies deliver more near-term forcing reduction per euro than SAF?',
      'Can synthetic fuel reach cost parity anywhere without a dedicated cheap-power enclave?',
    ],
    geographyLabel: 'Global',
    geographyScale: 'GLOBAL',
    countryCode: null,
    difficulty: 8,
    urgency: 6,
    status: 'OPEN',
    domains: ['transport', 'energy', 'climate'],
    sourceKeys: [
      'iea-aviation',
      'icct',
      'iea-hydrogen',
      'ipcc-srccl',
      'iea-transport',
      'itf-outlook',
    ],
  },

  {
    key: 'llm-citation-integrity',
    ref: '004831',
    slug: 'verifying-machine-generated-claims-in-scientific-literature-search',
    title: 'Verifying machine-generated claims against primary sources at literature-review scale',
    summary:
      'Language models accelerate literature review and also produce citations that do not support what they are attached to. At review scale, nobody checks every one.',
    description: [
      'Machine assistance in literature search is now ordinary. So is a failure mode: a generated summary attaches a real citation to a claim the cited paper does not make, or cites something that does not exist. Individually these are catchable. At the scale at which the tools are used - screening hundreds of papers - they are not, and errors propagate into work that is then itself cited.',
      '',
      'The engineering problem is claim-source entailment: given a statement and a candidate source, decide whether the source supports it, contradicts it, or is simply about something else. The systems problem is what to do at the point of use, since a verification step that costs more than the review it accelerates will be skipped.',
      '',
      "This problem sits inside the platform's own design: SAVE US rejects agent citations outside the retrieval set for exactly this reason, which is a crude version of what this problem asks for.",
    ].join('\n'),
    whyItMatters: [
      {
        text: "NIST's AI Risk Management Framework treats validity and reliability as core characteristics of trustworthy AI systems, with measurement as an explicit function.",
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['nist-ai-rmf'],
      },
      {
        text: 'The EU AI Act establishes obligations around transparency and risk management for certain AI systems.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['eu-ai-act'],
      },
      {
        text: 'The rate at which unsupported machine-generated citations enter published literature is UNKNOWN in this record.',
        kind: 'UNKNOWN',
        sourceKeys: [],
      },
    ],
    constraints: {
      budget: 'Verification must cost a small fraction of the time saved, or it will not be used.',
      time: 'Must operate at review speed - seconds per claim, not minutes.',
      geography:
        'Global; but full-text access is unevenly available, which limits verification for paywalled work.',
      technology:
        'Requires access to full text, not abstracts, for anything but the most superficial check.',
      political:
        'Publisher licensing restricts the corpora on which verification can legally operate.',
    },
    successCriteria: [
      {
        metric: 'Claim-source entailment accuracy on a held-out expert-annotated benchmark',
        target: 'Above 90% with calibrated abstention',
        horizon: '2027',
        measurement: 'Public benchmark with expert adjudication.',
      },
      {
        metric: 'Verification cost per claim',
        target: 'Under one cent',
        horizon: '2027',
        measurement: 'Measured inference cost at benchmark accuracy.',
      },
      {
        metric: 'Detected unsupported citations in a real review workflow',
        target: 'Measurable reduction versus unassisted review',
        horizon: '2028',
        measurement: 'Randomised trial in a systematic-review setting.',
      },
    ],
    currentKnowledge: [
      {
        text: 'Large open scholarly metadata catalogues exist and are queryable, which makes existence-checking of a citation tractable.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['openalex', 'crossref', 'semantic-scholar'],
      },
      {
        text: 'Existence of a citation is not support for a claim; entailment against full text is a different and harder problem.',
        kind: 'INFERENCE',
        sourceKeys: [],
      },
      {
        text: 'Transformer architectures underpin the systems in question.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['arxiv-attention'],
      },
    ],
    openQuestions: [
      'What is the actual base rate of unsupported citations in machine-assisted reviews?',
      'Can entailment be checked reliably against abstracts alone, or is full text mandatory?',
      'What interface makes a researcher act on a verification warning rather than dismiss it?',
      'Does abstention calibration matter more than raw accuracy for this use?',
    ],
    geographyLabel: 'Global',
    geographyScale: 'GLOBAL',
    countryCode: null,
    difficulty: 6,
    urgency: 7,
    status: 'ACTIVE_RESEARCH',
    domains: ['ai', 'other'],
    sourceKeys: [
      'nist-ai-rmf',
      'eu-ai-act',
      'openalex',
      'crossref',
      'semantic-scholar',
      'arxiv-attention',
      'arxiv',
      'stanford-ai-index',
      'zenodo',
    ],
  },

  {
    key: 'jakarta-subsidence',
    ref: '004832',
    slug: 'land-subsidence-and-flooding-in-coastal-megacities',
    title:
      'Halting groundwater-driven land subsidence in coastal megacities while keeping water supply',
    summary:
      'Parts of some coastal cities sink faster than the sea rises, mostly because of groundwater extraction. Stopping extraction requires a piped supply that does not exist.',
    description: [
      'In several coastal megacities, land subsidence driven by groundwater extraction outpaces sea-level rise as a cause of increasing flood exposure. The mechanism is well understood: withdrawing water compacts the aquifer, and much of that compaction is irreversible.',
      '',
      'The intervention is equally clear in principle - stop extracting - and blocked in practice: households and industry extract because the piped network does not reach them or does not deliver reliably. Ending extraction without first providing an alternative supply means taking water from people who have no other source.',
      '',
      'Sea walls treat the symptom and can worsen the incentive, since protection reduces the pressure to address extraction. The sequencing question - supply first, then restriction, at what pace and paid by whom - is the unsolved part.',
    ].join('\n'),
    whyItMatters: [
      {
        text: 'IPCC SROCC assesses rising relative sea level and increasing coastal flood exposure, noting that local land movement can dominate the local signal.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['ipcc-srocc', 'ipcc-ar6-wg2'],
      },
      {
        text: 'UN-Habitat documents the scale and growth of urban populations exposed to environmental risk in coastal cities.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['un-habitat-wcr'],
      },
      {
        text: 'WHO/UNICEF JMP monitoring documents large populations without safely managed piped water, which is the condition that drives private extraction.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['jmp-washdata'],
      },
    ],
    constraints: {
      budget:
        'Network extension is capital-intensive and competes with flood defence for the same municipal budget.',
      time: 'Compaction is largely irreversible, so delay permanently removes options.',
      geography: 'Dense, informal, low-lying urban areas with fragmented land tenure.',
      technology:
        'Subsidence monitoring via satellite interferometry is available; enforcement of extraction limits is not a technology problem.',
      political:
        'Restricting extraction before supply exists is politically impossible and ethically wrong.',
    },
    successCriteria: [
      {
        metric: 'Subsidence rate in the worst-affected districts',
        target: 'Below 1 cm/yr',
        horizon: '10 years',
        measurement: 'Satellite interferometry plus levelling benchmarks.',
      },
      {
        metric: 'Households with reliable piped supply in those districts',
        target: 'Above 90%',
        horizon: '10 years',
        measurement: 'Utility connection records plus service-continuity monitoring.',
      },
    ],
    currentKnowledge: [
      {
        text: 'Satellite interferometry data suitable for measuring subsidence at city scale is publicly available.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['copernicus-dataspace', 'nasa-earthdata'],
      },
      {
        text: 'Water service levels are monitored internationally with a defined service ladder.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['jmp-washdata'],
      },
      {
        text: 'Whether sea walls change the political incentive to address extraction is an INFERENCE, not an established finding.',
        kind: 'INFERENCE',
        sourceKeys: [],
      },
    ],
    openQuestions: [
      'What sequencing of supply extension and extraction restriction is fastest without leaving households dry?',
      'How much of the compaction is elastic and therefore recoverable?',
      'Can metering informal extraction be done at acceptable cost?',
      'Does flood protection reduce the political will to end extraction?',
    ],
    geographyLabel: 'Coastal megacities (South-East Asia)',
    geographyScale: 'CITY',
    countryCode: null,
    difficulty: 8,
    urgency: 9,
    status: 'OPEN',
    domains: ['cities', 'water', 'climate'],
    sourceKeys: [
      'ipcc-srocc',
      'ipcc-ar6-wg2',
      'un-habitat-wcr',
      'jmp-washdata',
      'copernicus-dataspace',
      'nasa-earthdata',
      'wri-aqueduct',
      'c40-knowledge',
    ],
  },

  {
    key: 'dengue-expansion',
    ref: '004833',
    slug: 'dengue-expansion-into-temperate-regions',
    title: 'Preventing established dengue transmission in newly suitable temperate regions',
    summary:
      'Vector suitability is expanding into regions with no clinical experience of the disease and no surveillance built for it. The window to prevent establishment is short.',
    description: [
      'Aedes mosquitoes have expanded their range, and regions that historically had no autochthonous dengue transmission now record local cases. Suitability is not the same as establishment: a region can have competent vectors and imported cases for years without sustained local transmission.',
      '',
      'That gap is the opportunity. Preventing establishment is far cheaper than controlling an endemic disease, but it requires surveillance sensitive enough to catch the first local cluster, clinical recognition in doctors who have never seen the disease, and vector control capacity that is typically absent where the disease has never been present.',
      '',
      'The unresolved questions are about thresholds and cost-effectiveness: how much surveillance is enough, and what triggers a response that is proportionate rather than theatrical.',
    ].join('\n'),
    whyItMatters: [
      {
        text: 'WHO documents dengue as a rapidly expanding arboviral disease with a growing number of countries reporting transmission.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['who-dengue'],
      },
      {
        text: 'The Lancet Countdown tracks climate-linked changes in the transmission suitability of vector-borne diseases.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['lancet-countdown'],
      },
      {
        text: 'ECDC maintains vector surveillance and distribution monitoring for Europe.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['ecdc'],
      },
    ],
    constraints: {
      budget:
        'Public health budgets do not fund surveillance for a disease that is not yet present.',
      time: 'Prevention of establishment is only possible before establishment.',
      geography: 'Southern Europe and comparable newly suitable temperate zones.',
      technology:
        'Vector control options are limited and some (novel biological control) face regulatory barriers.',
      political: 'Tourism-dependent regions have an incentive to under-report.',
    },
    successCriteria: [
      {
        metric: 'Time from first local case to detection',
        target: 'Under 14 days',
        horizon: '5 years',
        measurement: 'Retrospective outbreak reconstruction.',
      },
      {
        metric: 'Sustained local transmission seasons in newly suitable regions',
        target: 'Zero',
        horizon: '10 years',
        measurement: 'National notifiable-disease surveillance.',
      },
    ],
    currentKnowledge: [
      {
        text: 'Vector distribution monitoring exists in Europe and shows range expansion of competent vectors.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['ecdc'],
      },
      {
        text: 'WHO publishes guidance on dengue prevention and control in endemic settings.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['who-dengue'],
      },
      {
        text: 'Whether endemic-setting control measures transfer to pre-establishment settings is UNKNOWN in this record.',
        kind: 'UNKNOWN',
        sourceKeys: [],
      },
    ],
    openQuestions: [
      'What surveillance intensity minimises detection delay per euro?',
      'Does clinician awareness training measurably shorten time to diagnosis?',
      'What vector density threshold predicts establishment?',
      'Which control measure works in a temperate season structure?',
    ],
    geographyLabel: 'Southern Europe and newly suitable temperate zones',
    geographyScale: 'REGIONAL',
    countryCode: null,
    difficulty: 6,
    urgency: 8,
    status: 'ACTIVE_RESEARCH',
    domains: ['health', 'climate'],
    sourceKeys: [
      'who-dengue',
      'lancet-countdown',
      'ecdc',
      'ipcc-ar6-wg2',
      'who-gho',
      'santepublique-france',
      'ihme-gbd',
    ],
  },

  {
    key: 'cooling-demand',
    ref: '004834',
    slug: 'meeting-growing-cooling-demand-without-breaking-the-grid',
    title:
      'Meeting rapidly growing cooling demand in hot climates without breaking the evening peak',
    summary:
      'Air conditioning is a health necessity and a grid problem. Demand grows fastest exactly when solar output falls.',
    description: [
      'Access to cooling is a health intervention: it prevents deaths during heat episodes. Demand for it is growing fastest in hot, rapidly urbanising, rapidly enriching regions, and it will keep growing.',
      '',
      'The grid consequence is specific. Cooling load peaks in the late afternoon and evening, and stays high overnight during heat episodes - offset from solar generation. That means cooling growth drives the exact part of the load curve that is hardest and most carbon-intensive to serve, and it drives peak capacity requirements rather than just energy.',
      '',
      'Efficiency standards help but face a rebound: better appliances make cooling cheaper to run, which increases use. The open question is which combination of efficiency, passive building measures, thermal storage and tariff design bends the evening peak without rationing a health necessity.',
    ].join('\n'),
    whyItMatters: [
      {
        text: 'The IEA identifies space cooling as one of the fastest-growing sources of electricity demand in buildings.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['iea-cooling', 'iea-buildings'],
      },
      {
        text: 'WHO documents heat as a cause of excess mortality, which makes cooling access a health issue rather than a comfort issue.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['who-heat-health'],
      },
      {
        text: 'The size of the efficiency rebound effect for residential cooling is not established in this record.',
        kind: 'UNKNOWN',
        sourceKeys: [],
      },
    ],
    constraints: {
      budget:
        'Households buying their first air conditioner buy on purchase price, not lifetime cost.',
      time: 'The stock being installed now sets the peak load for 10-15 years.',
      geography: 'Hot, humid, rapidly urbanising regions.',
      technology: 'Passive measures depend on building design decisions already made.',
      political:
        'Electricity tariffs for residential consumers are politically sensitive in most of the affected countries.',
    },
    successCriteria: [
      {
        metric: 'Evening peak load growth per unit of cooling service delivered',
        target: 'Decoupled from cooling access growth',
        horizon: '2035',
        measurement: 'Utility load data against appliance stock surveys.',
      },
      {
        metric: 'Population with access to cooling during heat episodes',
        target: 'Increasing',
        horizon: '2035',
        measurement: 'Household surveys.',
      },
    ],
    currentKnowledge: [
      {
        text: 'IEA analysis covers cooling demand, appliance efficiency and buildings energy use.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['iea-cooling', 'iea-efficiency'],
      },
      {
        text: 'Building-sector energy and emissions are tracked internationally.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['globalabc'],
      },
      {
        text: 'Thermal storage shifting cooling load off-peak is technically established; its household economics are not addressed in this record.',
        kind: 'INFERENCE',
        sourceKeys: [],
      },
    ],
    openQuestions: [
      'Does a minimum efficiency standard or a purchase subsidy move the installed stock faster?',
      'What share of peak can building-level thermal storage realistically shift?',
      'How large is the rebound, and does it eat the efficiency gain?',
      'Can district cooling compete outside dense commercial districts?',
    ],
    geographyLabel: 'South and South-East Asia, Middle East',
    geographyScale: 'REGIONAL',
    countryCode: null,
    difficulty: 7,
    urgency: 8,
    status: 'OPEN',
    domains: ['energy', 'cities', 'health'],
    sourceKeys: [
      'iea-cooling',
      'iea-buildings',
      'iea-efficiency',
      'who-heat-health',
      'globalabc',
      'iea-electricity',
      'worldbank-wdi',
    ],
  },

  {
    key: 'battery-recycling',
    ref: '004835',
    slug: 'closing-the-lithium-battery-loop-before-the-first-large-retirement-wave',
    title: 'Closing the lithium battery loop before the first large retirement wave arrives',
    summary:
      'Recycling capacity is being built against a feedstock wave that has not arrived yet, for chemistries that are still changing.',
    description: [
      'Electric vehicle batteries last a long time, which is good for owners and awkward for recyclers: the retirement wave from the current deployment arrives in the 2030s. Recycling capacity is being built now, against uncertain volumes, for chemistries that are shifting - and the chemistry shift matters, because the economics of recycling depend heavily on how much cobalt and nickel the cell contains.',
      '',
      'There are three coupled unknowns: how much material actually returns (versus being exported, stockpiled, or reused in second-life applications), what recovery rate and purity is achievable at industrial scale, and whether recycled material is cost-competitive with primary supply at the time it becomes available.',
      '',
      'Getting this wrong in either direction is expensive: stranded recycling plants, or a supply crunch and a waste problem.',
    ].join('\n'),
    whyItMatters: [
      {
        text: 'The IEA assesses mineral demand growth for clean energy technologies and identifies supply concentration as a strategic risk.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['iea-critical-minerals'],
      },
      {
        text: "UNEP's International Resource Panel works on material flows and circularity at global scale.",
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['unep-resource-panel'],
      },
      {
        text: 'The fraction of retired EV batteries that will actually reach a recycler rather than being exported or stockpiled is UNKNOWN in this record.',
        kind: 'UNKNOWN',
        sourceKeys: [],
      },
    ],
    constraints: {
      budget:
        'Recycling must compete with primary extraction at the prevailing commodity price, which is volatile.',
      time: 'Plants take years to build; the feedstock wave is a decade out.',
      geography:
        'Collection is local, processing is regional, refining is concentrated in few countries.',
      technology:
        'Recovery rates differ sharply by chemistry and by pack design; disassembly is labour-intensive.',
      political:
        'Extended producer responsibility rules differ by jurisdiction and shape where material flows.',
    },
    successCriteria: [
      {
        metric: 'Collection rate of retired EV packs in a defined jurisdiction',
        target: 'Above 90%',
        horizon: '2035',
        measurement: 'Registration and end-of-life tracking.',
      },
      {
        metric: 'Battery-grade lithium recovery rate',
        target: 'Above 80% at industrial scale',
        horizon: '2035',
        measurement: 'Audited plant mass balance.',
      },
    ],
    currentKnowledge: [
      {
        text: 'Mineral demand scenarios under clean energy transitions are published and regularly updated.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['iea-critical-minerals', 'iea-ev'],
      },
      {
        text: 'Materials databases support the search for alternative chemistries that would change the recycling problem.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['materials-project', 'nature-gnome'],
      },
      {
        text: 'Second-life stationary use delays but does not remove the recycling requirement.',
        kind: 'INFERENCE',
        sourceKeys: [],
      },
    ],
    openQuestions: [
      'Does design-for-disassembly change recovery economics enough to justify mandating it?',
      'Which chemistry shift would most change the recycling business case?',
      'Does second-life use improve or worsen total system economics?',
      'How much of the retired stock leaves the jurisdiction before reaching a recycler?',
    ],
    geographyLabel: 'Global',
    geographyScale: 'GLOBAL',
    countryCode: null,
    difficulty: 7,
    urgency: 6,
    status: 'OPEN',
    domains: ['materials', 'energy', 'transport'],
    sourceKeys: [
      'iea-critical-minerals',
      'iea-ev',
      'unep-resource-panel',
      'materials-project',
      'nature-gnome',
      'espacenet',
      'oecd-data',
    ],
  },

  {
    key: 'cdr-mrv',
    ref: '004836',
    slug: 'measuring-and-verifying-durable-carbon-removal',
    title: 'Measuring and verifying durable carbon removal well enough to pay for it',
    summary:
      'Carbon removal is being bought at scale before the measurement of what was actually removed, and for how long, is settled.',
    description: [
      'Residual emissions in any credible net-zero pathway imply some durable carbon removal. Markets for it already exist, and money is moving. The measurement underneath is not equally mature.',
      '',
      'Two properties have to be established per tonne: additionality-adjusted net removal, and durability. For geological storage, durability is comparatively defensible. For enhanced weathering, ocean alkalinity enhancement and soil carbon, both quantification and durability are actively contested, and the measurement cost per tonne can approach the removal cost per tonne.',
      '',
      'The failure mode is specific and already visible in adjacent offset markets: if verification is weak, the cheapest supplier wins and it is cheap because it is not removing what it claims. That drives out the suppliers doing it properly.',
    ].join('\n'),
    whyItMatters: [
      {
        text: "The US National Academies' research agenda on negative emissions technologies assesses removal approaches and identifies measurement and verification as a cross-cutting research need.",
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['nasem-negative-emissions'],
      },
      {
        text: 'IPCC AR6 WGIII assesses carbon dioxide removal as a component of modelled mitigation pathways.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['ipcc-ar6-wg3'],
      },
      {
        text: 'Per-tonne verification cost for enhanced weathering and ocean alkalinity approaches is UNKNOWN in this record.',
        kind: 'UNKNOWN',
        sourceKeys: [],
      },
    ],
    constraints: {
      budget:
        'Verification cost must be a small fraction of removal cost or the market cannot function.',
      time: 'Durability claims span centuries to millennia; verification must happen now.',
      geography: 'Ocean-based approaches cross jurisdictional boundaries.',
      technology:
        'Direct measurement in open systems is extremely hard; models fill the gap and carry their own uncertainty.',
      political: 'Ocean interventions face international governance questions that are unresolved.',
    },
    successCriteria: [
      {
        metric: 'Verification uncertainty per tonne for at least two removal pathways',
        target: 'Below 20% at under 10% of removal cost',
        horizon: '2030',
        measurement: 'Independent audit against a published protocol.',
      },
      {
        metric: 'Adoption of a common durability accounting standard',
        target: 'Used by buyers representing a majority of purchased volume',
        horizon: '2030',
        measurement: 'Registry analysis.',
      },
    ],
    currentKnowledge: [
      {
        text: 'Atmospheric CO2 monitoring infrastructure is mature and public.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['noaa-co2-trends', 'global-carbon-budget'],
      },
      {
        text: 'Ocean carbon measurement programmes exist and provide the observational basis for marine approaches.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['noaa-pmel-carbon'],
      },
      {
        text: "Global-scale monitoring does not resolve a single project's removal; that is a different measurement problem.",
        kind: 'INFERENCE',
        sourceKeys: [],
      },
    ],
    openQuestions: [
      'What measurement design gets enhanced weathering below 20% uncertainty at acceptable cost?',
      'How should durability be discounted across pathways with different failure modes?',
      'Can a registry structure prevent a race to the cheapest unverifiable tonne?',
      'Who has standing to verify ocean-based removal in international waters?',
    ],
    geographyLabel: 'Global',
    geographyScale: 'GLOBAL',
    countryCode: null,
    difficulty: 9,
    urgency: 7,
    status: 'NEEDS_EVIDENCE',
    domains: ['climate', 'materials'],
    sourceKeys: [
      'nasem-negative-emissions',
      'ipcc-ar6-wg3',
      'noaa-co2-trends',
      'global-carbon-budget',
      'noaa-pmel-carbon',
      'iea-ccus',
      'ipcc-ar6-syr',
    ],
  },

  {
    key: 'soil-carbon',
    ref: '004837',
    slug: 'halting-soil-organic-carbon-loss-on-european-cropland',
    title: 'Halting soil organic carbon loss on European cropland without reducing yield',
    summary:
      'Practices that build soil carbon are known. Whether they hold at field scale, and whether farmers can afford the transition years, is not.',
    description: [
      'Soil organic carbon supports water retention, nutrient cycling and yield stability, and cropland soils in parts of Europe have been losing it. The practices associated with rebuilding it - reduced tillage, cover cropping, residue retention, diversified rotations - are known and in some places established.',
      '',
      'What is unresolved is quantitative and economic. Measured gains vary widely by soil type, climate and baseline, and some apparent gains are redistribution within the profile rather than net sequestration. Meanwhile the transition years often carry a yield penalty, and the farmer carries it alone.',
      '',
      'And measurement is expensive: detecting a real change in soil carbon stock against high spatial variability requires dense sampling, which costs more than the carbon is worth at current prices.',
    ].join('\n'),
    whyItMatters: [
      {
        text: "IPCC's land special report assesses soil carbon management among land-based mitigation options, with attention to permanence and saturation.",
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['ipcc-srccl'],
      },
      {
        text: "FAO's Global Soil Partnership works on soil degradation and soil carbon internationally.",
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['fao-soils'],
      },
      {
        text: 'The European Soil Data Centre maintains harmonised soil data for Europe, including organic carbon.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['jrc-esdac'],
      },
    ],
    constraints: {
      budget: 'Farm margins are thin; a multi-year yield dip is not absorbable without support.',
      time: 'Soil carbon changes slowly and saturates; measurable change takes 5-10 years.',
      geography: 'European cropland across very different soil and climate zones.',
      technology:
        'Reliable stock measurement requires dense sampling or well-calibrated proximal sensing.',
      political: 'Payment schemes must satisfy agricultural policy rules and audit requirements.',
    },
    successCriteria: [
      {
        metric: 'Soil organic carbon stock on enrolled cropland',
        target: 'No net loss, measured to 30 cm',
        horizon: '10 years',
        measurement: 'Stratified resampling with bulk density correction.',
      },
      {
        metric: 'Farm gross margin during transition',
        target: 'No decline versus matched control',
        horizon: '5 years',
        measurement: 'Farm accounts.',
      },
    ],
    currentKnowledge: [
      {
        text: 'Harmonised European soil datasets exist and support baseline estimation.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['jrc-esdac', 'eurostat'],
      },
      {
        text: 'FAO and IPCC both treat permanence and saturation as central caveats for soil carbon claims.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['fao-soils', 'ipcc-srccl'],
      },
      {
        text: 'Whether reduced tillage produces net sequestration or redistribution within the profile is CONTESTED.',
        kind: 'INFERENCE',
        sourceKeys: [],
      },
    ],
    openQuestions: [
      'What sampling design detects a real 5-year change at acceptable cost?',
      'Which practice combination works on heavy clay soils, where reduced tillage often fails?',
      'Can payment-for-practice avoid paying for outcomes that would have happened anyway?',
      'How large is the transition yield penalty, and for how many years?',
    ],
    geographyLabel: 'European Union cropland',
    geographyScale: 'CONTINENTAL',
    countryCode: null,
    difficulty: 7,
    urgency: 6,
    status: 'OPEN',
    domains: ['food', 'climate', 'biodiversity'],
    sourceKeys: [
      'ipcc-srccl',
      'fao-soils',
      'jrc-esdac',
      'eurostat',
      'fao-faostat',
      'eea-water',
      'unccd',
    ],
  },

  {
    key: 'pfas-removal',
    ref: '004838',
    slug: 'removing-pfas-from-municipal-drinking-water-affordably',
    title: 'Removing PFAS from municipal drinking water at a cost small utilities can carry',
    summary:
      'Treatment that works exists. It is expensive, it concentrates the problem into a waste stream, and small utilities serve the most affected communities.',
    description: [
      'Per- and polyfluoroalkyl substances are persistent, mobile and present in drinking water sources in many places. Regulatory limits have tightened, which converts a diffuse contamination problem into a specific compliance obligation for water utilities.',
      '',
      "Treatment technologies - granular activated carbon, ion exchange, high-pressure membranes - do remove PFAS. Three things are unresolved. Capital and operating cost per household is high and falls hardest on small systems with few ratepayers. The technologies concentrate PFAS into a spent medium or a reject stream that then has to be destroyed, and destruction at scale is itself unsettled. And source control, which would be cheaper than treating everything downstream, requires action on manufacturing and firefighting foam that is outside a utility's power.",
    ].join('\n'),
    whyItMatters: [
      {
        text: 'The US EPA maintains regulatory and technical material on PFAS in drinking water, including treatment approaches.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['epa-drinking-water-pfas', 'epa-pfas'],
      },
      {
        text: "WHO's drinking-water guidance frames the public-health basis for drinking water quality standards.",
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['who-drinking-water'],
      },
      {
        text: 'EFSA has assessed dietary exposure to PFAS in the European context.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['efsa'],
      },
    ],
    constraints: {
      budget:
        'Small utilities have few ratepayers to spread capital cost across; compliance can imply large rate increases.',
      time: 'Compliance deadlines are fixed and near.',
      geography:
        'Contamination is concentrated near specific industrial and firefighting-foam sites, but not only there.',
      technology:
        'Destruction of the concentrated waste stream is less mature than the separation step.',
      political:
        'Liability allocation between manufacturers, sites and utilities is contested and litigated.',
    },
    successCriteria: [
      {
        metric: 'Treatment cost per household for systems serving under 10,000 people',
        target: 'Under USD 100/yr',
        horizon: '2032',
        measurement: 'Utility cost reporting.',
      },
      {
        metric: 'Fate of removed PFAS',
        target: 'Destroyed, not landfilled or incinerated below destruction temperature',
        horizon: '2032',
        measurement: 'Waste tracking with destruction verification.',
      },
    ],
    currentKnowledge: [
      {
        text: 'EPA publishes treatment technology information for PFAS removal.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['epa-drinking-water-pfas'],
      },
      {
        text: 'Drinking water service levels and quality are monitored internationally.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['jmp-washdata', 'who-drinking-water'],
      },
      {
        text: 'Separation and destruction are distinct problems; solving the first without the second relocates the contamination.',
        kind: 'INFERENCE',
        sourceKeys: [],
      },
    ],
    openQuestions: [
      'Which destruction technology is verifiable at utility scale?',
      'Does regional consolidation of small utilities reduce cost per household enough to matter?',
      'What share of exposure is drinking water versus diet?',
      'Can source control deliver faster than treatment for the most affected catchments?',
    ],
    geographyLabel: 'United States and European Union',
    geographyScale: 'NATIONAL',
    countryCode: null,
    difficulty: 7,
    urgency: 8,
    status: 'ACTIVE_RESEARCH',
    domains: ['water', 'health', 'materials'],
    sourceKeys: [
      'epa-pfas',
      'epa-drinking-water-pfas',
      'who-drinking-water',
      'efsa',
      'jmp-washdata',
      'eea-water',
      'usgs-water',
    ],
  },

  {
    key: 'road-deaths-lmic',
    ref: '004839',
    slug: 'reducing-road-deaths-in-low-and-middle-income-countries',
    title:
      'Reducing road deaths in low- and middle-income countries where enforcement capacity is limited',
    summary:
      'The interventions that worked in high-income countries assume enforcement and vehicle standards. Most road deaths happen where neither is reliably present.',
    description: [
      'Road traffic injury is a leading cause of death for young people worldwide, and the burden is concentrated in low- and middle-income countries. The people killed are disproportionately pedestrians, cyclists and motorcyclists - road users who are not inside the vehicle.',
      '',
      'The standard intervention package - seat belt and helmet laws, speed enforcement, drink-driving enforcement, vehicle safety standards, post-crash care - is evidence-based and works where it is enforced. The difficulty is that most of it assumes enforcement capacity, functioning vehicle inspection and an emergency medical system.',
      '',
      'Which suggests a different emphasis: infrastructure that reduces speed and separates users physically does not need enforcement to work. How far that substitution goes, and at what cost per life saved, is the open question.',
    ].join('\n'),
    whyItMatters: [
      {
        text: 'WHO reports approximately 1.19 million road traffic deaths per year, with the large majority occurring in low- and middle-income countries.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['who-road-traffic'],
      },
      {
        text: 'Road injury appears as a leading cause of death among young people in global burden of disease estimates.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['ihme-gbd', 'who-gho'],
      },
      {
        text: 'Cost per life saved for infrastructure-led versus enforcement-led approaches is not established in this record.',
        kind: 'UNKNOWN',
        sourceKeys: [],
      },
    ],
    constraints: {
      budget: 'Infrastructure retrofits compete with new road construction for the same budget.',
      time: 'Measurable mortality change requires several years of consistent data.',
      geography: 'Rapidly motorising cities and intercity corridors.',
      technology:
        'Vehicle safety standards depend on a used-vehicle import market that is hard to regulate.',
      political:
        'Speed reduction is unpopular; enforcement capacity is limited and sometimes compromised.',
    },
    successCriteria: [
      {
        metric: 'Road deaths per 100,000 population in participating cities',
        target: 'Halved',
        horizon: '10 years',
        measurement: 'Police and health-system records, cross-validated.',
      },
      {
        metric: 'Share of high-risk corridors with physical speed reduction',
        target: 'Above 80%',
        horizon: '5 years',
        measurement: 'Infrastructure audit.',
      },
    ],
    currentKnowledge: [
      {
        text: 'WHO maintains global status reporting and technical guidance on road safety.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['who-road-traffic'],
      },
      {
        text: 'Transport and mobility statistics and projections are published internationally.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['itf-outlook', 'iea-transport'],
      },
      {
        text: 'Under-reporting of road deaths in police data relative to health data is a known measurement problem.',
        kind: 'INFERENCE',
        sourceKeys: ['who-road-traffic'],
      },
    ],
    openQuestions: [
      'What is the cost per life saved for physical speed reduction versus enforcement?',
      'Can used-vehicle import standards be enforced at the port rather than on the road?',
      'How much of the gap between police and health records is under-reporting versus definition?',
      'Does motorcycle-specific infrastructure work where motorcycles dominate?',
    ],
    geographyLabel: 'Low- and middle-income countries',
    geographyScale: 'GLOBAL',
    countryCode: null,
    difficulty: 6,
    urgency: 9,
    status: 'OPEN',
    domains: ['transport', 'health', 'cities'],
    sourceKeys: [
      'who-road-traffic',
      'ihme-gbd',
      'who-gho',
      'itf-outlook',
      'iea-transport',
      'worldbank-wdi',
      'un-habitat-wcr',
    ],
  },

  {
    key: 'datacentre-siting',
    ref: '004840',
    slug: 'siting-data-centre-demand-growth-without-displacing-decarbonisation',
    title: 'Absorbing data centre demand growth without displacing grid decarbonisation',
    summary:
      'Compute demand is growing fast and concentrating geographically. Whether it accelerates or delays clean electricity depends on siting and contracting rules that do not exist yet.',
    description: [
      'Electricity demand from data centres is growing, and it is unusually concentrated: a handful of regions carry a large share of new load, and interconnection queues there are long. Operators buy clean power, but the accounting is usually annual and system-wide, which means a facility can be "100% renewable" on paper while drawing fossil generation at the hours it actually runs.',
      '',
      'There are two possible futures. New load arrives with firm, additional clean generation and flexible operation, and effectively finances grid build-out. Or it arrives faster than clean supply and is served by extending the life of fossil plant, displacing decarbonisation that would otherwise have happened.',
      '',
      'Which future occurs is decided by siting rules, interconnection reform and procurement standards - not by the technology.',
    ].join('\n'),
    whyItMatters: [
      {
        text: 'The IEA tracks data centre and data transmission electricity demand as a distinct and growing category.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['iea-data-centres'],
      },
      {
        text: 'IEA grid analysis identifies connection queues and grid investment as constraints on adding new load and new clean generation alike.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['iea-grids'],
      },
      {
        text: 'The marginal emissions consequence of a new data centre in a specific region is UNKNOWN in this record and depends on local dispatch.',
        kind: 'UNKNOWN',
        sourceKeys: [],
      },
    ],
    constraints: {
      budget:
        'Operators optimise for latency, land and power price; siting rules must work with that, not against it.',
      time: 'Facilities are built in 2-3 years; transmission takes 8-12.',
      geography: 'Load concentrates in a few regions with existing fibre and land.',
      technology:
        'Workload flexibility exists for training, far less for inference and latency-sensitive services.',
      political: 'Local opposition focuses on water and land use as much as electricity.',
    },
    successCriteria: [
      {
        metric: 'Hourly matched clean supply for new large loads',
        target: 'Above 90% on an hourly basis, not annual',
        horizon: '2032',
        measurement: 'Hourly settlement data against generation certificates.',
      },
      {
        metric: 'Fossil plant retirement schedule in affected regions',
        target: 'Not delayed by new load',
        horizon: '2032',
        measurement: 'Retirement filings versus pre-announcement baseline.',
      },
    ],
    currentKnowledge: [
      {
        text: 'IEA publishes analysis of data centre energy use and of electricity system constraints.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['iea-data-centres', 'iea-electricity'],
      },
      {
        text: 'The AI Index reports on compute and deployment trends in AI systems.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['stanford-ai-index'],
      },
      {
        text: 'Annual matching and hourly matching can give opposite answers about whether a load is clean.',
        kind: 'INFERENCE',
        sourceKeys: [],
      },
    ],
    openQuestions: [
      'What share of data centre load is genuinely time-flexible?',
      'Does hourly matching change siting decisions, or only accounting?',
      'Can interconnection reform deliver fast enough to matter?',
      'Is co-located generation additional, or does it merely relabel existing supply?',
    ],
    geographyLabel: 'Global, concentrated in a few grid regions',
    geographyScale: 'GLOBAL',
    countryCode: null,
    difficulty: 7,
    urgency: 8,
    status: 'ACTIVE_RESEARCH',
    domains: ['ai', 'energy', 'climate'],
    sourceKeys: [
      'iea-data-centres',
      'iea-grids',
      'iea-electricity',
      'stanford-ai-index',
      'nist-ai-rmf',
      'eia-aeo',
      'iea-efficiency',
    ],
  },
  {
    key: 'long-horizon-models',
    ref: '004841',
    slug: 'which-long-horizon-world-models-have-tracked-reality',
    title:
      'Establishing which long-horizon world models tracked reality, and what that implies for the ones guiding policy now',
    summary:
      'World3 in 1972, the Charney report in 1979, the first climate projections: some long-range models have held up remarkably well and some have not. Nobody scores them systematically, so we keep arguing about forecasting instead of learning from it.',
    description: [
      'Decisions about energy, land, materials and population rest on models that project decades ahead. Some of those models are now old enough to be checked against what actually happened, which is an unusual and valuable situation: a forecast with fifty years of out-of-sample data attached to it.',
      '',
      'The record is genuinely mixed, and that is the interesting part. The Charney report in 1979 stated a climate sensitivity range that later work did not overturn. Evaluations of early climate projections have found that many of them tracked subsequent warming closely once actual emissions are accounted for. World3, the system-dynamics model behind The Limits to Growth (1972), has been compared against observed data by later authors with results that are argued about to this day - partly because the model produced scenarios rather than predictions, and comparing a scenario to history is not a well-defined operation.',
      '',
      'That ambiguity is the problem. There is no agreed protocol for scoring a long-horizon structural model after the fact: what counts as a hit, how to handle a conditional projection whose condition did not hold, how to separate a wrong structure from wrong inputs. Without one, the debate stays rhetorical - "the doomers were wrong" against "the warnings were right" - and the models now being used to justify decisions inherit no accumulated evidence about which modelling choices actually predict.',
      '',
      'This problem sits at the centre of what SAVE US is for. It is not about whether a particular 1972 report was right. It is about building the scoring method that would let us say so, and about applying it to the models in use today.',
    ].join('\n'),
    whyItMatters: [
      {
        text: 'The Charney report (National Academy of Sciences, 1979) set out an early assessment of the climate response to carbon dioxide; its range has been repeatedly revisited by later assessments, which makes it one of the longest-running tests of a physical projection available.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['charney-report', 'ipcc-ar6-wg1'],
      },
      {
        text: 'Hausfather et al. (2020) evaluated the performance of past climate model projections against subsequent observations in Geophysical Research Letters - the kind of retrospective scoring this problem asks to generalise beyond climate.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['hausfather-projections'],
      },
      {
        text: 'The Limits to Growth (1972) and the World3 model remain in active dispute half a century later; Herrington (2021) compared World3 scenario output with empirical data in the Journal of Industrial Ecology, and the interpretation of that comparison is itself contested.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['limits-to-growth', 'herrington-world3'],
      },
      {
        text: 'There is no agreed scoring protocol for long-horizon structural models. What fraction of published long-range projections has ever been formally evaluated after the fact is UNKNOWN in this record.',
        kind: 'UNKNOWN',
        sourceKeys: [],
      },
    ],
    constraints: {
      budget:
        'Retrospective evaluation is cheap in equipment and expensive in expert judgement; the binding cost is the time of people who understand both the model and the data.',
      time: 'Every year without a protocol is another cohort of projections that will be argued about instead of scored.',
      geography: 'Global. The models in question are global by construction.',
      technology:
        'Requires running or reconstructing historical model versions, several of which exist only as published output rather than as runnable code.',
      political:
        'Scoring is adversarial by nature: institutions whose projections are being graded have an interest in the grading rules.',
    },
    successCriteria: [
      {
        metric:
          'Published, pre-registered scoring protocol for long-horizon structural projections',
        target:
          'Applied by at least three independent groups to the same model set with consistent results',
        horizon: '2030',
        measurement:
          'Published protocol plus independent replications scoring the same projections.',
      },
      {
        metric: 'Long-range projections scored under that protocol',
        target: 'At least 50, spanning climate, energy, population and resources',
        horizon: '2032',
        measurement: 'Open scoring registry with the input data, the conditionals and the scores.',
      },
      {
        metric: 'Conditional projections handled explicitly',
        target:
          "Every score states whether the projection's stated conditions held, and adjusts accordingly",
        horizon: 'At protocol publication',
        measurement:
          'Protocol review against a set of deliberately conditional historical projections.',
      },
    ],
    currentKnowledge: [
      {
        text: 'Retrospective evaluation has been done well in at least one domain: past climate model projections have been compared against observations with explicit handling of the emissions the models assumed.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['hausfather-projections'],
      },
      {
        text: 'Integrated assessment modelling infrastructure and scenario databases exist and are maintained, which means the modern projections are at least archived in a comparable form.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: ['iiasa', 'ipcc-ar6-wg3'],
      },
      {
        text: 'Long-run observational series exist for most of the quantities the old models projected: emissions, temperature, population, resource extraction and land use.',
        kind: 'SOURCE_CLAIM',
        sourceKeys: [
          'global-carbon-budget',
          'un-wpp',
          'our-world-in-data',
          'global-footprint-network',
        ],
      },
      {
        text: 'The planetary boundaries framework is a separate, later attempt to state global limits in a form that can be monitored; whether it is more falsifiable than the 1972 framing is an INFERENCE, not an established result.',
        kind: 'INFERENCE',
        sourceKeys: ['planetary-boundaries'],
      },
      {
        text: 'A scenario is not a prediction. Scoring one as though it were is a category error, and no widely accepted method exists for scoring it correctly.',
        kind: 'INFERENCE',
        sourceKeys: ['limits-to-growth', 'club-of-rome'],
      },
    ],
    openQuestions: [
      'What is a defensible scoring rule for a projection whose stated conditions did not hold?',
      'Can a wrong structure be separated from wrong inputs, after the fact, with the data that survives?',
      'Which modelling choices in the models that tracked reality are absent from the models that did not?',
      'Does aggregate-level system dynamics predict better or worse than disaggregated sectoral modelling over 30+ years?',
      'How much of the World3 dispute is about the model, and how much about what "business as usual" was taken to mean?',
    ],
    geographyLabel: 'Global',
    geographyScale: 'GLOBAL',
    countryCode: null,
    difficulty: 8,
    urgency: 6,
    status: 'NEEDS_EVIDENCE',
    domains: ['other', 'ai', 'climate'],
    sourceKeys: [
      'limits-to-growth',
      'club-of-rome',
      'herrington-world3',
      'hausfather-projections',
      'charney-report',
      'iiasa',
      'planetary-boundaries',
      'un-wpp',
      'global-footprint-network',
      'global-carbon-budget',
      'ipcc-ar6-wg1',
      'ipcc-ar6-wg3',
      'our-world-in-data',
      'giss-publications',
      'stanford-ai-index',
    ],
  },
];
