import type { RawDocument, SourceConnector } from '../connector.js';

/**
 * Seeded intake connectors.
 *
 * These stand in for the real feeds (institutional RSS, OpenAlex, data portals)
 * so the ingestion pipeline is exercisable end to end without a dozen API keys.
 * Metadata points at real publications; the `body` is descriptive intake text
 * written for this demo and flagged SYNTHETIC_DEMO, never presented as a quote
 * from the publisher.
 */

function doc(entry: Omit<RawDocument, 'bodyProvenance'>): RawDocument {
  return { ...entry, bodyProvenance: 'SYNTHETIC_DEMO' };
}

export class InstitutionalReportsConnector implements SourceConnector {
  readonly name = 'institutional-reports';
  readonly description =
    "Flagship reports from intergovernmental and national institutions. Stands in for the publishers' RSS feeds.";
  readonly allowedHosts = ['iea.org', 'unep.org', 'who.int', 'ipbes.net', 'fao.org'];

  async fetch(): Promise<RawDocument[]> {
    return [
      doc({
        externalId: 'iea-grids-2023',
        title: 'Electricity Grids and Secure Energy Transitions',
        url: 'https://www.iea.org/reports/electricity-grids-and-secure-energy-transitions',
        publisher: 'International Energy Agency',
        publishedAt: '2023-10',
        body: 'Intake record for the IEA report on electricity grids. The report examines grid investment, connection queues for renewable projects, and the ageing of existing transmission and distribution infrastructure. Open gap flagged at intake: connection queue length is reported but the causal decomposition between permitting, hardware supply and planning capacity is not resolved.',
        suggestedDomains: ['energy', 'cities'],
      }),
      doc({
        externalId: 'iea-critical-minerals',
        title: 'The Role of Critical Minerals in Clean Energy Transitions',
        url: 'https://www.iea.org/reports/the-role-of-critical-minerals-in-clean-energy-transitions',
        publisher: 'International Energy Agency',
        publishedAt: '2021-05',
        body: 'Intake record for the IEA assessment of mineral demand under clean energy scenarios. Open gap flagged at intake: end-of-life recovery rates for battery-grade lithium and the conditions under which recycled supply displaces primary extraction are not settled.',
        suggestedDomains: ['materials', 'energy'],
      }),
      doc({
        externalId: 'ipbes-invasive-species',
        title: 'Assessment Report on Invasive Alien Species and their Control',
        url: 'https://www.ipbes.net/ias',
        publisher: 'IPBES',
        publishedAt: '2023-09',
        body: 'Intake record for the IPBES thematic assessment on invasive alien species. Open gap flagged at intake: cost-effectiveness of early detection and rapid response versus long-run containment is assessed unevenly across regions.',
        suggestedDomains: ['biodiversity'],
      }),
    ];
  }
}

export class HealthBulletinsConnector implements SourceConnector {
  readonly name = 'health-bulletins';
  readonly description =
    'Public-health fact sheets and surveillance pages. Stands in for WHO/ECDC bulletin feeds.';
  readonly allowedHosts = ['who.int', 'ecdc.europa.eu', 'epa.gov'];

  async fetch(): Promise<RawDocument[]> {
    return [
      doc({
        externalId: 'who-heat-health',
        title: 'Climate change: Heat and health',
        url: 'https://www.who.int/news-room/fact-sheets/detail/climate-change-heat-and-health',
        publisher: 'World Health Organization',
        publishedAt: '2024-05',
        body: 'Intake record for the WHO fact sheet on heat and health. Covers physiological mechanisms of heat-related illness, populations at elevated risk, and heat-health action planning. Open gap flagged at intake: attribution of avoided deaths to specific interventions within an action plan is not separated.',
        suggestedDomains: ['health', 'climate', 'cities'],
      }),
      doc({
        externalId: 'who-amr',
        title: 'Antimicrobial resistance',
        url: 'https://www.who.int/news-room/fact-sheets/detail/antimicrobial-resistance',
        publisher: 'World Health Organization',
        publishedAt: '2023-11',
        body: 'Intake record for the WHO fact sheet on antimicrobial resistance. Open gap flagged at intake: the pipeline for new agents against carbapenem-resistant Gram-negative pathogens, and the market structure that would sustain it, remain unresolved.',
        suggestedDomains: ['health'],
      }),
    ];
  }
}

export class OpenDataPortalConnector implements SourceConnector {
  readonly name = 'open-data-portals';
  readonly description =
    'Public dataset catalogues. Stands in for data.gov / data.europa.eu harvesting.';
  readonly allowedHosts = ['wri.org', 'washdata.org', 'fao.org', 'globalforestwatch.org'];

  async fetch(): Promise<RawDocument[]> {
    return [
      doc({
        externalId: 'wri-aqueduct',
        title: 'Aqueduct Water Risk Atlas',
        url: 'https://www.wri.org/aqueduct',
        publisher: 'World Resources Institute',
        publishedAt: '2023-08',
        body: 'Intake record for the Aqueduct water risk dataset. Provides basin-level water stress, depletion and seasonal variability indicators. Open gap flagged at intake: basin-level indicators do not resolve the allocation question between agricultural, municipal and industrial users within a stressed basin.',
        suggestedDomains: ['water', 'food'],
      }),
      doc({
        externalId: 'jmp-washdata',
        title: 'WHO/UNICEF Joint Monitoring Programme for Water Supply, Sanitation and Hygiene',
        url: 'https://washdata.org/',
        publisher: 'WHO/UNICEF JMP',
        publishedAt: '2023-07',
        body: 'Intake record for the JMP household water and sanitation monitoring programme. Open gap flagged at intake: service-level ladders are measured at household level; the maintenance failure modes that move a community back down the ladder are not systematically captured.',
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
