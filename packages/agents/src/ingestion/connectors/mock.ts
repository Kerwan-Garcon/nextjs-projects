import type { RawDocument, SourceConnector } from '../connector.js';

/**
 * Seeded intake connectors.
 *
 * These stand in for the live feeds so the pipeline is exercisable end to end
 * with no network, no API keys and no dependency on what a publisher happened
 * to post today. Tests and CI run against these; `INTAKE_LIVE=true` swaps in
 * the real ones, and nothing else about the pipeline changes.
 *
 * Two rules keep them honest.
 *
 * Metadata points at documents that exist: the title, the publisher and the URL
 * are real and can be opened. The `body` is intake prose written for this demo,
 * describing what the document covers and what it leaves open, and it is
 * flagged SYNTHETIC_DEMO all the way through the pipeline. It is never
 * presented as a quotation from the publisher and it asserts no finding of its
 * own.
 *
 * And they are shaped like what the live connectors actually return - feed
 * items and bulletins that name a consequence, not catalogue pages - because a
 * stand-in that the relevance gate would never see in production tests nothing
 * useful about the gate.
 */

function doc(entry: Omit<RawDocument, 'bodyProvenance'>): RawDocument {
  return { ...entry, bodyProvenance: 'SYNTHETIC_DEMO' };
}

export class InstitutionalReportsConnector implements SourceConnector {
  readonly name = 'institutional-reports';
  readonly description =
    "Flagship assessments from intergovernmental institutions. Stands in for the publishers' newsroom feeds.";
  readonly allowedHosts = ['iea.org', 'unep.org', 'who.int', 'ipbes.net', 'fao.org'];

  async fetch(): Promise<RawDocument[]> {
    return [
      doc({
        externalId: 'unep-emissions-gap-2024',
        title: 'Emissions Gap Report 2024: No more hot air',
        url: 'https://www.unep.org/resources/emissions-gap-report-2024',
        publisher: 'United Nations Environment Programme',
        publishedAt: '2024-10',
        body: 'Intake record for the UNEP annual assessment of the gap between pledged greenhouse gas emissions reductions and the reductions consistent with the Paris temperature goals. The report covers national commitments, projected warming under current policy, and the sectoral distribution of the shortfall. Open gap flagged at intake: the report quantifies the emissions gap but the conditions under which a pledged reduction becomes a delivered one remain unclear, and the attribution of delivery failure between finance, permitting and political turnover has not been quantified.',
        suggestedDomains: ['climate', 'energy'],
      }),
      doc({
        externalId: 'iea-oil-gas-net-zero',
        title: 'Emissions from Oil and Gas Operations in Net Zero Transitions',
        url: 'https://www.iea.org/reports/emissions-from-oil-and-gas-operations-in-net-zero-transitions',
        publisher: 'International Energy Agency',
        publishedAt: '2023-05',
        body: 'Intake record for the IEA assessment of methane emissions and flaring from oil and gas operations, and of the abatement measures available to the sector. Covers measured versus reported methane emissions, the cost curve of abatement, and the role of operational practice. Open gap flagged at intake: the discrepancy between reported and measured methane emissions is documented but not resolved, and further research is needed on which measurement regimes close it at scale.',
        suggestedDomains: ['energy', 'climate'],
      }),
      doc({
        externalId: 'ipbes-invasive-species',
        title: 'Assessment Report on Invasive Alien Species and their Control',
        url: 'https://www.ipbes.net/ias',
        publisher: 'IPBES',
        publishedAt: '2023-09',
        body: 'Intake record for the IPBES thematic assessment on invasive alien species, covering rates of introduction, documented damage to ecosystems and food production, and the control measures in use. The assessment describes economic losses and biodiversity loss attributable to established invasions across regions. Open gap flagged at intake: the cost-effectiveness of early detection and rapid response against long-run containment is assessed unevenly across regions, and the evidence base for island and mainland contexts is not comparable.',
        suggestedDomains: ['biodiversity', 'food'],
      }),
      doc({
        externalId: 'fao-sofi',
        title: 'The State of Food Security and Nutrition in the World',
        url: 'https://www.fao.org/publications/sofi',
        publisher: 'Food and Agriculture Organization',
        publishedAt: '2024-07',
        body: 'Intake record for the annual FAO assessment of hunger, food insecurity and malnutrition. Covers the prevalence of undernourishment by region, the cost and affordability of a healthy diet, and stunting among children. Open gap flagged at intake: the drivers separating regions where food insecurity is falling from regions where it is rising are described but not disentangled, and the contribution of conflict, climate shocks and price transmission remains contested.',
        suggestedDomains: ['food', 'health'],
      }),
    ];
  }
}

export class HealthBulletinsConnector implements SourceConnector {
  readonly name = 'health-bulletins';
  readonly description =
    'Public-health fact sheets and surveillance pages. Stands in for WHO and ECDC bulletin feeds.';
  readonly allowedHosts = ['who.int', 'ecdc.europa.eu', 'epa.gov'];

  async fetch(): Promise<RawDocument[]> {
    return [
      doc({
        externalId: 'who-heat-health',
        title: 'Climate change: Heat and health',
        url: 'https://www.who.int/news-room/fact-sheets/detail/climate-change-heat-and-health',
        publisher: 'World Health Organization',
        publishedAt: '2024-05',
        body: 'Intake record for the WHO fact sheet on heat and health. Covers the physiological mechanisms of heat-related illness, the populations at elevated risk of heat-related mortality, and the components of a heat-health action plan. Open gap flagged at intake: the attribution of avoided deaths to specific interventions inside an action plan is not separated, so the relative contribution of early warning, cooling provision and clinical preparedness remains unclear.',
        suggestedDomains: ['health', 'climate', 'cities'],
      }),
      doc({
        externalId: 'who-amr',
        title: 'Antimicrobial resistance',
        url: 'https://www.who.int/news-room/fact-sheets/detail/antimicrobial-resistance',
        publisher: 'World Health Organization',
        publishedAt: '2023-11',
        body: 'Intake record for the WHO fact sheet on antimicrobial resistance. Covers the burden of drug-resistant infections, the drivers of resistance in human and animal use, and the state of the development pipeline. Open gap flagged at intake: the pipeline for new agents against carbapenem-resistant Gram-negative pathogens remains unresolved, and the market structure that would sustain such a pipeline has not been established.',
        suggestedDomains: ['health'],
      }),
      doc({
        externalId: 'who-household-air-pollution',
        title: 'Household air pollution and health',
        url: 'https://www.who.int/news-room/fact-sheets/detail/household-air-pollution-and-health',
        publisher: 'World Health Organization',
        publishedAt: '2023-12',
        body: 'Intake record for the WHO fact sheet on household air pollution. Covers exposure from cooking with solid fuels, the attributable disease burden including respiratory and cardiovascular mortality, and the clean-cooking transition. Open gap flagged at intake: the conditions under which a household that receives a clean cookstove keeps using it are poorly understood, and sustained-use rates after the first year have not been systematically measured.',
        suggestedDomains: ['health', 'energy', 'cities'],
      }),
    ];
  }
}

export class OpenDataPortalConnector implements SourceConnector {
  readonly name = 'open-data-portals';
  readonly description =
    'Public dataset catalogues and monitoring programmes. Stands in for data-portal harvesting.';
  readonly allowedHosts = ['wri.org', 'washdata.org', 'fao.org', 'globalforestwatch.org'];

  async fetch(): Promise<RawDocument[]> {
    return [
      doc({
        externalId: 'wri-water-stress',
        title: '25 countries, housing one-quarter of the population, face extremely high water stress',
        url: 'https://www.wri.org/insights/highest-water-stressed-countries',
        publisher: 'World Resources Institute',
        publishedAt: '2023-08',
        body: 'Intake record for the WRI analysis of basin-level water stress built on the Aqueduct dataset. Covers withdrawal-to-supply ratios by country, the population living under extremely high stress, and projected changes in demand. Open gap flagged at intake: basin-level indicators do not resolve the allocation question between agricultural, municipal and industrial users inside a stressed basin, and the distributional consequences of a given allocation rule remain unquantified.',
        suggestedDomains: ['water', 'food'],
      }),
      doc({
        externalId: 'jmp-washdata',
        title: 'Progress on household drinking water, sanitation and hygiene',
        url: 'https://washdata.org/',
        publisher: 'WHO/UNICEF Joint Monitoring Programme',
        publishedAt: '2023-07',
        body: 'Intake record for the JMP household monitoring programme for drinking water, sanitation and hygiene. Covers service-level ladders, the population without safely managed services, and contamination of household supplies. Open gap flagged at intake: service levels are measured at household level, but the maintenance failure modes that move a community back down the ladder are not systematically captured, and further research is needed on what sustains a service after installation.',
        suggestedDomains: ['water', 'health'],
      }),
    ];
  }
}

export const DEFAULT_CONNECTORS: readonly SourceConnector[] = Object.freeze([
  new InstitutionalReportsConnector(),
  new HealthBulletinsConnector(),
  new OpenDataPortalConnector(),
]);
