import { checkUrl, hostOf, type DomainKey } from '@saveus/common';
import type { RawDocument, SourceConnector } from '../connector.js';
import type { FetchState, HttpFetcher } from '../http.js';
import { parseFeed } from '../feed.js';

/**
 * Feed-based intake.
 *
 * Every feed below was checked to respond, to be a real syndication format, and
 * to belong to a publisher already on the platform's reliability list. There is
 * no HTML scraping anywhere in this file: scraping a page that was not offered
 * for machine reading is fragile, rude, and the first thing to break.
 *
 * What is deliberately absent: general news aggregators and press-release
 * wires. They carry volume, not problems, and the intake gate would throw
 * almost all of it away after we had already spent the request.
 */

export interface FeedDefinition {
  url: string;
  publisher: string;
  /** Domains to suggest before the classifier runs. */
  domains: DomainKey[];
}

export const INSTITUTIONAL_FEEDS: readonly FeedDefinition[] = Object.freeze([
  {
    url: 'https://www.who.int/rss-feeds/news-english.xml',
    publisher: 'World Health Organization',
    domains: ['health'],
  },
  {
    url: 'https://www.unep.org/rss.xml',
    publisher: 'United Nations Environment Programme',
    domains: ['climate', 'biodiversity'],
  },
  {
    url: 'https://www.eea.europa.eu/en/newsroom/news/rss.xml',
    publisher: 'European Environment Agency',
    domains: ['climate', 'water'],
  },
]);

export const JOURNAL_FEEDS: readonly FeedDefinition[] = Object.freeze([
  {
    url: 'https://www.nature.com/nclimate.rss',
    publisher: 'Nature Climate Change',
    domains: ['climate'],
  },
  {
    url: 'https://feeds.nature.com/nature/rss/current',
    publisher: 'Nature',
    domains: ['other'],
  },
  {
    // Planetary Health rather than the main Lancet: the same publisher, closer
    // to this board's subject, and a far higher share of research articles
    // versus commentary.
    url: 'https://www.thelancet.com/rssfeed/lanplh_current.xml',
    publisher: 'The Lancet Planetary Health',
    domains: ['health', 'climate'],
  },
]);

export const ANALYSIS_FEEDS: readonly FeedDefinition[] = Object.freeze([
  {
    url: 'https://www.carbonbrief.org/feed/',
    publisher: 'Carbon Brief',
    domains: ['climate', 'energy'],
  },
]);

/** Per-feed conditional-request state, supplied and persisted by the caller. */
export type FeedStateStore = {
  get(url: string): Promise<FetchState>;
  set(url: string, state: FetchState & { status: string; error: string | null }): Promise<void>;
};

export class FeedConnector implements SourceConnector {
  readonly allowedHosts: readonly string[];

  constructor(
    readonly name: string,
    readonly description: string,
    private readonly feeds: readonly FeedDefinition[],
    private readonly fetcher: HttpFetcher,
    private readonly state: FeedStateStore,
    private readonly itemsPerFeed = 25,
  ) {
    this.allowedHosts = [...new Set(feeds.map((feed) => hostOf(feed.url)))];
  }

  async fetch(): Promise<RawDocument[]> {
    const documents: RawDocument[] = [];

    for (const feed of this.feeds) {
      const previous = await this.state.get(feed.url);
      const outcome = await this.fetcher.fetch(feed.url, previous);

      if (outcome.status === 'NOT_MODIFIED') {
        await this.state.set(feed.url, { ...previous, status: 'NOT_MODIFIED', error: null });
        continue;
      }
      if (outcome.status === 'RATE_LIMITED') {
        await this.state.set(feed.url, {
          ...previous,
          status: 'RATE_LIMITED',
          error: `Publisher asked us to wait ${Math.round(outcome.retryAfterMs / 1000)}s`,
        });
        continue;
      }
      if (outcome.status === 'FAILED') {
        await this.state.set(feed.url, { ...previous, status: 'FAILED', error: outcome.reason });
        continue;
      }

      await this.state.set(feed.url, {
        etag: outcome.etag,
        lastModified: outcome.lastModified,
        status: 'OK',
        error: null,
      });

      for (const item of parseFeed(outcome.body).slice(0, this.itemsPerFeed)) {
        const url = resolveItemLink(item.link, feed.url);
        if (!url) continue;

        documents.push({
          externalId: item.id || url,
          title: item.title,
          url,
          publisher: feed.publisher,
          publishedAt: item.publishedAt,
          body: stripSyndicationFurniture(item.summary),
          // The text is the publisher's own summary as syndicated, not prose we
          // wrote and not the full article we did not fetch.
          bodyProvenance: 'PUBLISHER_ABSTRACT',
          suggestedDomains: feed.domains,
        });
      }
    }

    return documents;
  }
}

/**
 * Repair an item link against the feed it came from.
 *
 * Feed generators leak their own origin. The EEA's press-release feed, fetched
 * over HTTPS from www.eea.europa.eu, hands back item links pointing at
 * `http://10.140.145.84:3000/en/newsroom/...` - the address of the CMS behind
 * their load balancer. The path is real; the origin is a mistake. Every one of
 * those links was correctly refused by the SSRF guard, which cost the whole
 * feed.
 *
 * So a link whose host is not publicly addressable, or does not belong to the
 * feed's own host, is re-based onto the origin we actually fetched from. If the
 * result still does not check out, the item is dropped rather than followed.
 */
export function resolveItemLink(link: string, feedUrl: string): string | null {
  const feed = checkUrl(feedUrl);
  if (!feed.ok) return null;

  let candidate: URL;
  try {
    candidate = new URL(link, feed.url);
  } catch {
    return null;
  }

  const sameSite =
    candidate.hostname === feed.url.hostname ||
    hostOf(candidate.toString()) === hostOf(feed.url.toString());

  if (!sameSite || !checkUrl(candidate.toString()).ok) {
    const rebased = new URL(feed.url.toString());
    rebased.pathname = candidate.pathname;
    rebased.search = candidate.search;
    rebased.hash = '';
    candidate = rebased;
  }

  const checked = checkUrl(candidate.toString());
  return checked.ok ? checked.url.toString() : null;
}

/**
 * Syndication furniture. Publishers prepend their own page chrome to the
 * summary - Carbon Brief's leads with "Print article / Share" - and it travels
 * all the way into the candidate summary a curator reads. This removes the
 * leading run of it and nothing else: the aim is to stop a reader's first line
 * being a share button, not to rewrite the publisher's text.
 */
const FURNITURE =
  /^(?:\s*(?:print\s+article|share(?:\s+this)?|tweet|email\s+this|listen\s+to\s+this|read\s+more|subscribe|advertisement)\s*[|.•-]*\s*)+/i;

export function stripSyndicationFurniture(summary: string): string {
  return summary.replace(FURNITURE, '').trim();
}

export function institutionalConnector(fetcher: HttpFetcher, state: FeedStateStore): FeedConnector {
  return new FeedConnector(
    'institutional-feeds',
    'Newsrooms of intergovernmental and European institutions. Assessments and policy publications, which is where stated gaps live.',
    INSTITUTIONAL_FEEDS,
    fetcher,
    state,
  );
}

export function journalConnector(fetcher: HttpFetcher, state: FeedStateStore): FeedConnector {
  return new FeedConnector(
    'journal-feeds',
    'Tables of contents from peer-reviewed journals. High signal, and abstracts state their own limitations.',
    JOURNAL_FEEDS,
    fetcher,
    state,
  );
}

export function analysisConnector(fetcher: HttpFetcher, state: FeedStateStore): FeedConnector {
  return new FeedConnector(
    'analysis-feeds',
    'Specialist analysis desks. Secondary sources, classified MEDIUM reliability, useful for framing.',
    ANALYSIS_FEEDS,
    fetcher,
    state,
  );
}
