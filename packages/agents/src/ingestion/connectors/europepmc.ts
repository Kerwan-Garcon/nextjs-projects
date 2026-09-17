import { sanitizeUntrusted, type DomainKey } from '@saveus/common';
import type { RawDocument, SourceConnector } from '../connector.js';
import type { HttpFetcher } from '../http.js';
import { stripHtml } from '../feed.js';

/**
 * Europe PMC intake.
 *
 * The scholarly connector, and the highest-signal source in the set: an
 * abstract is where authors state their own limitations, in the words the
 * relevance gate looks for ("remains unclear", "has not been quantified").
 * A newsroom item almost never does that; an abstract routinely does.
 *
 * Free, no API key, open-access filtered. OpenAlex would have been the other
 * candidate and was dropped: it now meters requests against a paid budget.
 *
 * Queries are written to ask for open problems in a domain rather than for
 * everything published in it - the filtering starts at the query, not after the
 * bytes have been paid for.
 */

const ENDPOINT = 'https://www.ebi.ac.uk/europepmc/webservices/rest/search';

export interface LiteratureQuery {
  /** The Europe PMC query string. */
  query: string;
  domains: DomainKey[];
  label: string;
}

/**
 * Each query asks for three things at once, because two of them is not enough.
 *
 * Gap language alone returns excellent science that is not a problem for this
 * board - a novel hyaena record, a bean-genotype metabolomics study, a silage
 * trial. Every one of those states an open question. So each query also pairs
 * the subject with a consequence term: mortality, scarcity, loss, exposure.
 * Filtering at the query costs nothing; filtering after the bytes have arrived
 * costs the publisher a request we did not need to make.
 */
export const LITERATURE_QUERIES: readonly LiteratureQuery[] = Object.freeze([
  {
    label: 'heat and health',
    query:
      '(ABSTRACT:"extreme heat" OR ABSTRACT:"heatwave") AND (ABSTRACT:"mortality" OR ABSTRACT:"hospitalisation" OR ABSTRACT:"excess deaths") AND (ABSTRACT:"remains unclear" OR ABSTRACT:"poorly understood" OR ABSTRACT:"not been quantified")',
    domains: ['health', 'climate', 'cities'],
  },
  {
    label: 'energy systems',
    query:
      '(ABSTRACT:"energy system" OR ABSTRACT:"electricity grid" OR ABSTRACT:"power system") AND (ABSTRACT:"reliability" OR ABSTRACT:"outage" OR ABSTRACT:"energy poverty" OR ABSTRACT:"curtailment") AND (ABSTRACT:"remains unclear" OR ABSTRACT:"further research is needed" OR ABSTRACT:"knowledge gap")',
    domains: ['energy'],
  },
  {
    label: 'water scarcity',
    query:
      '(ABSTRACT:"groundwater depletion" OR ABSTRACT:"water scarcity" OR ABSTRACT:"drinking water") AND (ABSTRACT:"population" OR ABSTRACT:"households" OR ABSTRACT:"contamination" OR ABSTRACT:"shortage") AND (ABSTRACT:"poorly understood" OR ABSTRACT:"remains unknown" OR ABSTRACT:"knowledge gap")',
    domains: ['water', 'food'],
  },
  {
    label: 'antimicrobial resistance',
    query:
      'ABSTRACT:"antimicrobial resistance" AND (ABSTRACT:"mortality" OR ABSTRACT:"treatment failure" OR ABSTRACT:"disease burden") AND (ABSTRACT:"knowledge gap" OR ABSTRACT:"remains unclear" OR ABSTRACT:"not been quantified")',
    domains: ['health'],
  },
  {
    label: 'food security',
    query:
      '(ABSTRACT:"crop yield" OR ABSTRACT:"food security" OR ABSTRACT:"malnutrition") AND (ABSTRACT:"climate" OR ABSTRACT:"drought" OR ABSTRACT:"yield loss") AND (ABSTRACT:"remains uncertain" OR ABSTRACT:"poorly understood" OR ABSTRACT:"further research is needed")',
    domains: ['food', 'climate'],
  },
  {
    label: 'biodiversity loss',
    query:
      '(ABSTRACT:"biodiversity loss" OR ABSTRACT:"species decline" OR ABSTRACT:"ecosystem collapse") AND (ABSTRACT:"drivers" OR ABSTRACT:"population decline") AND (ABSTRACT:"remains unknown" OR ABSTRACT:"poorly understood" OR ABSTRACT:"knowledge gap")',
    domains: ['biodiversity'],
  },
  {
    label: 'industrial decarbonisation',
    query:
      '(ABSTRACT:"cement" OR ABSTRACT:"steel production" OR ABSTRACT:"industrial decarbonisation") AND (ABSTRACT:"emissions" OR ABSTRACT:"cost") AND (ABSTRACT:"not been quantified" OR ABSTRACT:"remains unclear" OR ABSTRACT:"barriers")',
    domains: ['materials', 'climate'],
  },
  {
    label: 'air pollution',
    query:
      '(ABSTRACT:"air pollution" OR ABSTRACT:"particulate matter") AND (ABSTRACT:"mortality" OR ABSTRACT:"exposure" OR ABSTRACT:"disease burden") AND (ABSTRACT:"remains unclear" OR ABSTRACT:"poorly understood" OR ABSTRACT:"knowledge gap")',
    domains: ['health', 'cities'],
  },
]);

interface EuropePmcResult {
  id?: string;
  source?: string;
  doi?: string;
  title?: string;
  abstractText?: string;
  authorString?: string;
  journalTitle?: string;
  firstPublicationDate?: string;
  pubYear?: string;
  isOpenAccess?: string;
}

export class EuropePmcConnector implements SourceConnector {
  readonly name = 'europepmc';
  readonly description =
    'Open-access literature from Europe PMC, queried for abstracts that state an unresolved gap. Abstracts are where authors name their own limitations.';
  readonly allowedHosts = ['ebi.ac.uk', 'europepmc.org', 'doi.org'];

  constructor(
    private readonly fetcher: HttpFetcher,
    private readonly queries: readonly LiteratureQuery[] = LITERATURE_QUERIES,
    private readonly pageSize = 10,
  ) {}

  async fetch(): Promise<RawDocument[]> {
    const documents: RawDocument[] = [];
    const seen = new Set<string>();

    for (const entry of this.queries) {
      const url = buildUrl(entry.query, this.pageSize);
      const outcome = await this.fetcher.fetch(url);
      if (outcome.status !== 'OK') continue;

      let payload: { resultList?: { result?: EuropePmcResult[] } };
      try {
        payload = JSON.parse(outcome.body) as typeof payload;
      } catch {
        continue;
      }

      for (const result of payload.resultList?.result ?? []) {
        const document = toDocument(result, entry.domains);
        if (!document || seen.has(document.externalId)) continue;
        seen.add(document.externalId);
        documents.push(document);
      }
    }

    return documents;
  }
}

function buildUrl(query: string, pageSize: number): string {
  const params = new URLSearchParams({
    // Open access only: a paywalled abstract cannot be checked by a reader.
    query: `(${query}) AND OPEN_ACCESS:Y AND HAS_ABSTRACT:Y`,
    format: 'json',
    pageSize: String(pageSize),
    resultType: 'core',
    sort: 'P_PDATE_D desc',
  });
  return `${ENDPOINT}?${params.toString()}`;
}

function toDocument(result: EuropePmcResult, domains: DomainKey[]): RawDocument | null {
  const title = result.title?.replace(/\.$/, '').trim();
  const abstractText = result.abstractText?.trim();
  if (!title || !abstractText) return null;

  // Prefer the DOI: it is the citable identity and it outlives the index entry.
  const url = result.doi
    ? `https://doi.org/${result.doi}`
    : result.source && result.id
      ? `https://europepmc.org/article/${result.source}/${result.id}`
      : null;
  if (!url) return null;

  return {
    externalId: result.doi ?? `${result.source}:${result.id}`,
    title: sanitizeUntrusted(stripHtml(title), 400).text,
    url,
    publisher: result.journalTitle?.trim() || 'Europe PMC',
    publishedAt: result.firstPublicationDate ?? result.pubYear ?? null,
    // The author's own abstract, as indexed. Not our prose, and not a summary
    // we generated - which is why it can be trusted to contain gap language.
    body: sanitizeUntrusted(stripHtml(abstractText), 8_000).text,
    bodyProvenance: 'PUBLISHER_ABSTRACT',
    suggestedDomains: domains,
  };
}
