import type { AgentRole, EvidenceStance, HypothesisStatus } from '@saveus/common';

/**
 * Seed hypotheses.
 *
 * DEMO DATA. These are plausible research proposals written for this dataset so
 * that the workflow can be exercised end to end. They are not positions taken
 * by any researcher or institution.
 *
 * The evidence attached to them is real: each row points at a real source
 * record and states what that source is, not what someone wishes it said. Where
 * a hypothesis needs a number nobody here has, the field says UNKNOWN.
 */

export interface SeedEvidence {
  sourceKey: string;
  stance: EvidenceStance;
  claim: string;
  strength: number;
}

export interface SeedHypothesis {
  key: string;
  problemKey: string;
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
  status: HypothesisStatus;
  /** Index into SEED_USERS, or null when the hypothesis came from an agent. */
  authorIndex: number | null;
  authorAgentRole: AgentRole | null;
  evidence: SeedEvidence[];
}

export const SEED_HYPOTHESES: readonly SeedHypothesis[] = [
  // ------------------------------------------------------------ paris-heat
  {
    key: 'paris-cool-roofs',
    problemKey: 'paris-heat',
    ref: '010401',
    title:
      'High-albedo roof coatings on top-floor dwellings cut indoor peak temperature enough to matter for mortality',
    claim:
      'Applying a rated high-albedo coating to the roofs above uninsulated top-floor dwellings in Paris reduces indoor operative temperature during heat episodes by at least 2 °C, and that reduction is large enough to produce a detectable fall in heat mortality in the treated population.',
    mechanism:
      'Zinc and dark bituminous roofs over uninsulated top-floor dwellings absorb a large fraction of incident shortwave radiation and conduct it into the dwelling below, where there is little thermal mass to buffer it. A coating with high solar reflectance and high thermal emittance reduces absorbed radiation and increases radiative loss to the sky. Because the roof assembly is thin and uninsulated, the change propagates to indoor temperature within hours rather than being absorbed by the structure. Lower indoor peak temperature reduces cumulative heat strain on occupants, which is the exposure that epidemiological models link to excess mortality.',
    expectedImpact:
      'A 2-4 °C reduction in indoor peak during episodes for treated dwellings. Population-level mortality effect depends on what share of the at-risk population lives in this typology, which is not established.',
    assumptions: [
      'Top-floor uninsulated dwellings carry disproportionate heat-mortality risk in Paris',
      'Indoor temperature, not ambient street temperature, is the dominant exposure for the vulnerable population',
      'Coatings retain their reflectance under Paris soiling and weathering over at least five years',
      'Heritage rules permit coating on a meaningful share of the affected roof area',
    ],
    unknowns: [
      'The share of Paris heat deaths occurring in top-floor uninsulated dwellings',
      'Winter heating penalty at Paris latitude and whether it offsets the summer benefit in energy or in mortality terms',
      'Reflectance retention curve for these coatings under urban soiling',
    ],
    risks: [
      'Heating-season penalty could increase winter energy poverty in the same households',
      'Glare complaints from overlooking buildings in dense fabric',
      'Treating roofs may displace attention from the isolated-occupant problem, which may matter more',
    ],
    estimatedCost:
      'Order of EUR 20-40 per square metre of roof applied, excluding access; per-dwelling cost UNKNOWN because roof area per dwelling in this typology is not recorded here',
    estimatedScalability:
      'Bounded by treatable roof area under heritage rules - not quantified in this record',
    validationMethod:
      'Paired-dwelling field trial: at least 80 matched top-floor dwellings, half treated, indoor temperature logged at 10-minute resolution across two summers, with a pre-registered analysis of peak and degree-hours above threshold. Mortality effect cannot be established at this sample size and would require a subsequent cluster design.',
    status: 'TESTABLE',
    authorIndex: 0,
    authorAgentRole: null,
    evidence: [
      {
        sourceKey: 'cool-roof-rating-council',
        stance: 'SUPPORTS',
        claim:
          'Maintains a directory of independently measured solar reflectance and thermal emittance values for commercially available roofing products, which is the input this mechanism requires.',
        strength: 4,
      },
      {
        sourceKey: 'lbnl-heat-island',
        stance: 'SUPPORTS',
        claim:
          'Research group dedicated to cool surfaces and urban heat islands; the reference body of work for the radiative mechanism proposed here.',
        strength: 4,
      },
      {
        sourceKey: 'who-heat-health',
        stance: 'SUPPORTS',
        claim:
          'Establishes heat exposure as a cause of excess mortality and identifies the population groups this intervention targets.',
        strength: 4,
      },
      {
        sourceKey: 'ipcc-ar6-wg2',
        stance: 'CONTEXT',
        claim:
          'Assesses European urban heat risk and the adaptation options under consideration, providing the framing for this class of intervention.',
        strength: 3,
      },
      {
        sourceKey: 'iea-buildings',
        stance: 'CONTRADICTS',
        claim:
          'Buildings analysis treats envelope measures as heating-and-cooling trade-offs; at Paris latitude the winter penalty is a real cost this hypothesis has not quantified.',
        strength: 2,
      },
    ],
  },
  {
    key: 'paris-cooled-refuges',
    problemKey: 'paris-heat',
    ref: '010402',
    title:
      'Network of cooled refuges within 300 m of every resident outperforms per-dwelling measures',
    claim:
      'A dense network of publicly accessible cooled spaces, reachable within a 300 m walk, reduces heat mortality more per euro than any per-dwelling retrofit, because it concentrates the intervention on hours of peak risk rather than on building fabric.',
    mechanism:
      'Heat mortality is driven by cumulative strain over an episode rather than by a single instantaneous temperature. Interrupting exposure for several hours a day allows physiological recovery. Existing air-conditioned public buildings - libraries, municipal halls, some commercial spaces - already provide this capacity; the intervention is making them reliably open, known, and walkable rather than building new ones. The 300 m radius is chosen because it is the distance an older adult with reduced mobility will actually walk in heat.',
    expectedImpact:
      'Effect size UNKNOWN. The hypothesis is explicitly comparative: it claims better cost-effectiveness than fabric measures, not a specific mortality reduction.',
    assumptions: [
      'Interrupted exposure produces meaningful physiological recovery',
      'The most at-risk residents are physically able to reach a refuge',
      'Existing air-conditioned public buildings have spare capacity during episodes',
    ],
    unknowns: [
      'Whether the highest-risk group - isolated, mobility-limited older adults - uses refuges at all',
      'The number of hours per day of interrupted exposure needed for a mortality effect',
    ],
    risks: [
      'Refuges may be used mostly by people who were not at high risk, producing an apparent benefit with no mortality effect',
      'Cooling public buildings increases peak electricity demand during exactly the hours the grid is stressed',
    ],
    estimatedCost:
      'Marginal: primarily operating hours and staffing of existing buildings. Capital cost only where cooling must be added.',
    estimatedScalability:
      'Limited by the existing stock of suitable public buildings and their distribution, which is uneven across arrondissements',
    validationMethod:
      'Instrument refuges with anonymous entry counting, link to address-level demographic data, and compare episode mortality between arrondissements with high and low refuge density using a difference-in-differences design across multiple episodes.',
    status: 'UNDER_REVIEW',
    authorIndex: 3,
    authorAgentRole: null,
    evidence: [
      {
        sourceKey: 'who-heat-health',
        stance: 'SUPPORTS',
        claim:
          'Heat-health action planning, including access to cool environments, is WHO-recommended practice.',
        strength: 4,
      },
      {
        sourceKey: 'climate-adapt',
        stance: 'SUPPORTS',
        claim:
          'European adaptation platform documenting municipal adaptation measures of this type.',
        strength: 3,
      },
      {
        sourceKey: 'apur',
        stance: 'CONTEXT',
        claim:
          'Paris urban planning agency; the source of the building and demographic data any siting analysis would need.',
        strength: 3,
      },
      {
        sourceKey: 'iea-cooling',
        stance: 'CONTRADICTS',
        claim:
          'Cooling demand analysis implies that expanding cooled public space adds to the same evening peak that heat episodes already stress.',
        strength: 3,
      },
    ],
  },
  {
    key: 'paris-risk-registry',
    problemKey: 'paris-heat',
    ref: '010403',
    title:
      'Pre-episode identification of at-risk residents is the binding constraint, not the physical intervention',
    claim:
      'The dominant source of avoidable heat deaths in Paris is failure to reach isolated at-risk residents during an episode, not the thermal performance of their dwelling; therefore investment in identification and contact outperforms investment in building fabric.',
    mechanism:
      'Heat deaths concentrate among people who are simultaneously physiologically vulnerable and socially isolated. Social isolation prevents the ordinary mechanism by which heat strain is noticed and interrupted - someone checking. A maintained registry combined with an active contact protocol during episodes substitutes for that missing social signal. The intervention is organisational, not physical, which is why it can be deployed in a single summer.',
    expectedImpact:
      'UNKNOWN. This hypothesis is a claim about where the binding constraint sits, and its value is that it is falsifiable against the fabric hypotheses.',
    assumptions: [
      'A substantial share of heat deaths occur in people who had no contact during the episode',
      'Voluntary registries reach the isolated population rather than the already-connected one',
      'Contact during an episode changes behaviour or triggers intervention',
    ],
    unknowns: [
      'Registry coverage of the actually-isolated population',
      'Whether contact alone changes outcomes without a physical place to send people',
    ],
    risks: [
      'Registries systematically miss the most isolated people, who are the ones at risk',
      'Data protection constraints may prevent the linkage needed to make a registry useful',
    ],
    estimatedCost:
      'Low capital, ongoing staffing. Order of magnitude below fabric intervention per person reached.',
    estimatedScalability: 'High within a municipality; depends entirely on registration uptake',
    validationMethod:
      'Retrospective case-control study of heat deaths in past episodes, coding contact status and dwelling typology, to estimate the relative contribution of isolation versus fabric. This is observational and cannot establish causation on its own.',
    status: 'NEEDS_EVIDENCE',
    authorIndex: 7,
    authorAgentRole: null,
    evidence: [
      {
        sourceKey: 'who-heat-health',
        stance: 'SUPPORTS',
        claim: 'Identifies social isolation among the risk factors for heat-related mortality.',
        strength: 4,
      },
      {
        sourceKey: 'santepublique-france',
        stance: 'CONTEXT',
        claim:
          'National public health agency; holder of the surveillance data this hypothesis would need to test.',
        strength: 3,
      },
      {
        sourceKey: 'insee-statistics',
        stance: 'CONTEXT',
        claim:
          'National statistics office; source of the household composition and isolation data required to define the at-risk population.',
        strength: 3,
      },
    ],
  },

  // ----------------------------------------------------------- dunkelflaute
  {
    key: 'dunkelflaute-hydrogen',
    problemKey: 'dunkelflaute',
    ref: '010404',
    title:
      'Hydrogen in salt caverns is the only candidate that scales to multi-day European shortfalls',
    claim:
      'For events longer than roughly 48 hours across the interconnected north-west European area, hydrogen stored in salt caverns and burned in converted turbines is cheaper per unit of delivered energy than any electrochemical or thermal alternative, despite its poor round-trip efficiency.',
    mechanism:
      'Storage technologies split into a power cost and an energy cost. Electrochemical storage has a high energy cost, so its economics degrade as duration grows. Geological hydrogen storage has a very low marginal energy cost once the cavern exists, so the poor round-trip efficiency is paid once on the energy that is actually cycled, while the cavern covers duration almost for free. Beyond a crossover duration, this dominates. The claim is that the crossover sits below the duration of real European wind lulls.',
    expectedImpact:
      'Determines which asset class receives investment this decade. The crossover duration is the decision-relevant number.',
    assumptions: [
      'Suitable salt geology exists within reach of demand centres in north-west Europe',
      'Turbines can be converted to high-hydrogen-fraction combustion at acceptable cost',
      'Electrolysis capacity can be sized against surplus hours rather than against continuous operation',
    ],
    unknowns: [
      'The crossover duration in delivered-cost terms',
      'Cavern cycling limits and how often storage can actually be filled and emptied per year',
      'Whether hydrogen transport to the turbine exists or must be built',
    ],
    risks: [
      'Round-trip efficiency near 35% multiplies the renewable overbuild requirement',
      'Competing industrial demand may price hydrogen out of the power sector',
      'Cavern availability is geographically concentrated, which creates a new dependency',
    ],
    estimatedCost:
      'UNKNOWN at system level; component costs are published but the portfolio cost depends on sizing assumptions that are not fixed here',
    estimatedScalability: 'Bounded by salt geology and by electrolyser deployment rate',
    validationMethod:
      'Whole-system capacity-expansion model over at least 30 years of ERA5 reanalysis weather, with the crossover duration as the reported output and a published sensitivity analysis on efficiency, capital cost and cavern availability.',
    status: 'SIMULATION',
    authorIndex: 1,
    authorAgentRole: null,
    evidence: [
      {
        sourceKey: 'iea-hydrogen',
        stance: 'SUPPORTS',
        claim:
          'Assesses hydrogen among candidate routes for long-duration and seasonal energy storage.',
        strength: 4,
      },
      {
        sourceKey: 'copernicus-cds',
        stance: 'SUPPORTS',
        claim:
          'Provides the multi-decade ERA5 reanalysis data required to reconstruct historical low-output events at the necessary resolution.',
        strength: 5,
      },
      {
        sourceKey: 'rte-futurs-2050',
        stance: 'SUPPORTS',
        claim:
          'National system study that treats flexibility and firm capacity as explicit requirements under high-renewable scenarios.',
        strength: 4,
      },
      {
        sourceKey: 'nrel-atb',
        stance: 'CONTEXT',
        claim:
          'Annually updated technology cost baseline; the input any crossover calculation depends on.',
        strength: 4,
      },
      {
        sourceKey: 'doe-storage-challenge',
        stance: 'CONTRADICTS',
        claim:
          'Long-duration storage programme covering electrochemical and thermal routes that compete with the hydrogen pathway proposed here.',
        strength: 2,
      },
    ],
  },
  {
    key: 'dunkelflaute-interconnection',
    problemKey: 'dunkelflaute',
    ref: '010405',
    title: 'Extended interconnection to climatically decorrelated regions beats domestic storage',
    claim:
      'Transmission to regions whose wind and solar output is weakly correlated with north-west Europe delivers firm energy during lulls at lower whole-system cost than domestic long-duration storage.',
    mechanism:
      'A wind lull is a weather system of finite spatial extent. Beyond its footprint, generation continues. Transmission converts a spatial decorrelation into a temporal one: instead of storing energy over days, the system imports it over distance. Because transmission capital scales with power rather than energy, it does not suffer the duration penalty that electrochemical storage does.',
    expectedImpact:
      'Would redirect investment from storage assets to transmission corridors, with very different lead times and political requirements.',
    assumptions: [
      'Decorrelation is strong enough at the distances involved to be relied on during the worst events',
      'Exporting regions have surplus at exactly those hours',
      'Cross-border capacity is available under scarcity rather than curtailed by national rules',
    ],
    unknowns: [
      'Measured correlation length of European wind lulls in the reanalysis record',
      'Whether interconnection can be permitted on the required timescale',
    ],
    risks: [
      'Political dependence on the export region during scarcity is a security question, not only an economic one',
      'Permitting timelines for long transmission routinely exceed a decade',
      'Correlation may be stronger than assumed exactly during the extreme events that matter',
    ],
    estimatedCost: null,
    estimatedScalability: 'High in principle; constrained by permitting rather than by technology',
    validationMethod:
      'Compute spatial correlation of residual load across candidate regions over 30+ years of reanalysis, then run an adequacy model with and without the interconnector under historical worst-case events.',
    status: 'CONTESTED',
    authorIndex: 5,
    authorAgentRole: null,
    evidence: [
      {
        sourceKey: 'iea-grids',
        stance: 'SUPPORTS',
        claim:
          'Identifies grid capacity and interconnection as a central constraint on secure clean-electricity transitions.',
        strength: 4,
      },
      {
        sourceKey: 'copernicus-cds',
        stance: 'SUPPORTS',
        claim:
          'Supplies the reanalysis dataset needed to measure the correlation this hypothesis depends on.',
        strength: 5,
      },
      {
        sourceKey: 'rte-futurs-2050',
        stance: 'CONTRADICTS',
        claim:
          'National adequacy study that treats domestic firm capacity as necessary rather than substitutable by imports under stress.',
        strength: 3,
      },
    ],
  },
  {
    key: 'dunkelflaute-demand',
    problemKey: 'dunkelflaute',
    ref: '010406',
    title:
      'Industrial demand flexibility is cheaper than any supply-side answer and is systematically undercounted',
    claim:
      'Contracted multi-day curtailment of electricity-intensive industry covers a large fraction of European multi-day shortfall at a cost below both storage and retained gas capacity, and current adequacy studies undercount it because they model demand as inelastic.',
    mechanism:
      'Electrolysis, aluminium smelting, chlor-alkali and some data centre workloads have production that can be deferred if the plant is compensated. Deferral is cheap relative to building an asset that sits idle for most of the year, because the plant already exists and the cost is foregone production rather than capital. Adequacy models that hold demand fixed cannot see this resource and therefore overstate the need for firm capacity.',
    expectedImpact:
      'If correct, reduces the firm capacity requirement substantially and cheaply. If wrong, the system is short exactly when it cannot afford to be.',
    assumptions: [
      'Industrial plants can defer production for days, not only hours, without damage',
      'Compensation acceptable to the plant is below the cost of the alternative asset',
      'Deferral does not simply relocate production and its emissions elsewhere',
    ],
    unknowns: [
      'Actual deferrable industrial load in Europe, by duration',
      'Whether firms will contract for multi-day curtailment at any realistic price',
    ],
    risks: [
      'Flexibility that exists on paper may not deliver when every consumer faces the same event',
      'Repeated curtailment may accelerate industrial relocation, which is a policy outcome nobody chose',
    ],
    estimatedCost:
      'Compensation cost UNKNOWN; the hypothesis claims it is below the alternatives but does not yet establish that',
    estimatedScalability:
      'Bounded by the size of the electricity-intensive industrial base, which is itself shrinking in Europe',
    validationMethod:
      'Survey of contracted and technically available industrial flexibility by duration band, followed by an adequacy model run with elastic demand, compared against the same model with inelastic demand.',
    status: 'NEEDS_EVIDENCE',
    authorIndex: 9,
    authorAgentRole: null,
    evidence: [
      {
        sourceKey: 'iea-efficiency',
        stance: 'SUPPORTS',
        claim: 'Covers demand-side response among system flexibility measures.',
        strength: 3,
      },
      {
        sourceKey: 'iea-electricity',
        stance: 'SUPPORTS',
        claim:
          'System analysis treating flexibility as a distinct requirement alongside generation adequacy.',
        strength: 3,
      },
      {
        sourceKey: 'iea-grids',
        stance: 'CONTEXT',
        claim:
          'Frames the grid and flexibility constraint this hypothesis proposes to relieve from the demand side.',
        strength: 3,
      },
    ],
  },

  // ------------------------------------------------------ cement-process-co2
  {
    key: 'cement-calcined-clay',
    problemKey: 'cement-process-co2',
    ref: '010407',
    title:
      'Calcined clay and limestone blends can displace a third of clinker within existing codes',
    claim:
      'Limestone calcined clay blends can reduce clinker content by around a third at equivalent structural performance for most common applications, using clay deposits already within economic reach of existing plants, and without requiring new structural codes.',
    mechanism:
      'Calcining kaolinitic clay at roughly 800 °C - well below clinker temperature and without releasing mineral CO2 - produces a reactive pozzolan. Combined with limestone filler, it reacts with the calcium hydroxide released during cement hydration, contributing to strength development rather than acting as inert filler. Because the resulting binder falls within existing composite-cement standards in several jurisdictions, adoption does not require code change, which removes the slowest step.',
    expectedImpact:
      'Roughly proportional reduction in process CO2 per tonne of binder for the displaced clinker fraction.',
    assumptions: [
      'Suitable kaolinitic clay is available near a meaningful share of existing plants',
      'Early-age strength development is acceptable for common construction schedules',
      'Existing composite-cement standards already accommodate the blend',
    ],
    unknowns: [
      'Global distribution of suitable clay relative to cement plant locations',
      'Long-term durability in aggressive exposure classes',
      'Whether clay calcination capacity can be added at existing sites or requires new plant',
    ],
    risks: [
      'Slower early strength changes construction schedules, which the industry resists',
      'Clay quality variability may require per-deposit qualification, adding cost',
      'Carbonation resistance may differ from ordinary Portland cement in ways that matter for reinforcement',
    ],
    estimatedCost:
      'Comparable to or below ordinary Portland cement where clay is local, because calcination uses less energy than clinkering',
    estimatedScalability: 'Bounded by clay deposit distribution - the key unresolved quantity',
    validationMethod:
      'Compile global clay suitability against plant locations from public geological surveys, then a multi-year exposure programme on cast specimens across defined exposure classes with published results.',
    status: 'PROMISING',
    authorIndex: 2,
    authorAgentRole: null,
    evidence: [
      {
        sourceKey: 'iea-cement',
        stance: 'SUPPORTS',
        claim:
          'Identifies clinker substitution, including calcined clay, among the principal near-term abatement routes for cement.',
        strength: 4,
      },
      {
        sourceKey: 'gcca-concrete-future',
        stance: 'SUPPORTS',
        claim:
          'Industry net-zero roadmap that includes clinker substitution as a major contributor to its own abatement pathway.',
        strength: 4,
      },
      {
        sourceKey: 'unep-resource-panel',
        stance: 'CONTEXT',
        claim:
          'Material-flows analysis providing the resource context for substituting one mineral input for another at scale.',
        strength: 3,
      },
      {
        sourceKey: 'ipcc-ar6-wg3',
        stance: 'CONTEXT',
        claim:
          'Assesses industrial mitigation options including material efficiency and substitution.',
        strength: 3,
      },
    ],
  },
  {
    key: 'cement-capture',
    problemKey: 'cement-process-co2',
    ref: '010408',
    title: 'Kiln carbon capture is only viable for plants with existing CO2 transport access',
    claim:
      "Carbon capture on cement kilns is economically viable only for the minority of plants located near existing or planned CO2 transport and storage infrastructure, so capture cannot be the industry's primary abatement route at global scale.",
    mechanism:
      'Capture cost per tonne has two parts: the capture plant, which scales reasonably with kiln size, and transport and storage, which depends entirely on location. Cement plants are sited near limestone and near demand, not near geological storage. For a plant without pipeline access, transport cost can exceed capture cost, and building dedicated infrastructure for a single mid-size source is not financeable. The consequence is that the industry roadmaps that assume broad capture deployment are assuming infrastructure that is not being built.',
    expectedImpact:
      'If correct, reallocates the abatement burden from capture toward substitution and material efficiency, changing which research deserves funding.',
    assumptions: [
      'CO2 transport infrastructure will remain concentrated around industrial clusters',
      'Cement plant location is determined by limestone and demand rather than by storage access',
      'Dedicated transport for a single mid-size source is not financeable',
    ],
    unknowns: [
      'Share of global cement capacity within economic pipeline reach of storage',
      'Whether shipping CO2 changes the calculation for coastal plants',
    ],
    risks: [
      'If wrong, this discourages capture investment that would have worked',
      'Plant-level economics vary enough that a global average may mislead in both directions',
    ],
    estimatedCost: null,
    estimatedScalability: 'Explicitly limited - that is the claim',
    validationMethod:
      'Geospatial analysis of global cement plant locations against announced and operating CO2 transport and storage infrastructure, reporting the capacity share within defined distance bands.',
    status: 'TESTABLE',
    authorIndex: 11,
    authorAgentRole: null,
    evidence: [
      {
        sourceKey: 'iea-ccus',
        stance: 'SUPPORTS',
        claim:
          'Analysis of carbon capture deployment that treats transport and storage infrastructure as a distinct constraint from capture itself.',
        strength: 4,
      },
      {
        sourceKey: 'iea-cement',
        stance: 'CONTEXT',
        claim:
          'Sector analysis in which capture features among the abatement options for process emissions.',
        strength: 4,
      },
      {
        sourceKey: 'gcca-concrete-future',
        stance: 'CONTRADICTS',
        claim:
          'Industry roadmap assigns a large share of 2050 abatement to carbon capture, which is the assumption this hypothesis disputes.',
        strength: 4,
      },
    ],
  },
  {
    key: 'cement-performance-codes',
    problemKey: 'cement-process-co2',
    ref: '010409',
    title: 'Performance-based structural codes unlock more abatement than any single new binder',
    claim:
      'Replacing prescriptive binder specifications with performance-based acceptance criteria would enable more cement CO2 abatement, sooner, than the development of any individual new binder chemistry.',
    mechanism:
      'Current structural codes in most jurisdictions specify binder composition, not only structural outcome. A material that meets every performance requirement can therefore still be unusable. Performance-based codes define required strength, durability and service life and accept any material that demonstrates them. This removes the qualification bottleneck simultaneously for every candidate material, rather than one at a time, and it does so without requiring any new science.',
    expectedImpact:
      'Systemic: accelerates every substitution route at once. Magnitude UNKNOWN because it depends on how many candidate materials are currently blocked.',
    assumptions: [
      'Prescriptive specification is currently a binding constraint on adoption',
      'Performance testing can substitute for composition control without unacceptable risk',
      'Long-term durability can be demonstrated by accelerated testing well enough for structural use',
    ],
    unknowns: [
      'How many materials are actually blocked by prescription rather than by cost or performance',
      'Whether accelerated durability testing predicts 50-year behaviour reliably enough',
    ],
    risks: [
      'Structural failure risk from a material that passes accelerated tests and fails in service',
      'Liability frameworks may not adapt, leaving engineers unwilling to specify novel binders regardless of code',
    ],
    estimatedCost: 'Low direct cost; large institutional effort',
    estimatedScalability: 'Global in principle, jurisdiction by jurisdiction in practice',
    validationMethod:
      'Survey of jurisdictions that have adopted performance-based provisions, comparing the rate of novel binder approval and deployment against matched prescriptive jurisdictions.',
    status: 'UNDER_REVIEW',
    authorIndex: 14,
    authorAgentRole: null,
    evidence: [
      {
        sourceKey: 'gcca-concrete-future',
        stance: 'SUPPORTS',
        claim:
          'Industry roadmap identifying standards and specification as an enabler of low-carbon binder deployment.',
        strength: 3,
      },
      {
        sourceKey: 'iea-cement',
        stance: 'CONTEXT',
        claim: 'Sector analysis noting non-technical barriers alongside technical ones.',
        strength: 3,
      },
      {
        sourceKey: 'globalabc',
        stance: 'CONTEXT',
        claim:
          'Buildings and construction alliance covering the regulatory environment in which specifications are set.',
        strength: 3,
      },
    ],
  },

  // ------------------------------------------------------ gram-negative-amr
  {
    key: 'amr-subscription',
    problemKey: 'gram-negative-amr',
    ref: '010410',
    title: 'Delinked subscription payment is necessary but not sufficient to restart the pipeline',
    claim:
      'Subscription-style payments that decouple developer revenue from sales volume are necessary to restore commercial viability for novel Gram-negative antibiotics, but on their own they are too small and too nationally fragmented to change portfolio decisions inside large developers.',
    mechanism:
      'A developer allocates capital across a portfolio by expected risk-adjusted return. Antibiotics fail that test because stewardship caps volume. A subscription pays a fixed annual amount for access regardless of volume, which restores a predictable revenue line. But the decision that matters is made against the global opportunity, and pilots in one or two national systems are an order of magnitude too small to move it. Coordination across major payers is therefore part of the mechanism, not an implementation detail.',
    expectedImpact:
      'Changes the sign of the expected return calculation only if the aggregate pull is large enough. Threshold UNKNOWN.',
    assumptions: [
      'Portfolio decisions are driven by expected return rather than by scientific tractability',
      'Multiple major payers can be coordinated on comparable terms',
      'The threshold value is within what health systems will pay',
    ],
    unknowns: [
      'The subscription value at which portfolio decisions actually change',
      'Whether coordination across payers is achievable in practice',
    ],
    risks: [
      'Paying for availability of agents that are never needed is politically fragile',
      'Fragmented national schemes may produce cost without the coordination benefit',
      'Access in low- and middle-income countries is not addressed by high-income subscriptions',
    ],
    estimatedCost: 'UNKNOWN. The threshold is the research question.',
    estimatedScalability: 'Depends entirely on payer coordination',
    validationMethod:
      'Structured elicitation with developer portfolio decision-makers on threshold values, combined with analysis of pipeline behaviour in jurisdictions that have implemented pilots versus those that have not.',
    status: 'UNDER_REVIEW',
    authorIndex: 4,
    authorAgentRole: null,
    evidence: [
      {
        sourceKey: 'who-amr',
        stance: 'SUPPORTS',
        claim:
          'WHO identifies the weak clinical pipeline and the incentive problem as central to the AMR response.',
        strength: 4,
      },
      {
        sourceKey: 'lancet-gram-amr',
        stance: 'SUPPORTS',
        claim:
          'Quantifies the global burden attributable to bacterial antimicrobial resistance, establishing the scale of the problem the incentive is meant to address.',
        strength: 5,
      },
      {
        sourceKey: 'ihme-gbd',
        stance: 'CONTEXT',
        claim:
          'Burden-of-disease estimates used to compare AMR against competing health priorities for the same budget.',
        strength: 3,
      },
    ],
  },
  {
    key: 'amr-permeability-rules',
    problemKey: 'gram-negative-amr',
    ref: '010411',
    title:
      'General Gram-negative permeability rules would matter more than any single new compound',
    claim:
      'Establishing predictive rules for small-molecule accumulation in Gram-negative bacteria would do more to restart the pipeline than any individual compound, because it converts an empirical screening problem into a design problem.',
    mechanism:
      'The Gram-negative outer membrane, combined with efflux pumps, means that most compounds with good target activity never reach a useful intracellular concentration. Because there is no reliable predictive rule for accumulation, this is discovered late and expensively, after target optimisation. Rules analogous to those used for oral bioavailability in human pharmacology would let chemists design for accumulation from the start, changing the economics of every programme simultaneously.',
    expectedImpact: 'Structural improvement in discovery productivity. Magnitude UNKNOWN.',
    assumptions: [
      'Accumulation is governed by properties general enough to be captured in rules',
      'Accumulation measurement can be standardised across labs',
      'Efflux does not dominate to the point of making entry rules irrelevant',
    ],
    unknowns: [
      'Whether general rules exist at all, or whether accumulation is species and strain specific',
      'How much published accumulation data is comparable across methods',
    ],
    risks: [
      'A decade of effort could establish that no general rule exists',
      'Rules derived on model organisms may not transfer to clinical isolates',
    ],
    estimatedCost: 'Research programme scale, not deployment scale',
    estimatedScalability: 'Knowledge, so free to copy once established',
    validationMethod:
      'Assemble a standardised accumulation dataset across a chemically diverse compound set and multiple species, then test whether any model predicts held-out accumulation above chance.',
    status: 'TESTABLE',
    authorIndex: 8,
    authorAgentRole: null,
    evidence: [
      {
        sourceKey: 'who-amr',
        stance: 'CONTEXT',
        claim: 'Frames the priority pathogens for which this chemistry problem is most acute.',
        strength: 4,
      },
      {
        sourceKey: 'nature-alphafold',
        stance: 'SUPPORTS',
        claim:
          'Demonstrates that a long-standing structural biology bottleneck could be substantially changed by a computational advance, which is the analogy this hypothesis rests on.',
        strength: 3,
      },
      {
        sourceKey: 'rcsb-pdb',
        stance: 'CONTEXT',
        claim:
          'Structural data repository underpinning any structure-based approach to membrane transport.',
        strength: 3,
      },
      {
        sourceKey: 'nih-pubmed',
        stance: 'CONTEXT',
        claim:
          'Literature index through which the existing accumulation data would have to be assembled.',
        strength: 2,
      },
    ],
  },

  // -------------------------------------------------- groundwater-depletion
  {
    key: 'groundwater-pay-for-reduction',
    problemKey: 'groundwater-depletion',
    ref: '010412',
    title: 'Paying farmers for measured reduction beats subsidising efficient irrigation equipment',
    claim:
      'Direct payment for measured reduction in groundwater extraction reduces basin-level depletion, whereas subsidising efficient irrigation equipment does not, because equipment subsidies are absorbed by expanded irrigated area.',
    mechanism:
      'Efficiency subsidies lower the cost of applying water per hectare, which increases the profitable irrigated area - so basin extraction stays flat or rises even as field-level efficiency improves. Paying for measured reduction inverts the incentive: the farmer is compensated for the thing the basin needs, and the payment scales with the outcome rather than with the input. The binding requirement is measurement credible enough to pay against.',
    expectedImpact:
      'Basin-level extraction reduction proportional to payment level and participation. Magnitudes UNKNOWN.',
    assumptions: [
      'Extraction can be measured or proxied credibly enough to pay against',
      'Farmers will accept payment in place of production',
      'Payments are fiscally sustainable at basin scale',
    ],
    unknowns: [
      'Measurement accuracy achievable with remote-sensed evapotranspiration proxies',
      'Participation rate at realistic payment levels',
      'Whether reduced extraction is offset by neighbours expanding',
    ],
    risks: [
      'Paying for reductions that would have happened anyway',
      'Leakage: neighbours expand extraction into the freed space',
      'Creates an expectation of payment that is hard to withdraw',
    ],
    estimatedCost: 'Recurrent fiscal cost proportional to the reduction purchased',
    estimatedScalability: 'Limited by state budgets rather than by technology',
    validationMethod:
      'Randomised rollout across villages within one basin, with extraction measured by a combination of metered wells and remote-sensed evapotranspiration, and basin storage tracked independently.',
    status: 'TESTABLE',
    authorIndex: 6,
    authorAgentRole: null,
    evidence: [
      {
        sourceKey: 'wri-aqueduct',
        stance: 'SUPPORTS',
        claim:
          'Provides the basin-level water stress and depletion indicators against which a reduction programme would be targeted and evaluated.',
        strength: 4,
      },
      {
        sourceKey: 'fao-aquastat',
        stance: 'SUPPORTS',
        claim:
          'Documents agricultural dominance of freshwater withdrawal, which is why the intervention targets farms.',
        strength: 4,
      },
      {
        sourceKey: 'nasa-earthdata',
        stance: 'SUPPORTS',
        claim:
          'Earth observation data supporting the evapotranspiration proxies this measurement approach would rely on.',
        strength: 3,
      },
      {
        sourceKey: 'worldbank-wdi',
        stance: 'CONTEXT',
        claim: 'Development indicators for the fiscal capacity assessment this programme requires.',
        strength: 2,
      },
    ],
  },
  {
    key: 'groundwater-crop-switch',
    problemKey: 'groundwater-depletion',
    ref: '010413',
    title: 'Procurement-led crop switching does more than any water policy instrument',
    claim:
      'Changing what public procurement buys - shifting guaranteed purchase away from water-intensive staples - reduces basin extraction more reliably than water pricing, metering or extraction rights, because it acts on the demand that drives planting decisions.',
    mechanism:
      'Farmers plant what they can reliably sell. Where public procurement guarantees purchase of specific water-intensive crops at a floor price, that guarantee dominates water cost in the planting decision, and water policy instruments are pushing against a much larger signal. Redirecting procurement toward less water-intensive crops changes the planting decision at its source, without requiring any well to be metered.',
    expectedImpact:
      'UNKNOWN. The claim is about relative effectiveness of instruments, and that comparison is the testable part.',
    assumptions: [
      'Procurement guarantees dominate planting decisions in the affected basins',
      'Alternative crops have agronomic viability and a market',
      'Nutritional adequacy is maintained under the substitution',
    ],
    unknowns: [
      'Elasticity of planting decisions to procurement terms',
      'Regional nutritional consequences of the substitution',
    ],
    risks: [
      'Food security consequences if substitution reduces calorie availability',
      'Political resistance from farmer organisations built around the current crop',
      'Substituted crops may have their own water demands under different irrigation regimes',
    ],
    estimatedCost: 'Budget-neutral in principle; redirects existing procurement spending',
    estimatedScalability: 'National, where public procurement is large',
    validationMethod:
      'Natural-experiment analysis of districts where procurement terms have changed, tracking planted area by crop and modelled water demand, with a pre-registered specification.',
    status: 'NEEDS_EVIDENCE',
    authorIndex: 13,
    authorAgentRole: null,
    evidence: [
      {
        sourceKey: 'fao-faostat',
        stance: 'SUPPORTS',
        claim: 'Crop production and area statistics required to detect planting-decision changes.',
        strength: 4,
      },
      {
        sourceKey: 'ifpri',
        stance: 'CONTEXT',
        claim:
          'Food policy research institute; the body of work on procurement and cropping incentives sits here.',
        strength: 3,
      },
      {
        sourceKey: 'fao-aquastat',
        stance: 'CONTEXT',
        claim:
          'Water-use-by-crop data needed to convert a cropping change into a water demand change.',
        strength: 3,
      },
    ],
  },

  // ------------------------------------------------------- post-harvest-loss
  {
    key: 'harvest-hermetic',
    problemKey: 'post-harvest-loss',
    ref: '010414',
    title: 'Hermetic storage at household level beats cold chain investment for staples',
    claim:
      'For dry staple grains and legumes, hermetic storage at household level reduces measured loss more per dollar than any refrigeration-based intervention, and does so without requiring electricity.',
    mechanism:
      'Loss in dry staples is dominated by insect infestation and moisture-driven spoilage rather than by temperature. A sealed container with low oxygen permeability suppresses insect respiration and prevents moisture ingress, which addresses the dominant loss pathway directly. Because it requires no power, it also removes the failure mode where an intermittent cold chain produces false confidence in shelf life.',
    expectedImpact:
      'Loss reduction on treated stored volume; magnitude depends on baseline loss, which is poorly measured.',
    assumptions: [
      'Insect and moisture damage dominate loss for these crops',
      'Households store long enough for storage losses to matter',
      'Bags are reused across seasons rather than discarded',
    ],
    unknowns: [
      'Real baseline loss, since recall surveys and direct measurement diverge',
      'Reuse rate and effective lifetime of the bags in practice',
    ],
    risks: [
      'Does not apply to perishables, which may carry the larger income loss',
      'Improper sealing produces no benefit and undermines confidence in the method',
    ],
    estimatedCost: 'Order of a few dollars per bag; per-household cost depends on stored volume',
    estimatedScalability: 'High for dry staples; not applicable to fresh produce',
    validationMethod:
      'Randomised household trial with direct weighing at defined chain points across two harvest cycles, plus a 24-month follow-up on continued use after any subsidy ends.',
    status: 'PROMISING',
    authorIndex: 10,
    authorAgentRole: null,
    evidence: [
      {
        sourceKey: 'fao-food-loss-platform',
        stance: 'SUPPORTS',
        claim:
          'FAO technical platform covering measurement methodology and reduction practices for food loss, including storage.',
        strength: 4,
      },
      {
        sourceKey: 'cgiar-research',
        stance: 'SUPPORTS',
        claim:
          'Applied agricultural research programmes covering post-harvest handling in the affected regions.',
        strength: 3,
      },
      {
        sourceKey: 'fao-sofi',
        stance: 'CONTEXT',
        claim:
          'Food security reporting establishing the populations for whom this loss matters most.',
        strength: 4,
      },
    ],
  },
  {
    key: 'harvest-aggregation',
    problemKey: 'post-harvest-loss',
    ref: '010415',
    title: 'Aggregation timing, not storage technology, carries most of the loss',
    claim:
      'The largest measured losses occur during aggregation and the first transport leg rather than in on-farm storage, so interventions targeting storage address the smaller share of the problem.',
    mechanism:
      'Produce waits at collection points, often unshaded and unventilated, until enough volume accumulates for transport to be economic. That waiting period, not the storage period, is where temperature and handling damage concentrate. Reducing time-to-transport by improving aggregation logistics therefore attacks the dominant loss window, and requires coordination rather than equipment.',
    expectedImpact:
      'UNKNOWN pending measurement. The hypothesis is primarily a claim about where to look.',
    assumptions: [
      'Aggregation delay is long enough to matter for the crops concerned',
      'Transport can be made economic at smaller volumes',
      'Losses at aggregation are currently attributed to storage in survey data',
    ],
    unknowns: [
      'Measured loss split between on-farm storage, aggregation and transport',
      'Whether aggregation delay is a logistics problem or a price-timing decision by farmers',
    ],
    risks: [
      'Reduced aggregation volume may raise per-unit transport cost, offsetting the gain',
      'The finding may be crop-specific and not generalise',
    ],
    estimatedCost: null,
    estimatedScalability: 'Depends on cooperative and trader structures, which vary by district',
    validationMethod:
      'Direct weighing at four defined points - farm gate, aggregation in, aggregation out, market in - across multiple crops and districts, with timestamps.',
    status: 'NEEDS_EVIDENCE',
    authorIndex: 16,
    authorAgentRole: null,
    evidence: [
      {
        sourceKey: 'fao-food-loss-platform',
        stance: 'SUPPORTS',
        claim:
          'Provides the chain-point measurement methodology this hypothesis proposes to apply.',
        strength: 4,
      },
      {
        sourceKey: 'fao-faostat',
        stance: 'CONTEXT',
        claim: 'Production statistics providing the denominator for any loss percentage.',
        strength: 3,
      },
      {
        sourceKey: 'fao-food-waste',
        stance: 'CONTEXT',
        claim: 'Food waste programme framing the chain-wide view this hypothesis argues for.',
        strength: 2,
      },
    ],
  },

  // ---------------------------------------------------------- insect-decline
  {
    key: 'insect-acoustic-monitoring',
    problemKey: 'insect-decline',
    ref: '010416',
    title: 'Automated sensors can produce abundance estimates comparable to standardised trapping',
    claim:
      'Automated acoustic and camera-based monitoring, calibrated against standardised trapping at a subset of sites, can produce abundance indices comparable enough to extend monitoring into under-sampled tropical regions at acceptable cost.',
    mechanism:
      'The obstacle to global insect monitoring is labour: standardised trapping requires trained people to sort and identify specimens. Automated sensors move the cost from recurring labour to one-off hardware and shared classification models. Calibration against traditional trapping at a subset of sites establishes the conversion between sensor index and abundance, allowing the cheap method to be deployed where the expensive one cannot be sustained.',
    expectedImpact:
      'Would change what is knowable about global insect trends. Says nothing about whether declines are occurring.',
    assumptions: [
      'Sensor indices correlate stably with trap-based abundance across taxa and habitats',
      'Classification models transfer to taxa with little training data, which is most tropical taxa',
      'Hardware survives tropical field conditions for years',
    ],
    unknowns: [
      'Correlation strength between sensor index and trap abundance',
      'Whether model performance degrades in high-diversity assemblages',
    ],
    risks: [
      'A cheap but biased method could entrench a wrong global picture',
      'Model drift between hardware generations breaks the long time series that is the entire point',
    ],
    estimatedCost:
      'Hardware in the hundreds of dollars per site; the dominant recurring cost becomes maintenance',
    estimatedScalability: 'High, which is the argument for it',
    validationMethod:
      'Co-deployment of sensors and standardised traps at 30+ sites spanning habitat types for at least three years, reporting correlation and its stability over time.',
    status: 'TESTABLE',
    authorIndex: 12,
    authorAgentRole: null,
    evidence: [
      {
        sourceKey: 'gbif',
        stance: 'SUPPORTS',
        claim:
          'Aggregated occurrence records that make the geographic bias in sampling effort directly visible, which is the gap this hypothesis addresses.',
        strength: 4,
      },
      {
        sourceKey: 'ipbes-global-assessment',
        stance: 'CONTEXT',
        claim:
          'Global biodiversity assessment establishing why abundance trends matter and where evidence is thin.',
        strength: 4,
      },
      {
        sourceKey: 'iucn-red-list',
        stance: 'CONTEXT',
        claim:
          'Extinction risk assessments, where insect coverage is sparse relative to vertebrates.',
        strength: 3,
      },
    ],
  },
  {
    key: 'insect-landuse-attribution',
    problemKey: 'insect-decline',
    ref: '010417',
    title:
      'Land-use intensity dominates pesticide load as a driver where both have been measured together',
    claim:
      'Where land-use intensity and pesticide load have been measured at the same sites, land-use intensity accounts for more of the variance in insect abundance, which implies that habitat measures would reverse more decline than pesticide restriction.',
    mechanism:
      'Land-use intensity determines habitat availability, structural diversity and continuity of floral and larval resources through the season. Pesticide load acts on top of that as a mortality pressure. Where habitat is already absent, reducing pesticide load has little to act on. The claim is that the ordering is consistent enough across studied sites to guide where intervention money goes.',
    expectedImpact:
      'Would reprioritise conservation spending toward habitat provision over chemical regulation.',
    assumptions: [
      'The two drivers have been measured together at enough sites to compare',
      'Variance decomposition is a meaningful guide to intervention priority',
      'Results from well-studied temperate regions transfer to other contexts',
    ],
    unknowns: [
      'Whether sufficient co-measured datasets exist at all',
      'Interaction effects between the two drivers, which variance decomposition handles badly',
    ],
    risks: [
      'Variance explained in observational data is a poor guide to intervention effect',
      'Conclusion would rest on temperate agricultural landscapes and may not generalise',
      'Could be used to argue against pesticide regulation on thin evidence',
    ],
    estimatedCost: 'Synthesis study; no deployment cost',
    estimatedScalability: 'Not applicable',
    validationMethod:
      'Systematic review and meta-analysis restricted to studies with co-measured land-use intensity and pesticide load, with pre-registered inclusion criteria and explicit treatment of interaction terms.',
    status: 'CONTESTED',
    authorIndex: 17,
    authorAgentRole: null,
    evidence: [
      {
        sourceKey: 'ipbes-global-assessment',
        stance: 'SUPPORTS',
        claim:
          'Identifies land-use change as the dominant driver of terrestrial biodiversity loss in its global assessment.',
        strength: 4,
      },
      {
        sourceKey: 'ipbes-invasive',
        stance: 'CONTRADICTS',
        claim:
          'Assesses invasive species as a further major driver, indicating that a two-driver framing may be too narrow.',
        strength: 3,
      },
      {
        sourceKey: 'gbif',
        stance: 'CONTEXT',
        claim:
          'Occurrence data that would underpin any site-level synthesis, with its known sampling biases.',
        strength: 3,
      },
      {
        sourceKey: 'wwf-living-planet',
        stance: 'CONTEXT',
        claim: 'Population trend reporting at global scale, with methodological debate attached.',
        strength: 2,
      },
    ],
  },

  // -------------------------------------------------------------- green-steel
  {
    key: 'steel-ore-constraint',
    problemKey: 'green-steel',
    ref: '010418',
    title:
      'DR-grade ore availability, not hydrogen cost, is the binding constraint on hydrogen steel',
    claim:
      'The binding constraint on hydrogen-based primary steel is the availability of direct-reduction-grade iron ore, not the cost of hydrogen, and this will remain true even if electrolytic hydrogen reaches target costs.',
    mechanism:
      'Direct reduction requires higher-grade, lower-gangue feed than a blast furnace, because there is no slag phase to carry impurities away. High-grade pellet feed is a minority of global iron ore supply and is already committed to existing DRI capacity. Beneficiating lower grades is possible but consumes energy and capital, which transfers the cost problem upstream rather than removing it. If this holds, cheap hydrogen alone does not unlock the route.',
    expectedImpact:
      'Redirects attention and investment from electrolysis to ore beneficiation and to electric smelting furnaces that tolerate lower grades.',
    assumptions: [
      'DR-grade supply cannot expand quickly relative to demand',
      'Beneficiation cost is material relative to hydrogen cost',
      'Electric smelting furnace routes that tolerate lower grades are not yet commercially proven',
    ],
    unknowns: [
      'Global DR-grade reserve and production capacity',
      'Actual beneficiation cost per tonne for representative lower-grade ores',
    ],
    risks: [
      'If wrong, this discourages electrolysis investment that was on the critical path',
      'Ore grade data is commercially sensitive and may be unreliable',
    ],
    estimatedCost: null,
    estimatedScalability: 'The claim is precisely that scalability is bounded',
    validationMethod:
      'Mass-balance analysis of global iron ore production by grade against announced DRI capacity, with a published beneficiation cost curve.',
    status: 'UNDER_REVIEW',
    authorIndex: 1,
    authorAgentRole: null,
    evidence: [
      {
        sourceKey: 'iea-steel',
        stance: 'SUPPORTS',
        claim: 'Sector analysis covering the direct reduction route and its input requirements.',
        strength: 4,
      },
      {
        sourceKey: 'iea-critical-minerals',
        stance: 'CONTEXT',
        claim:
          'Mineral supply analysis framing concentration and expansion constraints for transition materials.',
        strength: 3,
      },
      {
        sourceKey: 'iea-hydrogen',
        stance: 'CONTRADICTS',
        claim:
          'Hydrogen analysis treats supply cost and availability as the principal constraint on hydrogen end uses, which is the framing this hypothesis disputes.',
        strength: 3,
      },
    ],
  },
  {
    key: 'steel-scrap-first',
    problemKey: 'green-steel',
    ref: '010419',
    title: 'Improving scrap quality displaces more primary demand than building hydrogen capacity',
    claim:
      'Investment in scrap sorting and contaminant removal displaces more primary steel demand per euro than investment in hydrogen direct reduction capacity, because the constraint on secondary steel is quality, not quantity.',
    mechanism:
      'Secondary steelmaking from scrap is already low-emission relative to primary. Its ceiling is copper and tin contamination, which cannot be removed in the furnace and limits scrap to lower-specification products. Improving sorting and dismantling raises the specification that secondary steel can serve, displacing primary demand directly - and it uses existing electric arc capacity rather than requiring new plant.',
    expectedImpact:
      'Displaced primary production per euro invested. The comparison against hydrogen capacity is the testable part.',
    assumptions: [
      'Copper contamination is the binding constraint on scrap use',
      'Sorting technology can reach the required purity at industrial throughput',
      'Scrap availability is sufficient to meet the displaced demand',
    ],
    unknowns: [
      'Achievable contamination levels at commercial sorting throughput',
      'Global scrap availability trajectory relative to steel demand',
    ],
    risks: [
      'Scrap availability is set by past steel production and cannot be increased on demand',
      'Focusing on secondary steel may delay the primary route that is eventually needed anyway',
    ],
    estimatedCost: 'Sorting capital per tonne of scrap processed; UNKNOWN in this record',
    estimatedScalability: 'Bounded by scrap arisings, which are physically determined',
    validationMethod:
      'Comparative analysis of displaced primary production per unit of capital, for sorting investment versus DRI capacity investment, over a common scenario.',
    status: 'DRAFT',
    authorIndex: 18,
    authorAgentRole: null,
    evidence: [
      {
        sourceKey: 'iea-steel',
        stance: 'SUPPORTS',
        claim: 'Covers both primary and secondary steelmaking routes and the role of scrap.',
        strength: 4,
      },
      {
        sourceKey: 'unep-resource-panel',
        stance: 'SUPPORTS',
        claim:
          'Material flows and circularity analysis relevant to scrap availability and quality.',
        strength: 3,
      },
    ],
  },

  // ---------------------------------------------------------- shipping-fuels
  {
    key: 'shipping-methanol-bridge',
    problemKey: 'shipping-fuels',
    ref: '010420',
    title: 'Dual-fuel methanol vessels dominate ammonia because they preserve optionality',
    claim:
      'Ordering dual-fuel methanol-capable vessels is the cost-minimising decision under fuel uncertainty, not because methanol is the best endpoint, but because the option value of being able to switch exceeds the efficiency cost of the compromise.',
    mechanism:
      'The fuel decision is being made under genuine uncertainty about which fuel will have infrastructure in 2040. A dual-fuel vessel can burn conventional fuel now and methanol later, and methanol handling is far closer to existing practice than ammonia or hydrogen. That converts an irreversible 25-year bet into a reversible one, and under uncertainty the value of reversibility can exceed the direct cost difference between candidate fuels.',
    expectedImpact:
      'Would concentrate near-term orders on one fuel and give bunkering investors a clearer signal.',
    assumptions: [
      'Green methanol feedstock can scale to a meaningful share of marine demand',
      'The retrofit or switching cost from methanol to another fuel is genuinely lower than from ammonia',
      'Option value calculations survive contact with charterer economics',
    ],
    unknowns: [
      'Sustainable biogenic carbon availability for methanol at fleet scale',
      'Whether early bunkering investment locks in methanol regardless of later evidence',
    ],
    risks: [
      'Methanol could become a lock-in rather than a bridge, which is the opposite of the claim',
      'Biogenic carbon competes with aviation fuel for the same feedstock',
    ],
    estimatedCost: 'Newbuild premium over conventional; UNKNOWN in this record',
    estimatedScalability: 'Constrained by green methanol feedstock',
    validationMethod:
      'Real-options analysis of the newbuild decision under explicit fuel-availability scenarios, with switching costs estimated from shipyard data, published with full assumptions.',
    status: 'UNDER_REVIEW',
    authorIndex: 5,
    authorAgentRole: null,
    evidence: [
      {
        sourceKey: 'imo-ghg',
        stance: 'CONTEXT',
        claim: 'The regulatory framework under which any fuel transition in shipping must occur.',
        strength: 4,
      },
      {
        sourceKey: 'icct',
        stance: 'SUPPORTS',
        claim: 'Technical analysis of marine fuel pathways including methanol and ammonia.',
        strength: 3,
      },
      {
        sourceKey: 'iea-transport',
        stance: 'CONTEXT',
        claim: 'Transport energy analysis covering international shipping demand.',
        strength: 3,
      },
      {
        sourceKey: 'ipcc-srccl',
        stance: 'CONTRADICTS',
        claim:
          'Land-use assessment implying that biogenic carbon supply is constrained and contested between competing uses.',
        strength: 3,
      },
    ],
  },
  {
    key: 'shipping-wind-assist',
    problemKey: 'shipping-fuels',
    ref: '010421',
    title: 'Wind assistance changes the fuel problem by shrinking it',
    claim:
      'Wind-assisted propulsion on bulk and tanker routes reduces fuel demand enough to make an expensive zero-carbon fuel affordable, changing the fuel decision from a cost problem to a smaller cost problem.',
    mechanism:
      'Rigid sails and rotor systems convert wind directly into thrust, reducing engine load. Because the fuel cost problem scales with fuel volume, a reduction in demand reduces the premium of an expensive alternative fuel proportionally. Wind assistance is also retrofittable, which means it applies to the existing fleet rather than only to newbuilds.',
    expectedImpact:
      'Fuel demand reduction on suitable routes; the size varies with route and system, and is the contested quantity.',
    assumptions: [
      'Measured savings on real routes match the claimed range',
      'Port compatibility and air-draft constraints do not exclude major routes',
      'Retrofit cost is recovered within an acceptable payback',
    ],
    unknowns: [
      'Independently verified route-average savings',
      'Share of the fleet on routes where wind resource is favourable',
    ],
    risks: [
      'Savings claims come largely from system vendors',
      'Route-dependence may make fleet-wide extrapolation misleading',
    ],
    estimatedCost: 'Retrofit capital per vessel; UNKNOWN in this record',
    estimatedScalability: 'Route-dependent',
    validationMethod:
      'Independent instrumented measurement on matched voyages, with pre-registered analysis, reporting savings by route and weather condition rather than a single fleet average.',
    status: 'NEEDS_EVIDENCE',
    authorIndex: 19,
    authorAgentRole: null,
    evidence: [
      {
        sourceKey: 'icct',
        stance: 'SUPPORTS',
        claim: 'Publishes technical analysis of shipping efficiency measures.',
        strength: 3,
      },
      {
        sourceKey: 'imo-ghg',
        stance: 'CONTEXT',
        claim: 'Efficiency measures sit within the IMO regulatory framework for ship emissions.',
        strength: 3,
      },
    ],
  },

  // ------------------------------------------------------------- saf-supply
  {
    key: 'saf-contrail-priority',
    problemKey: 'saf-supply',
    ref: '010422',
    title: 'Contrail avoidance delivers more near-term forcing reduction per euro than SAF',
    claim:
      'Routing adjustments to avoid contrail-forming atmospheric regions reduce aviation radiative forcing more per euro spent, in the next decade, than an equivalent expenditure on sustainable aviation fuel.',
    mechanism:
      'A small fraction of flights produce the majority of persistent contrails, and those contrails form in thin, identifiable ice-supersaturated layers. Small altitude adjustments on those specific flights avoid formation at a modest fuel penalty. Because contrail forcing is short-lived but large, and because the intervention costs only fuel rather than new production capacity, the near-term cost-effectiveness can exceed that of fuel substitution.',
    expectedImpact:
      'Near-term forcing reduction at low capital cost. Does nothing about CO2, which is the long-lived component.',
    assumptions: [
      'Ice-supersaturated regions can be forecast accurately enough to reroute against',
      'The fuel penalty from rerouting is small relative to the forcing avoided',
      'Contrail forcing estimates are robust enough to act on',
    ],
    unknowns: [
      'Forecast skill for ice-supersaturated regions at operational lead times',
      'Magnitude and uncertainty of contrail radiative forcing',
    ],
    risks: [
      'Acting on a highly uncertain forcing estimate could increase CO2 for no benefit',
      'Could be used to defer the CO2 problem, which does not go away',
      'Air traffic control constraints may prevent the required altitude flexibility',
    ],
    estimatedCost: 'Fuel penalty only; no capital investment required',
    estimatedScalability: 'High and immediate, which is the attraction',
    validationMethod:
      'Operational trial with satellite-based contrail detection on treated and control flights, with pre-registered analysis of both contrail incidence and the fuel penalty incurred.',
    status: 'TESTABLE',
    authorIndex: 15,
    authorAgentRole: null,
    evidence: [
      {
        sourceKey: 'iea-aviation',
        stance: 'CONTEXT',
        claim: 'Sector analysis of aviation energy use and decarbonisation options.',
        strength: 3,
      },
      {
        sourceKey: 'icct',
        stance: 'SUPPORTS',
        claim: 'Technical analysis covering aviation climate impacts including non-CO2 effects.',
        strength: 3,
      },
      {
        sourceKey: 'science-graphcast',
        stance: 'SUPPORTS',
        claim:
          'Demonstrates substantial gains in medium-range weather forecasting skill, which is the capability an operational rerouting scheme depends on.',
        strength: 3,
      },
      {
        sourceKey: 'ipcc-ar6-wg1',
        stance: 'CONTEXT',
        claim:
          'Physical science assessment covering radiative forcing, including the uncertainty ranges relevant to non-CO2 aviation effects.',
        strength: 4,
      },
    ],
  },
  {
    key: 'saf-hydrogen-allocation',
    problemKey: 'saf-supply',
    ref: '010423',
    title: 'Aviation should be last in the queue for scarce clean hydrogen',
    claim:
      'Given constrained clean hydrogen supply, allocating it to industrial feedstock uses abates more CO2 per unit of hydrogen than converting it into synthetic aviation fuel, so aviation mandates that pull hydrogen forward reduce total abatement.',
    mechanism:
      'Synthetic jet fuel loses energy at every conversion step: electricity to hydrogen, hydrogen plus captured CO2 to liquid fuel, fuel to thrust. Industrial uses such as ammonia and steel reduction use hydrogen directly as a chemical input with no such chain. Per unit of scarce hydrogen, the direct uses therefore abate more. Mandates that force aviation to the front of the queue move hydrogen to its least efficient use.',
    expectedImpact:
      'If correct, argues for sequencing hydrogen allocation rather than mandating parallel uses.',
    assumptions: [
      'Clean hydrogen is genuinely supply-constrained over the relevant period',
      'Abatement per unit of hydrogen is the right allocation criterion',
      'Aviation has no alternative, so delay means continued fossil use rather than substitution',
    ],
    unknowns: [
      'Whether hydrogen supply is constrained by production or by demand certainty',
      'Whether sequencing is politically implementable across sectors',
    ],
    risks: [
      'Delaying aviation demand may prevent the learning that reduces synthetic fuel cost',
      'Abatement-per-unit is one criterion; security and industrial policy are others',
    ],
    estimatedCost: 'Not a capital proposal; a prioritisation rule',
    estimatedScalability: 'Not applicable',
    validationMethod:
      'Comparative abatement accounting per unit of hydrogen across candidate end uses under common assumptions, with sensitivity on conversion efficiencies and counterfactual fuels.',
    status: 'CONTESTED',
    authorIndex: 9,
    authorAgentRole: null,
    evidence: [
      {
        sourceKey: 'iea-hydrogen',
        stance: 'SUPPORTS',
        claim:
          'Assesses hydrogen supply and competing end uses, which is the allocation problem at issue.',
        strength: 4,
      },
      {
        sourceKey: 'iea-aviation',
        stance: 'CONTEXT',
        claim: "Establishes aviation's limited alternatives for long-haul operation.",
        strength: 3,
      },
      {
        sourceKey: 'iea-steel',
        stance: 'SUPPORTS',
        claim:
          'Industrial hydrogen use as a direct chemical reductant, the comparator in this allocation argument.',
        strength: 3,
      },
    ],
  },

  // ------------------------------------------------- llm-citation-integrity
  {
    key: 'llm-whitelist-retrieval',
    problemKey: 'llm-citation-integrity',
    ref: '010424',
    title:
      'Restricting citations to a retrieved set eliminates fabricated references without harming usefulness',
    claim:
      'Constraining a generated summary to cite only documents present in an explicit retrieval set eliminates non-existent citations entirely, at a measurable but acceptable cost in recall.',
    mechanism:
      'Fabricated references arise when the model generates a citation string rather than selecting from a set of retrieved records. If the system supplies identifiers and rejects any output identifier outside that set, fabrication is structurally impossible rather than merely discouraged - it is a validation problem, not a training problem. The cost is that genuinely relevant work missed by retrieval cannot be cited, which is a recall loss rather than a correctness loss.',
    expectedImpact:
      'Fabricated citation rate goes to zero by construction. Recall cost is the quantity to measure.',
    assumptions: [
      'Retrieval quality is good enough that the recall loss is tolerable',
      'Users prefer a missing citation to a wrong one',
      'Identifier rejection can be implemented without the model routing around it',
    ],
    unknowns: [
      'Size of the recall penalty on realistic review tasks',
      'Whether users notice and compensate for missing citations',
    ],
    risks: [
      'A citation that exists and is in the retrieval set may still not support the claim - this fixes existence, not entailment',
      'False confidence: users may over-trust a system that guarantees only the weaker property',
    ],
    estimatedCost: 'Implementation is a validation layer; negligible marginal inference cost',
    estimatedScalability: 'Immediate',
    validationMethod:
      'Benchmark comparing constrained and unconstrained generation on the same corpus, reporting fabricated-citation rate and recall against expert-annotated ground truth.',
    status: 'VALIDATED',
    authorIndex: 2,
    authorAgentRole: null,
    evidence: [
      {
        sourceKey: 'nist-ai-rmf',
        stance: 'SUPPORTS',
        claim:
          'Treats validity and reliability as measurable properties of AI systems, and measurement as a core function - the framing this hypothesis operationalises.',
        strength: 4,
      },
      {
        sourceKey: 'openalex',
        stance: 'SUPPORTS',
        claim: 'Open scholarly catalogue against which citation existence can be checked at scale.',
        strength: 4,
      },
      {
        sourceKey: 'crossref',
        stance: 'SUPPORTS',
        claim:
          'DOI registration metadata, the authoritative check for whether a cited work exists.',
        strength: 4,
      },
      {
        sourceKey: 'arxiv-attention',
        stance: 'CONTEXT',
        claim: 'The architecture underlying the systems whose citation behaviour is at issue.',
        strength: 2,
      },
    ],
  },
  {
    key: 'llm-abstract-entailment',
    problemKey: 'llm-citation-integrity',
    ref: '010425',
    title: 'Abstract-level entailment checking is insufficient for claim verification',
    claim:
      "Verifying a claim against a paper's abstract rather than its full text misses a large fraction of unsupported citations, because the specific quantities and conditions that claims depend on are usually not in the abstract.",
    mechanism:
      'Abstracts state conclusions, not the conditions attached to them - the population studied, the effect size, the confidence interval, the exclusions. A claim that misstates any of these will still appear consistent with the abstract. Since full text is often paywalled, verification systems default to abstracts, which means the verification systematically misses exactly the class of error it is built to catch.',
    expectedImpact:
      'Would establish that full-text access is a requirement rather than an optimisation, with licensing consequences.',
    assumptions: [
      'A meaningful share of unsupported claims are consistent with the abstract',
      'Expert adjudication can reliably label support at full-text level',
    ],
    unknowns: [
      'The size of the abstract-only miss rate',
      'Whether it varies enough by field to change the conclusion',
    ],
    risks: [
      'If full text is required and unavailable, verification may be impossible for much of the literature',
      'Labelling entailment is itself subjective at the margin',
    ],
    estimatedCost:
      'Benchmark construction with expert adjudication - the dominant cost is expert time',
    estimatedScalability: 'Not applicable',
    validationMethod:
      'Construct a claim set with expert full-text support labels, then measure verifier accuracy given abstracts only versus full text, reporting the difference.',
    status: 'TESTABLE',
    authorIndex: 12,
    authorAgentRole: null,
    evidence: [
      {
        sourceKey: 'semantic-scholar',
        stance: 'SUPPORTS',
        claim:
          'Scholarly search infrastructure exposing the abstract-versus-full-text access asymmetry this hypothesis is about.',
        strength: 3,
      },
      {
        sourceKey: 'openalex',
        stance: 'CONTEXT',
        claim: 'Open metadata catalogue with variable full-text availability.',
        strength: 3,
      },
      {
        sourceKey: 'nist-ai-rmf',
        stance: 'CONTEXT',
        claim: 'Risk framework under which such verification limitations would be documented.',
        strength: 3,
      },
    ],
  },

  // ------------------------------------------------------- jakarta-subsidence
  {
    key: 'subsidence-supply-first',
    problemKey: 'jakarta-subsidence',
    ref: '010426',
    title: 'Piped supply must precede extraction restriction by at least three years',
    claim:
      'Restricting groundwater extraction before piped supply reaches at least 90% of households in a district produces neither compliance nor subsidence reduction, so supply extension must lead restriction by a margin of years, not months.',
    mechanism:
      'Households extract because they have no alternative. A restriction imposed before an alternative exists is either ignored or complied with at severe cost to the household, and enforcement against a household with no water supply is neither feasible nor legitimate. Sequencing supply first removes the reason to extract, at which point restriction becomes enforceable against the remaining, mostly commercial, users.',
    expectedImpact:
      'Subsidence rate reduction following the sequenced intervention; lag and magnitude UNKNOWN.',
    assumptions: [
      'Households abandon private wells once reliable piped supply arrives',
      'Reliability, not just connection, is what drives abandonment',
      'Commercial extraction is enforceable once household extraction falls',
    ],
    unknowns: [
      'Well abandonment rate following connection',
      'Whether compaction slows quickly enough to be detectable within the programme period',
    ],
    risks: [
      'Connection without reliability leaves wells in use and the money spent',
      'Continued extraction by industry could dominate regardless of household behaviour',
    ],
    estimatedCost: 'Network extension capital; large and municipality-specific',
    estimatedScalability: 'District by district',
    validationMethod:
      'Staggered rollout across districts with subsidence measured by interferometry, well abandonment surveyed directly, and supply reliability logged at the connection.',
    status: 'TESTABLE',
    authorIndex: 6,
    authorAgentRole: null,
    evidence: [
      {
        sourceKey: 'jmp-washdata',
        stance: 'SUPPORTS',
        claim:
          'Service-ladder monitoring distinguishing connection from reliable service, which is the distinction this hypothesis turns on.',
        strength: 4,
      },
      {
        sourceKey: 'copernicus-dataspace',
        stance: 'SUPPORTS',
        claim:
          'Sentinel imagery supporting the interferometric subsidence measurement this validation requires.',
        strength: 4,
      },
      {
        sourceKey: 'ipcc-srocc',
        stance: 'CONTEXT',
        claim:
          'Assesses relative sea-level rise and coastal risk, within which local land movement can dominate.',
        strength: 4,
      },
      {
        sourceKey: 'un-habitat-wcr',
        stance: 'CONTEXT',
        claim:
          'Urban data on the informal settlement patterns that make network extension difficult.',
        strength: 3,
      },
    ],
  },
  {
    key: 'subsidence-seawall-moral-hazard',
    problemKey: 'jakarta-subsidence',
    ref: '010427',
    title: 'Sea wall construction measurably reduces political effort on extraction control',
    claim:
      'Announcing or beginning major coastal defence works reduces subsequent policy effort on groundwater extraction control, making the defence counterproductive over a multi-decade horizon.',
    mechanism:
      'Coastal defence removes the visible near-term consequence - flooding - that sustains political attention on the underlying cause. Because subsidence continues invisibly, and because defence height must then be increased, the intervention creates a commitment to ever-larger works while the driver is unaddressed. This is a claim about political economy, and it is testable against the policy record.',
    expectedImpact:
      'Would argue for sequencing extraction control ahead of, or as a binding condition on, defence investment.',
    assumptions: [
      'Policy effort on extraction can be measured from the public record',
      'Comparable cities with and without major defence programmes exist',
      'Attention, not capacity, is the limiting factor on extraction control',
    ],
    unknowns: [
      'Whether the observed pattern is causal or reflects cities that had already given up on extraction control',
    ],
    risks: [
      'Small sample of comparable cities makes any finding fragile',
      'Could be used to argue against defence works that are genuinely needed now',
    ],
    estimatedCost: 'Research only',
    estimatedScalability: 'Not applicable',
    validationMethod:
      'Comparative policy analysis across coastal cities with documented subsidence, coding extraction-control policy effort before and after defence decisions, with explicit treatment of selection.',
    status: 'DRAFT',
    authorIndex: 16,
    authorAgentRole: null,
    evidence: [
      {
        sourceKey: 'un-habitat-wcr',
        stance: 'CONTEXT',
        claim: 'Urban policy reporting across the cities this comparison would draw on.',
        strength: 3,
      },
      {
        sourceKey: 'ipcc-ar6-wg2',
        stance: 'CONTEXT',
        claim: 'Adaptation assessment covering maladaptation as a recognised risk category.',
        strength: 4,
      },
    ],
  },

  // --------------------------------------------------------- dengue-expansion
  {
    key: 'dengue-clinician-training',
    problemKey: 'dengue-expansion',
    ref: '010428',
    title:
      'Clinician recognition training shortens detection delay more than expanded vector surveillance',
    claim:
      'In regions without established transmission, training primary-care clinicians to recognise and test for dengue shortens the delay between first local case and detection more than an equivalent investment in vector surveillance.',
    mechanism:
      'The first local cluster is detected when a clinician considers dengue in a patient with no travel history and orders the test. Vector surveillance establishes that transmission is possible but does not detect that it has happened. Since detection delay is dominated by clinical suspicion rather than by entomology, the intervention that shortens it acts on clinicians.',
    expectedImpact:
      'Reduction in detection delay; magnitude depends on baseline delay, which is poorly documented.',
    assumptions: [
      'Detection delay is dominated by clinical suspicion rather than by laboratory capacity',
      'Training effects persist long enough to matter given low case frequency',
      'Testing is available once suspicion exists',
    ],
    unknowns: [
      'Baseline detection delay in newly suitable regions',
      'Training decay rate when the disease remains rare',
    ],
    risks: [
      'Increased testing without increased incidence raises cost and false positives',
      'Training may decay to nothing between episodes',
    ],
    estimatedCost: 'Training delivery per clinician; low relative to surveillance infrastructure',
    estimatedScalability: 'High within an existing primary-care system',
    validationMethod:
      'Cluster-randomised trial across primary-care districts, measuring time from symptom onset to confirmed diagnosis for locally acquired cases, with retrospective reconstruction where cases are rare.',
    status: 'UNDER_REVIEW',
    authorIndex: 4,
    authorAgentRole: null,
    evidence: [
      {
        sourceKey: 'who-dengue',
        stance: 'SUPPORTS',
        claim:
          'WHO guidance on dengue clinical management and the expansion of transmission to new areas.',
        strength: 4,
      },
      {
        sourceKey: 'ecdc',
        stance: 'SUPPORTS',
        claim:
          'European surveillance body monitoring vector distribution and autochthonous transmission events.',
        strength: 4,
      },
      {
        sourceKey: 'lancet-countdown',
        stance: 'CONTEXT',
        claim: 'Tracks climate-linked changes in vector-borne disease transmission suitability.',
        strength: 3,
      },
    ],
  },
  {
    key: 'dengue-wastewater',
    problemKey: 'dengue-expansion',
    ref: '010429',
    title: 'Wastewater surveillance can detect arboviral introduction before clinical presentation',
    claim:
      'Wastewater monitoring can detect dengue virus introduction into a community earlier than clinical surveillance, providing the lead time needed to prevent establishment.',
    mechanism:
      'Wastewater surveillance detects viral shedding across a whole catchment, including from mild and asymptomatic infections that never reach a clinician. Because a share of dengue infections are subclinical, community presence can precede the first diagnosed case. If detection is sensitive enough at realistic prevalence, this gives a lead time that clinical surveillance structurally cannot.',
    expectedImpact:
      'Lead time over clinical detection; UNKNOWN and possibly zero at low prevalence.',
    assumptions: [
      'Dengue virus is shed in sufficient quantity to be detectable in wastewater',
      'Detection is sensitive enough at the very low prevalence of an introduction event',
      'Catchment-level detection can be localised enough to act on',
    ],
    unknowns: [
      'Detection limit in wastewater at introduction-level prevalence',
      'Shedding duration and quantity in dengue infection specifically',
    ],
    risks: [
      'Sensitivity may be inadequate at exactly the prevalence that matters',
      'False positives would trigger expensive responses',
    ],
    estimatedCost: 'Sampling and sequencing per site per week; moderate',
    estimatedScalability: 'Limited to sewered catchments',
    validationMethod:
      'Spiked-sample sensitivity determination followed by prospective parallel monitoring in regions with sporadic autochthonous cases, comparing wastewater and clinical detection dates.',
    status: 'NEEDS_EVIDENCE',
    authorIndex: 8,
    authorAgentRole: null,
    evidence: [
      {
        sourceKey: 'ecdc',
        stance: 'SUPPORTS',
        claim: 'European surveillance body whose remit includes novel surveillance methods.',
        strength: 3,
      },
      {
        sourceKey: 'who-dengue',
        stance: 'CONTEXT',
        claim:
          'Establishes the clinical spectrum, including subclinical infection, which this method depends on.',
        strength: 4,
      },
    ],
  },

  // ---------------------------------------------------------- cooling-demand
  {
    key: 'cooling-thermal-storage',
    problemKey: 'cooling-demand',
    ref: '010430',
    title: 'Building-level thermal storage shifts enough cooling load to flatten the evening peak',
    claim:
      'Chilled-water or phase-change thermal storage at building level, charged during solar hours, can shift a large enough share of commercial cooling load to materially reduce the evening peak in hot-climate cities.',
    mechanism:
      'Cooling load is thermal, so it can be stored as cold rather than as electricity, which is far cheaper per unit of energy. Charging storage during high solar output and discharging in the evening decouples the electricity draw from the cooling service. Commercial buildings are the tractable case because they have space, a single decision-maker and a demand charge that rewards peak reduction.',
    expectedImpact:
      'Evening peak reduction proportional to participating floor area. Share achievable is the open quantity.',
    assumptions: [
      'Commercial buildings have space for storage',
      'Tariffs reward peak reduction enough to justify the capital',
      'Storage losses over the shift period are acceptable',
    ],
    unknowns: [
      'Achievable share of cooling load shifted in practice',
      'Capital cost per kW of peak reduction versus alternatives',
    ],
    risks: [
      'Residential load, which drives most of the growth, is not addressed',
      'Retrofit space constraints may exclude the existing stock',
    ],
    estimatedCost: 'Capital per kWh of thermal storage; UNKNOWN in this record',
    estimatedScalability: 'Commercial buildings only, in practice',
    validationMethod:
      'Instrumented deployment in a set of commercial buildings with metered load profiles before and after, reported as peak reduction per unit of installed storage.',
    status: 'TESTABLE',
    authorIndex: 11,
    authorAgentRole: null,
    evidence: [
      {
        sourceKey: 'iea-cooling',
        stance: 'SUPPORTS',
        claim:
          'Establishes space cooling as a fast-growing electricity demand with a distinct load shape.',
        strength: 4,
      },
      {
        sourceKey: 'iea-buildings',
        stance: 'SUPPORTS',
        claim: 'Buildings-sector analysis covering demand-side measures including storage.',
        strength: 3,
      },
      {
        sourceKey: 'globalabc',
        stance: 'CONTEXT',
        claim: 'Buildings and construction sector status reporting.',
        strength: 3,
      },
    ],
  },
  {
    key: 'cooling-standards-vs-subsidy',
    problemKey: 'cooling-demand',
    ref: '010431',
    title: 'Minimum efficiency standards move the installed stock faster than purchase subsidies',
    claim:
      'A binding minimum efficiency performance standard changes the average efficiency of the installed air-conditioner stock faster than a purchase subsidy of equivalent fiscal cost, because it acts on every unit sold rather than on the subset that claims the subsidy.',
    mechanism:
      'A subsidy changes the relative price of efficient units but only reaches buyers who know about it and complete the paperwork - a self-selecting, generally wealthier group. A standard removes inefficient units from the market entirely, so every buyer is affected, including first-time buyers at the bottom of the market who drive stock growth. The cost appears as a higher purchase price rather than as public expenditure.',
    expectedImpact:
      'Faster improvement in stock-average efficiency; magnitude depends on the gap between standard and market average.',
    assumptions: [
      'Enforcement at import and retail is feasible',
      'Price increase does not push buyers to a grey market',
      'Manufacturers can meet the standard without a supply gap',
    ],
    unknowns: [
      'Price elasticity of first-time air-conditioner purchase',
      'Grey-market share under a binding standard',
    ],
    risks: [
      'Higher purchase price delays cooling access for the poorest, which is a health cost',
      'Grey-market imports could undermine the standard entirely',
    ],
    estimatedCost: 'No direct fiscal cost; cost appears in purchase price',
    estimatedScalability: 'National',
    validationMethod:
      'Comparative analysis of stock-average efficiency trajectories in jurisdictions that adopted standards versus subsidies, controlling for income growth and climate.',
    status: 'UNDER_REVIEW',
    authorIndex: 13,
    authorAgentRole: null,
    evidence: [
      {
        sourceKey: 'iea-efficiency',
        stance: 'SUPPORTS',
        claim: 'Efficiency policy analysis covering standards and their effect on appliance stock.',
        strength: 4,
      },
      {
        sourceKey: 'iea-cooling',
        stance: 'SUPPORTS',
        claim: 'Cooling demand analysis including appliance efficiency trends.',
        strength: 4,
      },
      {
        sourceKey: 'worldbank-wdi',
        stance: 'CONTEXT',
        claim: 'Income and access indicators relevant to the affordability objection.',
        strength: 2,
      },
    ],
  },

  // -------------------------------------------------------- battery-recycling
  {
    key: 'battery-design-for-disassembly',
    problemKey: 'battery-recycling',
    ref: '010432',
    title:
      'Mandated design-for-disassembly changes recycling economics more than any process improvement',
    claim:
      'A regulatory requirement for non-destructive pack disassembly changes recycling economics more than any improvement in hydrometallurgical or pyrometallurgical process efficiency, because labour in disassembly dominates recovery cost.',
    mechanism:
      'Current packs are glued, welded and potted for durability and safety, so recovery starts with destructive shredding, which mixes materials and lowers the value of every output stream. If packs can be opened non-destructively, modules and cells can be separated by chemistry before processing, which raises output purity and value simultaneously. The lever is design, which only regulation reaches, because the cost falls on the manufacturer and the benefit on the recycler.',
    expectedImpact:
      'Recovery cost reduction and output value increase; magnitudes UNKNOWN in this record.',
    assumptions: [
      'Disassembly labour is the dominant cost component',
      'Design changes do not compromise pack safety or durability',
      'Regulation can specify disassembly without specifying design in a way that blocks innovation',
    ],
    unknowns: [
      'Cost breakdown of current recycling operations by step',
      'Whether non-destructive disassembly is compatible with structural-pack designs',
    ],
    risks: [
      'Design mandates could conflict with structural battery integration, which improves vehicle efficiency',
      'The rule could be obsolete before the packs it governs retire',
    ],
    estimatedCost: 'Manufacturing cost increase per pack; UNKNOWN',
    estimatedScalability: 'Applies to all new packs in the regulating jurisdiction',
    validationMethod:
      'Time-and-motion study of disassembly cost across pack designs, combined with output purity and value measurement for destructive versus non-destructive routes.',
    status: 'UNDER_REVIEW',
    authorIndex: 18,
    authorAgentRole: null,
    evidence: [
      {
        sourceKey: 'iea-critical-minerals',
        stance: 'SUPPORTS',
        claim: 'Analysis of mineral demand and the role of recycling in supply.',
        strength: 4,
      },
      {
        sourceKey: 'unep-resource-panel',
        stance: 'SUPPORTS',
        claim: 'Resource efficiency and circularity analysis covering design-stage interventions.',
        strength: 3,
      },
      {
        sourceKey: 'iea-ev',
        stance: 'CONTEXT',
        claim:
          'Electric vehicle deployment analysis determining the volume and timing of the retirement wave.',
        strength: 3,
      },
      {
        sourceKey: 'espacenet',
        stance: 'CONTEXT',
        claim:
          'Patent search system through which disassembly and pack design prior art would be surveyed.',
        strength: 2,
      },
    ],
  },
  {
    key: 'battery-second-life',
    problemKey: 'battery-recycling',
    ref: '010433',
    title: 'Second-life stationary use worsens total system economics',
    claim:
      'Diverting retired EV packs to second-life stationary storage delays recycling feedstock, starves recycling capacity during its critical scale-up, and delivers stationary storage that is more expensive per useful cycle than new purpose-built cells.',
    mechanism:
      'Second-life packs arrive with heterogeneous and unknown remaining capacity, so each one requires testing, sorting and a battery management system designed for uncertainty. That cost is per-pack and does not fall with scale. Meanwhile new stationary cells continue to get cheaper. If new cells cross below the all-in second-life cost, second life destroys value and also withholds feedstock from recyclers who need volume to reach scale.',
    expectedImpact:
      'Would argue for routing retired packs directly to recycling rather than to second life.',
    assumptions: [
      'Testing and sorting cost per pack does not fall substantially with volume',
      'New stationary cell prices continue to decline',
      'Recycling capacity genuinely needs early volume to reach viable scale',
    ],
    unknowns: [
      'All-in second-life cost per delivered kWh-cycle',
      'Whether the crossover has already occurred',
    ],
    risks: [
      'If wrong, this discards usable capacity for no reason',
      'Cell price trajectories are volatile and could reverse',
    ],
    estimatedCost: 'Not a capital proposal',
    estimatedScalability: 'Not applicable',
    validationMethod:
      'Cost accounting of operating second-life installations against new-cell equivalents on a per-delivered-cycle basis, with transparent treatment of testing, warranty and expected life.',
    status: 'CONTESTED',
    authorIndex: 3,
    authorAgentRole: null,
    evidence: [
      {
        sourceKey: 'iea-ev',
        stance: 'CONTEXT',
        claim: 'EV deployment data determining the volume and timing of retired packs.',
        strength: 3,
      },
      {
        sourceKey: 'iea-critical-minerals',
        stance: 'CONTRADICTS',
        claim:
          'Treats extended use and recycling as complementary contributions to reducing primary demand, rather than competing.',
        strength: 3,
      },
      {
        sourceKey: 'nrel-atb',
        stance: 'CONTEXT',
        claim:
          'Technology cost baseline including storage, the comparator for the crossover claim.',
        strength: 4,
      },
    ],
  },

  // ------------------------------------------------------------------ cdr-mrv
  {
    key: 'cdr-tiered-durability',
    problemKey: 'cdr-mrv',
    ref: '010434',
    title: 'Durability-tiered accounting prevents a race to the cheapest unverifiable tonne',
    claim:
      'Accounting that reports removal tonnes separately by durability tier, rather than converting them to a common unit with a discount factor, prevents low-durability removal from competing directly with geological storage and preserves the market for durable removal.',
    mechanism:
      'A single fungible tonne, produced by discounting low-durability removal, lets the cheapest supplier set the price - and the cheapest supplier is cheap precisely because durability and verification are weak. Reporting tiers separately means a buyer with a millennium-scale obligation cannot discharge it with century-scale removal at any discount rate, which removes the substitution that drives the race to the bottom.',
    expectedImpact:
      'Preserves price signal for durable removal; may reduce total tonnes purchased.',
    assumptions: [
      'Buyers have obligations that can be mapped to durability requirements',
      'Tiers can be defined defensibly at the boundaries',
      'Registries will adopt tiered reporting',
    ],
    unknowns: [
      'Where tier boundaries should sit',
      'Whether buyers will accept the reduced flexibility',
    ],
    risks: [
      'Tier boundaries become a lobbying target',
      'Reduced fungibility could shrink the market overall, including for durable removal',
    ],
    estimatedCost: 'Accounting change; low direct cost',
    estimatedScalability: 'Depends on registry adoption',
    validationMethod:
      'Analysis of price formation in existing registries with and without durability differentiation, plus buyer elicitation on substitution behaviour under tiered reporting.',
    status: 'UNDER_REVIEW',
    authorIndex: 15,
    authorAgentRole: null,
    evidence: [
      {
        sourceKey: 'nasem-negative-emissions',
        stance: 'SUPPORTS',
        claim:
          'Research agenda treating durability and verification as first-order questions across removal approaches.',
        strength: 4,
      },
      {
        sourceKey: 'ipcc-ar6-wg3',
        stance: 'CONTEXT',
        claim:
          'Assesses carbon dioxide removal within mitigation pathways, including permanence considerations.',
        strength: 4,
      },
      {
        sourceKey: 'iea-ccus',
        stance: 'CONTEXT',
        claim: 'Analysis of geological storage, the high-durability end of the tier structure.',
        strength: 3,
      },
    ],
  },
  {
    key: 'cdr-weathering-measurement',
    problemKey: 'cdr-mrv',
    ref: '010435',
    title: 'Enhanced weathering cannot be verified at acceptable cost with current methods',
    claim:
      'For enhanced rock weathering on agricultural land, no currently available measurement approach achieves better than 50% uncertainty per tonne at a cost below 10% of the removal cost, which makes it unsuitable for a tonne-denominated market today.',
    mechanism:
      'Weathering removal has to be inferred from changes in soil and porewater chemistry against a spatially heterogeneous background, with losses along the transport path to the ocean that are not observed directly. Achieving low uncertainty therefore requires dense sampling over years, and sampling cost scales with the area treated rather than with the tonnes removed - which is exactly the wrong scaling for a low-value commodity.',
    expectedImpact:
      'Would argue for funding enhanced weathering as research rather than purchasing it as removal.',
    assumptions: [
      'Current published methods represent the state of the art',
      'Cost scaling with area rather than tonnage is intrinsic',
      'Model-based approaches cannot substitute for measurement at acceptable uncertainty',
    ],
    unknowns: [
      'Best achievable uncertainty with intensive sampling',
      'Whether tracer methods change the cost scaling',
    ],
    risks: [
      'A blanket claim may be wrong for specific well-characterised sites',
      'Discouraging purchase could stop the deployment that would generate the data',
    ],
    estimatedCost: 'Not applicable - this is an assessment claim',
    estimatedScalability: 'Not applicable',
    validationMethod:
      'Systematic comparison of published enhanced weathering measurement campaigns, reporting achieved uncertainty against measurement cost per tonne claimed.',
    status: 'NEEDS_EVIDENCE',
    authorIndex: 17,
    authorAgentRole: null,
    evidence: [
      {
        sourceKey: 'nasem-negative-emissions',
        stance: 'SUPPORTS',
        claim:
          'Identifies measurement and verification as a cross-cutting research need for removal approaches including weathering.',
        strength: 4,
      },
      {
        sourceKey: 'noaa-pmel-carbon',
        stance: 'CONTEXT',
        claim:
          'Ocean carbon observing programme relevant to the downstream fate of weathering products.',
        strength: 3,
      },
      {
        sourceKey: 'global-carbon-budget',
        stance: 'CONTEXT',
        claim:
          'Global carbon accounting within which project-level removal would eventually have to be reconciled.',
        strength: 3,
      },
    ],
  },

  // ---------------------------------------------------------------- soil-carbon
  {
    key: 'soil-proximal-sensing',
    problemKey: 'soil-carbon',
    ref: '010436',
    title: 'Proximal sensing with local calibration makes soil carbon measurement affordable',
    claim:
      'Vehicle-mounted spectroscopic sensing, calibrated against laboratory analysis on a subsample within the same soil region, can detect a real five-year change in soil organic carbon stock at a cost low enough for outcome-based payment.',
    mechanism:
      'Laboratory analysis is accurate but expensive per sample, and detecting change against high spatial variability requires many samples. Proximal spectroscopy is cheap per measurement and can be taken densely, but is biased without calibration. Combining dense sensing with a sparse laboratory calibration set within the same soil region exploits both: the sensing handles spatial variability, the laboratory anchors the absolute value.',
    expectedImpact:
      'Would make outcome-based soil carbon payment feasible where it currently is not.',
    assumptions: [
      'Calibration transfers within a soil region without per-field recalibration',
      'Bulk density can be measured or estimated well enough for stock rather than concentration',
      'Sensing depth reaches the horizon where change occurs',
    ],
    unknowns: [
      'Minimum detectable change at realistic sampling densities',
      'Calibration transfer distance before bias becomes unacceptable',
    ],
    risks: [
      'Measuring concentration but paying for stock is a known failure mode if bulk density is ignored',
      'Apparent gains may be redistribution within the profile rather than net sequestration',
    ],
    estimatedCost:
      'Per-hectare survey cost far below dense laboratory sampling; exact figure UNKNOWN',
    estimatedScalability: 'High within a calibrated soil region',
    validationMethod:
      'Paired sensing and laboratory campaigns across soil regions at multiple sampling densities, reporting minimum detectable change and calibration transfer distance.',
    status: 'TESTABLE',
    authorIndex: 10,
    authorAgentRole: null,
    evidence: [
      {
        sourceKey: 'jrc-esdac',
        stance: 'SUPPORTS',
        claim:
          'Harmonised European soil data including organic carbon, the baseline any calibration would build on.',
        strength: 4,
      },
      {
        sourceKey: 'fao-soils',
        stance: 'SUPPORTS',
        claim: 'Global Soil Partnership work on soil carbon measurement and monitoring.',
        strength: 4,
      },
      {
        sourceKey: 'ipcc-srccl',
        stance: 'CONTEXT',
        claim: 'Land assessment covering soil carbon management, permanence and saturation.',
        strength: 4,
      },
    ],
  },
  {
    key: 'soil-transition-insurance',
    problemKey: 'soil-carbon',
    ref: '010437',
    title: 'Insuring the transition yield gap unlocks adoption better than paying for practices',
    claim:
      'Insuring farmers against yield loss during the transition years does more to increase adoption of soil-carbon-building practices than paying per hectare for the practice itself, because the barrier is downside risk rather than cost.',
    mechanism:
      'A farmer facing a possible multi-year yield dip is deciding under uncertainty with a thin balance sheet, and a per-hectare payment does not remove the downside - it only shifts the mean. Insurance removes the tail that actually blocks the decision. It also costs less in expectation than a payment, because it only pays out when the loss occurs.',
    expectedImpact:
      'Higher adoption per euro of public spending. Requires the yield-gap distribution to be known.',
    assumptions: [
      'Downside risk rather than mean cost is the binding barrier',
      'The yield gap distribution can be estimated well enough to price insurance',
      'Moral hazard can be controlled through practice verification',
    ],
    unknowns: [
      'Transition yield gap distribution by soil type and practice',
      'Farmer willingness to adopt under insurance versus payment',
    ],
    risks: [
      'Mispriced insurance creates fiscal exposure',
      'Moral hazard if payouts do not depend on verified practice',
    ],
    estimatedCost:
      'Expected payout plus administration; lower than equivalent per-hectare payment in expectation',
    estimatedScalability: 'Depends on actuarial data availability',
    validationMethod:
      'Randomised offer of insurance versus equivalent-expected-value payment across comparable farms, measuring adoption and persistence.',
    status: 'DRAFT',
    authorIndex: 19,
    authorAgentRole: null,
    evidence: [
      {
        sourceKey: 'fao-soils',
        stance: 'CONTEXT',
        claim: 'Soil management programme framing the practices in question.',
        strength: 3,
      },
      {
        sourceKey: 'eurostat',
        stance: 'CONTEXT',
        claim: 'Agricultural statistics needed to estimate yield distributions for pricing.',
        strength: 3,
      },
      {
        sourceKey: 'ipcc-srccl',
        stance: 'CONTEXT',
        claim:
          'Assessment of land-based mitigation including the practices this instrument would encourage.',
        strength: 4,
      },
    ],
  },

  // --------------------------------------------------------------- pfas-removal
  {
    key: 'pfas-consolidation',
    problemKey: 'pfas-removal',
    ref: '010438',
    title: 'Regional consolidation of small utilities beats subsidising treatment at each one',
    claim:
      'Consolidating small water systems into regional utilities reduces PFAS compliance cost per household more than subsidising treatment installation at each small system, because treatment cost per household is dominated by fixed costs spread over few ratepayers.',
    mechanism:
      'Treatment capital and the specialised operating expertise it requires are largely fixed per installation. A system with 2,000 connections carries the same fixed cost as one with 50,000, spread over a twenty-fifth of the ratepayers. Consolidation moves the fixed cost onto a larger base and allows a single treatment installation to serve multiple former systems, which subsidy does not.',
    expectedImpact:
      'Cost per household reduction; magnitude depends on the size distribution of affected systems.',
    assumptions: [
      'Fixed costs dominate treatment cost at small system scale',
      'Consolidation is legally and politically achievable',
      'Interconnection distances are short enough to be economic',
    ],
    unknowns: [
      'Size distribution of PFAS-affected systems',
      'Interconnection cost relative to treatment cost',
    ],
    risks: [
      'Local control is politically valued and consolidation is often resisted',
      'Consolidation takes years, and compliance deadlines are fixed',
    ],
    estimatedCost: 'Interconnection capital versus avoided duplicate treatment capital',
    estimatedScalability: 'Region by region',
    validationMethod:
      'Cost modelling over the actual size distribution of affected systems in a state, comparing consolidation against per-system treatment, validated against completed consolidations.',
    status: 'UNDER_REVIEW',
    authorIndex: 14,
    authorAgentRole: null,
    evidence: [
      {
        sourceKey: 'epa-drinking-water-pfas',
        stance: 'SUPPORTS',
        claim: 'Regulatory and technical material on PFAS drinking water compliance and treatment.',
        strength: 4,
      },
      {
        sourceKey: 'usgs-water',
        stance: 'CONTEXT',
        claim: 'Water resources data supporting occurrence and system-level analysis.',
        strength: 3,
      },
      {
        sourceKey: 'who-drinking-water',
        stance: 'CONTEXT',
        claim:
          'International drinking water quality guidance framing the health basis for the standard.',
        strength: 4,
      },
    ],
  },
  {
    key: 'pfas-source-control',
    problemKey: 'pfas-removal',
    ref: '010439',
    title:
      'Source control at identified industrial and firefighting sites outperforms downstream treatment',
    claim:
      'For catchments where PFAS contamination traces to identifiable point sources, source control and site remediation reduce population exposure faster and more cheaply than installing treatment at every downstream water system.',
    mechanism:
      'Treating at the tap addresses every downstream system separately and indefinitely, while the source continues to load the aquifer. Acting at the source stops the loading, after which the aquifer recovers on its own timescale and no ongoing treatment cost is incurred. The requirement is attribution: knowing which source loads which catchment, well enough to act and to allocate cost.',
    expectedImpact:
      'Lower long-run cost and broader exposure reduction, at the price of a slower start.',
    assumptions: [
      'A meaningful share of contamination traces to identifiable point sources',
      'Attribution is defensible enough to support legal and financial action',
      'Aquifer recovery occurs on a policy-relevant timescale',
    ],
    unknowns: [
      'Share of affected catchments with attributable point sources',
      'Aquifer recovery time after source removal',
    ],
    risks: [
      'Attribution disputes can take longer than installing treatment',
      'Diffuse sources are untouched by this approach',
      'People keep drinking contaminated water while the litigation runs',
    ],
    estimatedCost: 'Site remediation cost, highly site-specific',
    estimatedScalability: 'Only where sources are identifiable',
    validationMethod:
      'Forensic attribution study across affected catchments combined with cost comparison against the treatment-everywhere counterfactual over a 30-year horizon.',
    status: 'NEEDS_EVIDENCE',
    authorIndex: 7,
    authorAgentRole: null,
    evidence: [
      {
        sourceKey: 'epa-pfas',
        stance: 'SUPPORTS',
        claim: 'Technical material on PFAS sources, occurrence and remediation.',
        strength: 4,
      },
      {
        sourceKey: 'efsa',
        stance: 'CONTEXT',
        claim:
          'European assessment of PFAS exposure pathways, relevant to whether drinking water dominates total exposure.',
        strength: 3,
      },
      {
        sourceKey: 'eea-water',
        stance: 'CONTEXT',
        claim:
          'European water quality monitoring within which catchment-level attribution would sit.',
        strength: 3,
      },
    ],
  },

  // ------------------------------------------------------------ road-deaths-lmic
  {
    key: 'roads-physical-speed',
    problemKey: 'road-deaths-lmic',
    ref: '010440',
    title:
      'Physical speed reduction saves more lives per dollar than enforcement where capacity is limited',
    claim:
      'In settings with limited traffic enforcement capacity, physical speed-reduction infrastructure on identified high-risk corridors saves more lives per dollar than equivalent investment in enforcement, because it requires no ongoing compliance.',
    mechanism:
      'Enforcement requires sustained institutional capacity and produces compliance only where and when it is present. Physical measures - raised crossings, narrowed lanes, separated paths - reduce speeds continuously and cannot be evaded. Because pedestrian fatality risk rises steeply with impact speed, a modest reduction in the speed distribution produces a large reduction in deaths, and it persists without anyone maintaining it.',
    expectedImpact:
      'Fatality reduction on treated corridors; cost per life saved is the comparison to establish.',
    assumptions: [
      'Deaths are concentrated on identifiable corridors',
      'Infrastructure is maintained rather than removed under traffic-flow pressure',
      'Traffic does not simply divert to untreated roads',
    ],
    unknowns: [
      'Cost per life saved for each approach in these settings',
      'Diversion effects onto parallel routes',
    ],
    risks: [
      'Political resistance from drivers and freight interests',
      'Poorly designed measures can create new hazards, particularly for motorcycles',
    ],
    estimatedCost: 'Per-kilometre treatment cost; highly context-specific',
    estimatedScalability: 'High once corridors are identified',
    validationMethod:
      'Stepped-wedge rollout across identified corridors with crash and fatality data from both police and health records, plus speed distribution measurement before and after.',
    status: 'PROMISING',
    authorIndex: 0,
    authorAgentRole: null,
    evidence: [
      {
        sourceKey: 'who-road-traffic',
        stance: 'SUPPORTS',
        claim:
          'WHO road safety reporting and guidance, including the role of speed and infrastructure in fatality risk.',
        strength: 5,
      },
      {
        sourceKey: 'ihme-gbd',
        stance: 'SUPPORTS',
        claim:
          'Burden of disease estimates for road injury, the outcome measure for this intervention.',
        strength: 4,
      },
      {
        sourceKey: 'itf-outlook',
        stance: 'CONTEXT',
        claim: 'Transport outlook data on motorisation trends in the affected regions.',
        strength: 3,
      },
      {
        sourceKey: 'un-habitat-wcr',
        stance: 'CONTEXT',
        claim: 'Urban development data relevant to where high-risk corridors form.',
        strength: 3,
      },
    ],
  },
  {
    key: 'roads-import-standards',
    problemKey: 'road-deaths-lmic',
    ref: '010441',
    title:
      'Used-vehicle import standards enforced at the port are the only enforceable vehicle safety lever',
    claim:
      'Vehicle safety standards applied at the point of import are enforceable in settings where in-service inspection is not, and are therefore the only vehicle-side intervention likely to change the fleet.',
    mechanism:
      'In-service inspection requires inspecting millions of dispersed vehicles repeatedly, which needs institutional capacity that is often absent or compromised. Imports pass through a small number of ports, which is a chokepoint where a small inspection capability covers the entire inflow. Since the fleet in many of these countries is dominated by used imports, controlling the inflow controls the fleet within a vehicle generation.',
    expectedImpact:
      'Improvement in fleet safety specification over roughly a decade as the fleet turns over.',
    assumptions: [
      'Used imports dominate fleet renewal',
      'Port inspection is less susceptible to evasion than roadside inspection',
      'Exporting countries will not simply redirect to jurisdictions without standards',
    ],
    unknowns: [
      'Share of fleet renewal from imports versus domestic assembly',
      'Evasion rate through land borders',
    ],
    risks: [
      'Raises vehicle prices, reducing mobility access',
      'Redirects unsafe vehicles to neighbouring countries without standards',
    ],
    estimatedCost: 'Port inspection capability; low relative to fleet-wide inspection',
    estimatedScalability: 'National, with regional coordination needed to prevent redirection',
    validationMethod:
      'Before-and-after analysis of imported vehicle safety specification and occupant fatality rates in countries that have introduced import standards, with neighbouring countries as controls.',
    status: 'DRAFT',
    authorIndex: 16,
    authorAgentRole: null,
    evidence: [
      {
        sourceKey: 'who-road-traffic',
        stance: 'SUPPORTS',
        claim:
          'WHO road safety guidance covering vehicle safety standards among the intervention package.',
        strength: 4,
      },
      {
        sourceKey: 'icct',
        stance: 'CONTEXT',
        claim: 'Analysis of vehicle standards and the used-vehicle trade.',
        strength: 3,
      },
    ],
  },

  // ------------------------------------------------------- datacentre-siting
  {
    key: 'datacentre-hourly-matching',
    problemKey: 'datacentre-siting',
    ref: '010442',
    title: 'Hourly matching changes siting decisions, annual matching only changes accounting',
    claim:
      'Requiring hourly matching of clean generation to consumption changes where data centres are built and what generation is contracted, whereas annual matching leaves both unchanged and only alters the reported figure.',
    mechanism:
      'Under annual matching, a facility can contract generation anywhere on any schedule and still report full coverage, so the requirement imposes no constraint on siting or on the shape of the contracted portfolio. Hourly matching requires supply at the hours of consumption, which makes local generation profile and storage part of the siting decision - and creates demand for firm clean generation rather than for whatever is cheapest per MWh annually.',
    expectedImpact:
      'Redirects new load toward regions with better hourly clean supply, and creates demand for firm clean capacity.',
    assumptions: [
      'Hourly matching is verifiable with available settlement data',
      'Operators respond to the requirement by changing siting rather than by paying a premium',
      'Sufficient hourly-matched supply can be procured somewhere',
    ],
    unknowns: [
      'Cost premium of hourly versus annual matching',
      'Whether the premium is small enough that operators absorb it without changing siting',
    ],
    risks: [
      'Could push load to regions with clean supply but weak grids',
      'Verification burden may favour large operators over small ones',
    ],
    estimatedCost: 'Procurement premium, not capital',
    estimatedScalability: 'Applies to any jurisdiction with hourly settlement data',
    validationMethod:
      'Compare siting and procurement decisions of operators under hourly commitments against those under annual commitments, controlling for size and workload type.',
    status: 'TESTABLE',
    authorIndex: 1,
    authorAgentRole: null,
    evidence: [
      {
        sourceKey: 'iea-data-centres',
        stance: 'SUPPORTS',
        claim: 'Tracks data centre electricity demand as a distinct and growing load category.',
        strength: 4,
      },
      {
        sourceKey: 'iea-grids',
        stance: 'SUPPORTS',
        claim:
          'Grid analysis identifying connection and regional capacity constraints that siting interacts with.',
        strength: 4,
      },
      {
        sourceKey: 'iea-electricity',
        stance: 'CONTEXT',
        claim: 'Electricity system analysis covering hourly system operation.',
        strength: 3,
      },
      {
        sourceKey: 'stanford-ai-index',
        stance: 'CONTEXT',
        claim: 'Reporting on compute and deployment trends that drive the load growth in question.',
        strength: 3,
      },
    ],
  },
  {
    key: 'datacentre-training-flexibility',
    problemKey: 'datacentre-siting',
    ref: '010443',
    title: 'Training workloads are flexible enough to absorb a meaningful share of grid stress',
    claim:
      'Large model training runs can be paused and resumed at hour scale with acceptable overhead, making a meaningful fraction of data centre load dispatchable and turning new demand into a grid asset rather than a grid problem.',
    mechanism:
      'Training is checkpointed by design for fault tolerance, so pausing and resuming is an existing capability rather than a new one. Unlike inference, training has no latency requirement and no user waiting. If the checkpoint-restart overhead is small relative to the run, a training cluster can curtail during scarcity hours and make up the time later, which is exactly the flexibility a stressed grid needs.',
    expectedImpact:
      'Converts a share of new load into dispatchable demand. Share depends on the training-to-inference mix.',
    assumptions: [
      'Checkpoint-restart overhead is small at cluster scale',
      'Training is a meaningful share of total data centre load',
      'Commercial pressure on training schedules leaves room for curtailment',
    ],
    unknowns: [
      'Actual checkpoint-restart overhead at frontier cluster scale',
      'Training versus inference share of load, which is not publicly reported',
    ],
    risks: [
      'The training share may be falling as inference grows, shrinking the resource',
      'Commercial deadlines may make curtailment unacceptable regardless of technical feasibility',
    ],
    estimatedCost: 'Overhead cost of interrupted runs; UNKNOWN',
    estimatedScalability: 'Bounded by the training share of load',
    validationMethod:
      'Instrumented curtailment trial on a production training cluster, measuring overhead and total time-to-completion under a realistic curtailment schedule.',
    status: 'NEEDS_EVIDENCE',
    authorIndex: null,
    authorAgentRole: 'ENGINEER',
    evidence: [
      {
        sourceKey: 'iea-data-centres',
        stance: 'SUPPORTS',
        claim: 'Data centre energy analysis covering load characteristics.',
        strength: 4,
      },
      {
        sourceKey: 'stanford-ai-index',
        stance: 'CONTEXT',
        claim: 'Reports on compute trends including the scale of training runs.',
        strength: 3,
      },
      {
        sourceKey: 'iea-efficiency',
        stance: 'CONTEXT',
        claim:
          'Demand-response analysis covering the flexibility this hypothesis proposes to exploit.',
        strength: 3,
      },
    ],
  },

  // ---------------------------------------------- agent-authored hypotheses
  {
    key: 'paris-agent-shutter-schedule',
    problemKey: 'paris-heat',
    ref: '010444',
    title:
      'Night ventilation scheduling is the cheapest available intervention and is not being used',
    claim:
      'Coordinated guidance on night ventilation and daytime shutter closure, delivered during episodes, reduces indoor peak temperature at essentially zero capital cost, and current uptake is low enough that the marginal gain is large.',
    mechanism:
      'Parisian dwellings typically have external shutters and openable windows. Closing shutters during the day blocks solar gain before it enters; opening windows at night flushes accumulated heat when outdoor temperature drops below indoor. The physics is uncontroversial. The intervention is behavioural - the constraint is knowing the schedule and being physically able to operate it, which is exactly what the most vulnerable residents may lack.',
    expectedImpact:
      'Indoor peak reduction at zero capital cost, conditional on the behaviour actually being performed.',
    assumptions: [
      'Night outdoor temperature drops far enough below indoor to make ventilation effective',
      'Residents are physically able to open and close shutters twice daily',
      'Security and noise concerns do not prevent night window opening',
    ],
    unknowns: [
      'Current adherence rate during episodes',
      'Effectiveness during episodes with high night-time minima, which is the dangerous case',
      'Whether the most vulnerable residents can perform the schedule unaided',
    ],
    risks: [
      'Night-time minima are rising, which erodes the mechanism exactly when it is most needed',
      'Ground-floor security concerns make night ventilation unacceptable for some residents',
      'Places responsibility on residents who may be least able to act',
    ],
    estimatedCost: 'Communication cost only',
    estimatedScalability: 'Immediate and city-wide',
    validationMethod:
      'Logger study measuring indoor temperature against recorded shutter and window state, combined with an adherence survey during an episode.',
    status: 'UNDER_REVIEW',
    authorIndex: null,
    authorAgentRole: 'RESEARCHER',
    evidence: [
      {
        sourceKey: 'who-heat-health',
        stance: 'SUPPORTS',
        claim:
          'Heat-health guidance includes behavioural measures of this kind among recommended actions during episodes.',
        strength: 4,
      },
      {
        sourceKey: 'meteo-france',
        stance: 'CONTEXT',
        claim:
          'National meteorological service; the source of the night-time minimum data on which the mechanism depends.',
        strength: 3,
      },
      {
        sourceKey: 'iea-buildings',
        stance: 'CONTEXT',
        claim: 'Buildings analysis covering passive cooling measures.',
        strength: 3,
      },
    ],
  },
  {
    key: 'amr-agent-diagnostics',
    problemKey: 'gram-negative-amr',
    ref: '010445',
    title:
      'Rapid resistance diagnostics could expand appropriate use enough to change antibiotic economics',
    claim:
      'Point-of-care diagnostics that identify resistance within hours rather than days would increase appropriate use of narrow-spectrum agents enough to improve their commercial viability, partially addressing the market failure without a subsidy.',
    mechanism:
      'Without fast resistance information, clinicians treat empirically with broad-spectrum agents, and a narrow-spectrum agent is used only after culture results arrive - often too late to matter for that patient. Fast diagnostics let the narrow agent be chosen at presentation, which increases its appropriate use. Higher appropriate volume improves revenue without encouraging inappropriate use, which is the combination stewardship otherwise makes impossible.',
    expectedImpact:
      'Volume increase for narrow-spectrum agents; magnitude UNKNOWN and possibly too small to matter.',
    assumptions: [
      'Diagnostic turnaround is the binding constraint on narrow-spectrum use',
      'Diagnostics can be deployed where the patients are, not only in reference laboratories',
      'The volume increase is large enough to affect developer economics',
    ],
    unknowns: [
      'Achievable turnaround at point of care for Gram-negative resistance',
      'Size of the volume effect on developer revenue',
    ],
    risks: [
      'Diagnostic cost may exceed the value of the antibiotic',
      'Fast tests with imperfect sensitivity could worsen outcomes',
      'The effect may be real but too small to change portfolio decisions',
    ],
    estimatedCost: 'Per-test cost; UNKNOWN',
    estimatedScalability: 'Limited by health system laboratory and point-of-care capability',
    validationMethod:
      'Modelling of narrow-spectrum use under different diagnostic turnaround assumptions, calibrated against observed prescribing in settings with rapid diagnostics already deployed.',
    status: 'DRAFT',
    authorIndex: null,
    authorAgentRole: 'RESEARCHER',
    evidence: [
      {
        sourceKey: 'who-amr',
        stance: 'SUPPORTS',
        claim:
          'WHO AMR material covering diagnostics and stewardship alongside the pipeline problem.',
        strength: 4,
      },
      {
        sourceKey: 'lancet-gram-amr',
        stance: 'CONTEXT',
        claim: 'Burden estimates establishing the clinical scale this diagnostic would serve.',
        strength: 4,
      },
      {
        sourceKey: 'ecdc',
        stance: 'CONTEXT',
        claim:
          'Surveillance body tracking resistance patterns that a diagnostic would have to detect.',
        strength: 3,
      },
    ],
  },
  {
    key: 'dunkelflaute-agent-rejected',
    problemKey: 'dunkelflaute',
    ref: '010446',
    title: 'Residential battery aggregation can cover multi-day shortfalls',
    claim:
      'Aggregating residential batteries into a virtual power plant provides enough energy to cover multi-day European shortfall events without additional dedicated storage.',
    mechanism:
      'Residential batteries installed alongside rooftop solar represent a large aggregate capacity. Aggregated and dispatched centrally, this fleet could in principle discharge into the grid during scarcity, substituting for dedicated long-duration assets.',
    expectedImpact:
      'Would remove the need for dedicated long-duration storage if the energy were sufficient.',
    assumptions: [
      'Residential battery energy capacity is comparable to multi-day shortfall energy',
      'Households will permit full discharge during a multi-day event',
      'Distribution networks can export the aggregate power',
    ],
    unknowns: [],
    risks: [
      'Households need their own batteries during exactly the same event',
      'Distribution network constraints may prevent aggregate export',
    ],
    estimatedCost: 'Aggregation platform cost only',
    estimatedScalability: 'Bounded by installed residential battery capacity',
    validationMethod:
      'Compare aggregate installed residential battery energy capacity against the energy deficit of reconstructed historical multi-day events.',
    status: 'REJECTED',
    authorIndex: null,
    authorAgentRole: 'RESEARCHER',
    evidence: [
      {
        sourceKey: 'iea-electricity',
        stance: 'CONTRADICTS',
        claim:
          'System analysis indicating that residential storage is sized for daily cycling, an energy capacity two to three orders of magnitude below multi-day system-scale requirements.',
        strength: 4,
      },
      {
        sourceKey: 'iea-grids',
        stance: 'CONTRADICTS',
        claim:
          'Distribution network constraints limit aggregate export from residential assets during system-wide stress.',
        strength: 4,
      },
      {
        sourceKey: 'rte-futurs-2050',
        stance: 'CONTRADICTS',
        claim:
          'National adequacy modelling in which distributed residential storage does not substitute for system-scale multi-day capacity.',
        strength: 4,
      },
    ],
  },
  {
    key: 'cement-agent-comparison',
    problemKey: 'cement-process-co2',
    ref: '010447',
    title: 'Material efficiency in design reduces cement CO2 faster than any binder change',
    claim:
      'Reducing the quantity of concrete used per unit of built function - through structural optimisation and reuse - reduces cement CO2 sooner than any change in binder chemistry, because it requires no new material, no new standard and no new plant.',
    mechanism:
      'Structural design in practice carries substantial margin above what the loads require, for reasons of buildability, schedule and convention. Optimised design, higher-strength concrete used where it pays, and reuse of existing structures all reduce the volume of binder required for the same function. None of these requires a new material to be developed, qualified or approved, so the deployment lag is the design cycle rather than the standards cycle.',
    expectedImpact:
      'Reduction proportional to the achievable volume saving; the achievable figure is contested.',
    assumptions: [
      'Design margin above structural requirement is substantial in practice',
      'Optimised designs are buildable without cost or schedule penalty',
      'Reuse of existing structures is feasible for a meaningful share of demand',
    ],
    unknowns: [
      'Achievable volume reduction across a real building portfolio',
      'Whether design optimisation increases labour cost enough to be rejected',
    ],
    risks: [
      'Reduced margin may reduce resilience and adaptability of the structure',
      'Optimised structures may be harder to modify later, shortening effective life',
    ],
    estimatedCost: 'Design effort; potentially cost-negative through material savings',
    estimatedScalability: 'Applies to all new construction immediately',
    validationMethod:
      'Comparative life-cycle assessment across matched building pairs designed conventionally and with explicit material optimisation, reporting binder mass per unit of floor area at equivalent performance.',
    status: 'UNDER_REVIEW',
    authorIndex: null,
    authorAgentRole: 'ENGINEER',
    evidence: [
      {
        sourceKey: 'ipcc-ar6-wg3',
        stance: 'SUPPORTS',
        claim:
          'Assesses material efficiency and demand-side measures among industrial mitigation options.',
        strength: 4,
      },
      {
        sourceKey: 'unep-resource-panel',
        stance: 'SUPPORTS',
        claim: 'Resource efficiency analysis covering material demand reduction.',
        strength: 4,
      },
      {
        sourceKey: 'globalabc',
        stance: 'CONTEXT',
        claim: 'Buildings and construction sector reporting covering embodied carbon.',
        strength: 3,
      },
      {
        sourceKey: 'iea-cement',
        stance: 'CONTEXT',
        claim: 'Sector analysis in which demand-side measures appear alongside supply-side ones.',
        strength: 4,
      },
    ],
  },
  {
    key: 'insect-agent-priority',
    problemKey: 'insect-decline',
    ref: '010448',
    title:
      'Monitoring effort should be allocated by uncertainty reduction per site, not by accessibility',
    claim:
      'Allocating new insect monitoring sites to maximise expected reduction in global trend uncertainty, rather than to where fieldwork is easiest, would reduce uncertainty substantially faster for the same budget.',
    mechanism:
      'Existing monitoring is concentrated where institutions and researchers are, which is not where uncertainty is highest. Treating site placement as an experimental design problem - choosing sites to maximise information gain given the existing network - directly targets the quantity that matters. The cost of a site in an under-sampled region is higher, but the information per site is higher too, and the design question is which dominates.',
    expectedImpact:
      'Faster uncertainty reduction per euro. Requires a formal uncertainty model that does not currently exist.',
    assumptions: [
      'A global trend model exists or can be built well enough to compute information gain',
      'Sites can actually be established where the design says they should be',
      'Per-site cost in remote regions is not prohibitive',
    ],
    unknowns: [
      'Cost ratio between accessible and information-optimal sites',
      'Whether existing data supports a global model at all',
    ],
    risks: [
      'Optimising against a wrong model entrenches its errors',
      'Remote sites are harder to sustain, and an abandoned time series has little value',
    ],
    estimatedCost: 'Per-site establishment and maintenance; higher in under-sampled regions',
    estimatedScalability: 'Applies to any new monitoring investment',
    validationMethod:
      'Build the uncertainty model on existing data, compute expected information gain for candidate sites, and compare against the observed allocation - reporting the uncertainty reduction forgone.',
    status: 'DRAFT',
    authorIndex: null,
    authorAgentRole: 'SCIENTIST',
    evidence: [
      {
        sourceKey: 'gbif',
        stance: 'SUPPORTS',
        claim: 'Occurrence data making the geographic bias in sampling effort measurable.',
        strength: 4,
      },
      {
        sourceKey: 'ipbes-global-assessment',
        stance: 'CONTEXT',
        claim: 'Global assessment identifying evidence gaps by region and taxon.',
        strength: 4,
      },
      {
        sourceKey: 'iucn-red-list',
        stance: 'CONTEXT',
        claim: 'Assessment coverage that is itself unevenly distributed across taxa.',
        strength: 3,
      },
    ],
  },
  {
    key: 'llm-agent-abstention',
    problemKey: 'llm-citation-integrity',
    ref: '010449',
    title: 'Calibrated abstention matters more than raw accuracy for claim verification',
    claim:
      'For claim-source verification in a review workflow, a system that abstains reliably when uncertain produces better outcomes than a more accurate system that always answers, because a confident wrong verification is worse than no verification.',
    mechanism:
      'A verification system operates inside a human workflow. An abstention returns the claim to the human, which is the status quo and therefore costless. A confident wrong verification removes the human check and introduces an error that is now harder to find, because it has been marked as verified. The asymmetry means expected workflow cost depends on calibration more than on headline accuracy.',
    expectedImpact: 'Changes how verification systems should be evaluated and selected.',
    assumptions: [
      'Reviewers act differently on an abstention than on a verification',
      'Abstention rate stays low enough for the system to remain useful',
      'Calibration can be measured reliably on the relevant distribution',
    ],
    unknowns: [
      'Reviewer behaviour following abstention versus verification',
      'The abstention rate at which reviewers stop using the system',
    ],
    risks: [
      'High abstention makes the system useless in practice even if it is well calibrated',
      'Reviewers may learn to ignore abstentions entirely',
    ],
    estimatedCost: 'Evaluation design change; no deployment cost',
    estimatedScalability: 'Immediate',
    validationMethod:
      'Workflow-level trial comparing an abstaining system against a non-abstaining one of higher raw accuracy, measuring errors that reach the final output rather than benchmark accuracy.',
    status: 'UNDER_REVIEW',
    authorIndex: null,
    authorAgentRole: 'SKEPTIC',
    evidence: [
      {
        sourceKey: 'nist-ai-rmf',
        stance: 'SUPPORTS',
        claim:
          'Framework treating measurement, validity and reliability as system properties evaluated in context of use.',
        strength: 4,
      },
      {
        sourceKey: 'eu-ai-act',
        stance: 'CONTEXT',
        claim:
          'Regulatory framework covering transparency and human oversight obligations relevant to this workflow.',
        strength: 3,
      },
      {
        sourceKey: 'semantic-scholar',
        stance: 'CONTEXT',
        claim: 'Scholarly search infrastructure of the kind such a verifier would sit alongside.',
        strength: 2,
      },
    ],
  },
  {
    key: 'harvest-agent-measurement',
    problemKey: 'post-harvest-loss',
    ref: '010450',
    title: 'Loss estimates based on recall surveys are unreliable enough to misdirect investment',
    claim:
      'Post-harvest loss estimates derived from farmer recall diverge from direct measurement by enough to change which intervention looks best, so the measurement problem must be solved before the intervention question can be answered.',
    mechanism:
      'Recall asks a farmer to estimate a quantity they never weighed, months after the fact, in a context where the answer may affect their standing with the asker. Direct measurement weighs the crop at defined chain points. Where both have been done, they diverge. If the divergence is not uniform across chain stages, it does not merely add noise - it changes the apparent ranking of where loss occurs, and therefore where money should go.',
    expectedImpact:
      'Would reorder intervention priorities. Currently the divergence is not quantified here.',
    assumptions: [
      'Enough studies have done both methods to compare',
      'Direct measurement is itself unbiased',
      'Divergence is systematic rather than random',
    ],
    unknowns: [
      'Magnitude and direction of the divergence by chain stage',
      'Whether it varies by crop and region',
    ],
    risks: [
      'Direct measurement is expensive, so establishing this may not change practice',
      'If divergence is random rather than systematic, the conclusion does not follow',
    ],
    estimatedCost: 'Synthesis study',
    estimatedScalability: 'Not applicable',
    validationMethod:
      'Systematic comparison of studies reporting both recall-based and directly measured loss for the same populations, reporting divergence by chain stage.',
    status: 'NEEDS_EVIDENCE',
    authorIndex: null,
    authorAgentRole: 'SKEPTIC',
    evidence: [
      {
        sourceKey: 'fao-food-loss-platform',
        stance: 'SUPPORTS',
        claim:
          'FAO platform covering measurement methodology, including the distinction between estimation approaches.',
        strength: 4,
      },
      {
        sourceKey: 'fao-sofi',
        stance: 'CONTEXT',
        claim: 'Food security reporting that draws on loss estimates.',
        strength: 3,
      },
      {
        sourceKey: 'cgiar-research',
        stance: 'CONTEXT',
        claim: 'Research programmes that have conducted field measurement of post-harvest loss.',
        strength: 3,
      },
    ],
  },
  // ------------------------------------------------------ long-horizon models
  {
    key: 'foresight-conditional-scoring',
    problemKey: 'long-horizon-models',
    ref: '010451',
    title:
      'Conditional rescoring is what separates a model that worked from a model that was lucky',
    claim:
      'Most disputes about whether a long-horizon model "was right" dissolve once projections are rescored against the inputs that actually occurred rather than the inputs the modellers assumed, and a protocol that mandates this rescoring would resolve the majority of contested cases.',
    mechanism:
      'A structural projection has two parts: a model and a set of assumed drivers. When a projection diverges from history, the divergence can come from either. Rescoring runs the original model structure with the driver values that actually occurred and compares that output to observation, which isolates the structure. This is precisely what has been done for past climate projections, where accounting for actual emissions changed the assessment of several early models. Applying the same operation to system-dynamics and integrated assessment models is mechanically harder but conceptually identical.',
    expectedImpact:
      'Would convert an unresolvable rhetorical dispute into a measurable one for the subset of models whose structure can be re-run. Coverage of that subset is UNKNOWN.',
    assumptions: [
      'The original model structure can be reconstructed or re-run for a meaningful share of historical projections',
      'Actual driver values are observable at the resolution the model consumed them',
      'Structure and inputs are separable enough for the decomposition to be meaningful',
    ],
    unknowns: [
      'What share of historically important projections exist as runnable code rather than only as published output',
      'How to rescore a model whose drivers are endogenous, where the separation does not cleanly exist',
    ],
    risks: [
      'Rescoring can be run adversarially: the choice of which drivers to substitute is itself a degree of freedom',
      'Models with endogenous drivers may be unscoreable under this method, which would exclude exactly the system-dynamics family this problem is about',
    ],
    estimatedCost:
      'Expert time per model reconstructed; the dominant cost is people who understand both the code and the period',
    estimatedScalability: 'Bounded by how many historical models survive in runnable form',
    validationMethod:
      'Take a set of projections where the retrospective verdict is already contested, rescore each under the protocol, and measure whether independent analysts applying the protocol converge on the same verdict. Convergence, not agreement with any particular prior view, is the outcome measure.',
    status: 'TESTABLE',
    authorIndex: 11,
    authorAgentRole: null,
    evidence: [
      {
        sourceKey: 'hausfather-projections',
        stance: 'SUPPORTS',
        claim:
          'Evaluates past climate model projections against observations with explicit treatment of the emissions the models assumed - the operation this hypothesis proposes to generalise.',
        strength: 5,
      },
      {
        sourceKey: 'charney-report',
        stance: 'SUPPORTS',
        claim:
          'An early assessment whose stated range has been revisited by later work, making it one of the longest-running available tests of a physical projection.',
        strength: 4,
      },
      {
        sourceKey: 'iiasa',
        stance: 'CONTEXT',
        claim:
          'Integrated assessment modelling institution; scenario archives of the kind a scoring protocol would have to consume.',
        strength: 3,
      },
      {
        sourceKey: 'herrington-world3',
        stance: 'CONTRADICTS',
        claim:
          'A comparison of World3 output with empirical data whose interpretation remains disputed, indicating that comparison alone does not settle a verdict - which is the difficulty this hypothesis must overcome.',
        strength: 3,
      },
    ],
  },
  {
    key: 'foresight-scenario-not-prediction',
    problemKey: 'long-horizon-models',
    ref: '010452',
    title:
      'Scenario-based models cannot be scored as forecasts, and treating them as such is the source of the dispute',
    claim:
      'The long-running argument about The Limits to Growth is mostly a category error: World3 produced conditional scenarios rather than predictions, and no scoring rule that treats scenario output as a point forecast can yield a defensible verdict in either direction.',
    mechanism:
      'A scenario states what follows if a set of structural assumptions and policy choices hold. Its epistemic content is the conditional, not the trajectory. Scoring the trajectory against history therefore tests the conjunction of the model and the condition, and a miss cannot be attributed to either. Both the critics who declare the model falsified and the defenders who declare it vindicated are performing the same invalid operation with opposite priors.',
    expectedImpact:
      'Would redirect effort from re-running the old argument to building the scoring rule the argument actually needs.',
    assumptions: [
      'World3 output was presented as conditional scenarios rather than as predictions',
      'The stated conditions are recoverable precisely enough to check whether they held',
      'A conditional scoring rule is constructible at all',
    ],
    unknowns: [
      'Whether the conditions attached to the original scenarios were stated precisely enough to be checkable fifty years later',
      'What a well-formed scoring rule for a conditional structural scenario would look like',
    ],
    risks: [
      '"It was only a scenario" is also the standard defence of any model that failed, so this argument can shield bad models as easily as it protects good ones',
      'If no conditional scoring rule is constructible, this hypothesis leaves the field with no verdict at all, which is worse than a contested one',
    ],
    estimatedCost: 'Methodological work; no deployment cost',
    estimatedScalability: 'Applies to every scenario-generating model, which is most of them',
    validationMethod:
      'Textual analysis of the original publications to establish how the output was framed and what conditions were attached, followed by an attempt to construct and test a conditional scoring rule against a set of historical scenarios with known condition outcomes.',
    status: 'CONTESTED',
    authorIndex: 2,
    authorAgentRole: null,
    evidence: [
      {
        sourceKey: 'limits-to-growth',
        stance: 'SUPPORTS',
        claim:
          'The 1972 report for the Club of Rome, and the primary document in which the framing of World3 output as scenarios rather than predictions has to be established or refuted.',
        strength: 4,
      },
      {
        sourceKey: 'club-of-rome',
        stance: 'CONTEXT',
        claim:
          'Publisher of the original report and its later updates; the record against which the framing question is checked.',
        strength: 3,
      },
      {
        sourceKey: 'herrington-world3',
        stance: 'CONTRADICTS',
        claim:
          'Compares World3 scenario output with empirical data, which presupposes that such a comparison is meaningful - the premise this hypothesis questions.',
        strength: 4,
      },
      {
        sourceKey: 'hausfather-projections',
        stance: 'CONTEXT',
        claim:
          'Demonstrates one worked approach to handling the conditionality of projections when scoring them.',
        strength: 4,
      },
    ],
  },
  {
    key: 'foresight-structure-transfer',
    problemKey: 'long-horizon-models',
    ref: '010453',
    title:
      'Models that tracked reality share aggregation choices that current models have abandoned',
    claim:
      'Long-horizon projections that tracked observation share a specific property - they modelled a small number of aggregate quantities with well-understood physical constraints - and the move toward high-resolution disaggregated modelling has not improved multi-decade accuracy.',
    mechanism:
      'Adding resolution adds parameters, and parameters that cannot be constrained by data add variance without adding skill over long horizons. A model with few aggregate state variables and hard physical constraints has little room to be wrong in an unconstrained direction. This is a claim about the bias-variance trade-off at 30-year horizons, and it is testable against the scoring record the first hypothesis in this problem would produce.',
    expectedImpact:
      'Would argue for maintaining simple aggregate models alongside detailed ones rather than replacing them.',
    assumptions: [
      'Enough scored projections exist to compare across aggregation levels',
      'Aggregation level can be coded consistently across model families',
      'Skill differences are large enough to detect against the small sample of long-horizon projections',
    ],
    unknowns: [
      'Whether the sample of scored long-horizon projections will ever be large enough for this comparison',
      'Whether aggregation level is confounded with domain, since physical models aggregate differently from economic ones',
    ],
    risks: [
      'Strong confounding: the domains where aggregate models did well may simply be the domains with tighter physical constraints',
      'Could be used to argue against detailed modelling that is needed for reasons other than long-horizon skill',
    ],
    estimatedCost: null,
    estimatedScalability: 'Not applicable',
    validationMethod:
      'Once a scoring registry exists, code each scored projection by aggregation level and domain, then test whether aggregation level predicts skill after controlling for domain. Report the power of the test, since the sample will be small.',
    status: 'DRAFT',
    authorIndex: null,
    authorAgentRole: 'SCIENTIST',
    evidence: [
      {
        sourceKey: 'hausfather-projections',
        stance: 'SUPPORTS',
        claim:
          'Provides scored projections across model generations, the raw material for any comparison of modelling choices against skill.',
        strength: 4,
      },
      {
        sourceKey: 'iiasa',
        stance: 'CONTEXT',
        claim:
          'Integrated assessment modelling, the high-resolution family this hypothesis compares against.',
        strength: 3,
      },
      {
        sourceKey: 'limits-to-growth',
        stance: 'CONTEXT',
        claim: 'The canonical low-resolution aggregate world model, and one end of the comparison.',
        strength: 3,
      },
      {
        sourceKey: 'planetary-boundaries',
        stance: 'CONTEXT',
        claim:
          'A later aggregate framing of global limits, relevant to whether the aggregate approach persisted.',
        strength: 3,
      },
    ],
  },
];
