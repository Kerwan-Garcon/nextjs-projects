import { describe, expect, it } from 'vitest';
import {
  HttpFetcher,
  decodeEntities,
  parseFeed,
  parseRetryAfter,
  resolveItemLink,
  stripHtml,
  stripLeadingNoise,
  stripSyndicationFurniture,
} from '../src/index.js';
import { classifyDomains, extractClaims, identifiesOpenProblem } from '../src/ingestion/pipeline.js';

/* ------------------------------------------------------------------ */
/* Feed parsing                                                        */
/* ------------------------------------------------------------------ */

const RSS = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0">
  <channel>
    <title>Example newsroom</title>
    <item>
      <title>Heat&#8217;s effect on mortality remains unclear</title>
      <guid>https://example.org/a</guid>
      <link>https://example.org/a</link>
      <description>&lt;p&gt;Excess deaths rose 12&amp;#37; during the heatwave.&lt;/p&gt;</description>
      <pubDate>Tue, 01 Sep 2026 08:00:00 GMT</pubDate>
    </item>
    <item>
      <title>No link here</title>
      <description>Should be dropped.</description>
    </item>
  </channel>
</rss>`;

const ATOM = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Groundwater depletion is poorly understood</title>
    <id>tag:example.org,2026:1</id>
    <link rel="alternate" href="https://example.org/water"/>
    <summary>Abstraction exceeds recharge across the basin.</summary>
    <updated>2026-09-01T00:00:00Z</updated>
    <author><name>A. Researcher</name></author>
  </entry>
</feed>`;

describe('feed parsing', () => {
  it('reads RSS 2.0 and drops items with no link', () => {
    const items = parseFeed(RSS);
    expect(items).toHaveLength(1);
    expect(items[0]?.link).toBe('https://example.org/a');
    expect(items[0]?.publishedAt).toBe('2026-09-01T08:00:00.000Z');
  });

  it('decodes entities and strips the HTML a publisher put in the description', () => {
    const items = parseFeed(RSS);
    // U+2019, not an ASCII apostrophe: the entity decodes to the real character.
    expect(items[0]?.title).toContain('Heat\u2019s effect');
    expect(items[0]?.summary).toBe('Excess deaths rose 12% during the heatwave.');
    expect(items[0]?.summary).not.toContain('<p>');
  });

  it('reads Atom entries', () => {
    const items = parseFeed(ATOM);
    expect(items).toHaveLength(1);
    expect(items[0]?.link).toBe('https://example.org/water');
    expect(items[0]?.author).toBe('A. Researcher');
  });

  it('survives the junk publishers put in front of the XML declaration', () => {
    // A byte-order mark, and the Drupal theme-debug block UNEP actually serves.
    const bom = `${String.fromCharCode(0xfeff)}${RSS}`;
    const drupal = `\n\n<!-- THEME DEBUG -->\n<!-- BEGIN OUTPUT -->\n${RSS}`;
    expect(parseFeed(bom)).toHaveLength(1);
    expect(parseFeed(drupal)).toHaveLength(1);
    expect(stripLeadingNoise(bom).startsWith('<?xml')).toBe(true);
  });

  it('parses a feed with more than a thousand entity references', () => {
    // fast-xml-parser's expansion guard counts ordinary `&amp;` and throws past
    // a thousand of them, which silently cost us two real feeds.
    const many = Array.from(
      { length: 400 },
      (_, index) =>
        `<item><title>Caf&#233; &amp; co &#8217;${index}</title><link>https://example.org/${index}</link>` +
        `<description>Mortality &amp; morbidity remain unclear &amp; unquantified.</description></item>`,
    ).join('');
    const items = parseFeed(`<?xml version="1.0"?><rss><channel>${many}</channel></rss>`);
    expect(items).toHaveLength(400);
    expect(items[0]?.title).toContain('Café & co');
  });

  it('returns nothing rather than throwing on input that is not a feed', () => {
    expect(parseFeed('<html><body>not a feed</body></html>')).toEqual([]);
    expect(parseFeed('')).toEqual([]);
  });
});

describe('entity decoding', () => {
  it('decodes numeric, hex and known named references', () => {
    expect(decodeEntities('a &amp; b &#233; &#x2019; &nbsp;end')).toBe('a & b \u00e9 \u2019  end');
  });

  it('leaves unknown references alone rather than guessing', () => {
    expect(decodeEntities('&notarealentity; &#xD800;')).toBe('&notarealentity; &#xD800;');
  });

  it('decodes once, so a double-escaped tag does not unfold into markup', () => {
    expect(decodeEntities('&amp;lt;script&amp;gt;')).toBe('&lt;script&gt;');
  });

  it('removes scripts and styles with their contents', () => {
    expect(stripHtml('<p>keep</p><script>alert(1)</script>').trim()).toBe('keep');
  });
});

describe('feed item links', () => {
  it('keeps a link that is already on the publisher own host', () => {
    expect(
      resolveItemLink('https://www.eea.europa.eu/en/news/a', 'https://www.eea.europa.eu/rss.xml'),
    ).toBe('https://www.eea.europa.eu/en/news/a');
  });

  it('re-bases a link that leaks the publisher internal origin', () => {
    // The EEA feed really does hand back links to the CMS behind its load
    // balancer. The path is real; the origin is a mistake.
    expect(
      resolveItemLink(
        'http://10.140.145.84:3000/en/newsroom/news/heat',
        'https://www.eea.europa.eu/en/newsroom/news/rss.xml',
      ),
    ).toBe('https://www.eea.europa.eu/en/newsroom/news/heat');
  });

  it('resolves a relative link against the feed', () => {
    expect(resolveItemLink('/en/news/b', 'https://www.eea.europa.eu/rss.xml')).toBe(
      'https://www.eea.europa.eu/en/news/b',
    );
  });

  it('refuses a feed URL that does not check out', () => {
    expect(resolveItemLink('/a', 'http://localhost:3000/rss.xml')).toBeNull();
  });
});

describe('syndication furniture', () => {
  it('removes the page chrome a publisher prepends to its own summary', () => {
    expect(stripSyndicationFurniture('Print article\n Share\n Wildfires burning in Indonesia')).toBe(
      'Wildfires burning in Indonesia',
    );
  });

  it('leaves ordinary prose untouched', () => {
    const prose = 'Emissions fell by 12% between 2019 and 2025.';
    expect(stripSyndicationFurniture(prose)).toBe(prose);
  });
});

/* ------------------------------------------------------------------ */
/* HTTP                                                                */
/* ------------------------------------------------------------------ */

describe('the intake HTTP client', () => {
  it('refuses a private host without making a request', async () => {
    const outcome = await new HttpFetcher().fetch('http://169.254.169.254/latest/meta-data');
    expect(outcome.status).toBe('FAILED');
    if (outcome.status === 'FAILED') expect(outcome.reason).toContain('PRIVATE_HOST');
  });

  it('refuses a non-http scheme', async () => {
    const outcome = await new HttpFetcher().fetch('file:///etc/passwd');
    expect(outcome.status).toBe('FAILED');
  });

  it('reads Retry-After as seconds, as a date, and falls back when absent', () => {
    expect(parseRetryAfter('120')).toBe(120_000);
    expect(parseRetryAfter(null)).toBe(60_000);
    expect(parseRetryAfter('not a number at all')).toBe(60_000);
    expect(parseRetryAfter('-5')).toBe(0);
    // Never more than six hours, whatever the header claims.
    expect(parseRetryAfter('999999999')).toBe(6 * 60 * 60 * 1000);
  });
});

/* ------------------------------------------------------------------ */
/* Pipeline stages                                                     */
/* ------------------------------------------------------------------ */

const document = {
  externalId: 'x',
  title: 'Heatwave mortality in European cities',
  url: 'https://example.org/a',
  publisher: 'Example',
  publishedAt: '2026-09-01',
  body:
    'Excess deaths rose sharply during the 2025 heatwave across southern Europe. ' +
    'The contribution of night-time temperature has not been quantified. ' +
    'Adaptation spending is unevenly distributed between cities.',
  bodyProvenance: 'PUBLISHER_ABSTRACT' as const,
  suggestedDomains: ['health' as const],
};

describe('classification and claim extraction', () => {
  it('merges the connector suggestion with keyword classification', () => {
    const domains = classifyDomains(document);
    expect(domains).toContain('health');
    expect(domains.length).toBeLessThanOrEqual(3);
  });

  it('falls back to "other" rather than guessing a domain', () => {
    expect(
      classifyDomains({ ...document, title: 'A note', body: 'Nothing here.', suggestedDomains: [] }),
    ).toEqual(['other']);
  });

  it('marks only the sentences that state a gap as UNKNOWN', () => {
    const claims = extractClaims(document, 'source-1');
    const gaps = claims.filter((claim) => claim.epistemicKind === 'UNKNOWN');
    expect(gaps.length).toBeGreaterThanOrEqual(1);
    expect(gaps[0]?.text).toContain('not been quantified');
    expect(identifiesOpenProblem(claims)).toBe(true);
  });

  it('attributes every extracted sentence to the source it came from', () => {
    for (const claim of extractClaims(document, 'source-1')) {
      expect(claim.sourceIds).toEqual(['source-1']);
    }
  });

  it('finds no open problem in a document that only reports a result', () => {
    const claims = extractClaims(
      {
        ...document,
        body: 'Excess deaths rose by 12% during the 2025 heatwave across southern Europe this year.',
      },
      'source-1',
    );
    expect(identifiesOpenProblem(claims)).toBe(false);
  });
});
