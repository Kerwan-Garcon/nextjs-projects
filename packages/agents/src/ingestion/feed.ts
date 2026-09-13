import { XMLParser } from 'fast-xml-parser';
import { sanitizeUntrusted } from '@saveus/common';

/**
 * RSS / Atom parsing.
 *
 * Feeds in the wild are inconsistent: RSS 2.0, Atom, RDF, with the description
 * variously in `description`, `content:encoded`, `summary` or `content`, and
 * HTML inside all of them. This normalises the shapes we actually encounter and
 * ignores the rest rather than guessing.
 */

export interface FeedItem {
  id: string;
  title: string;
  link: string;
  summary: string;
  publishedAt: string | null;
  author: string | null;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: true,
  parseTagValue: false,
  // Entity expansion is turned off in the parser and done here instead.
  //
  // Two reasons. The parser's billion-laughs guard counts *every* expansion,
  // including the `&amp;` and `&#8217;` that fill an ordinary 140 KB feed, and
  // it throws past a thousand of them - which silently cost us the WHO and UNEP
  // feeds entirely the first time this ran live. And the decoder below never
  // looks at DOCTYPE-declared entities at all, so the attack the guard exists
  // to stop cannot happen: there is nothing to expand recursively.
  processEntities: false,
  htmlEntities: false,
});

export function parseFeed(xml: string): FeedItem[] {
  let document: unknown;
  try {
    document = parser.parse(stripLeadingNoise(xml));
  } catch {
    return [];
  }

  const root = asRecord(document);
  const rss = asRecord(root.rss);
  const rdf = asRecord(root['rdf:RDF']);
  const channel = asRecord(rss.channel ?? rdf.channel);

  // RSS 2.0 and RDF put items under the channel or at the root.
  const rssItems = toArray(channel.item ?? rdf.item ?? rss.item);
  if (rssItems.length > 0) return rssItems.map(parseRssItem).filter(isUsable);

  // Atom.
  const feed = asRecord(root.feed);
  const atomEntries = toArray(feed.entry);
  if (atomEntries.length > 0) return atomEntries.map(parseAtomEntry).filter(isUsable);

  return [];
}

function parseRssItem(raw: unknown): FeedItem {
  const item = asRecord(raw);
  const link = text(item.link) || attr(item.link, '@_href') || text(item.guid);
  const summary =
    text(item['content:encoded']) || text(item.description) || text(item['dc:description']) || '';

  return {
    id: text(item.guid) || link || text(item.title),
    title: clean(decodeEntities(text(item.title))),
    link,
    summary: clean(stripHtml(decodeEntities(summary))),
    publishedAt: normalizeDate(text(item.pubDate) || text(item['dc:date']) || text(item.published)),
    author: text(item['dc:creator']) || text(item.author) || null,
  };
}

function parseAtomEntry(raw: unknown): FeedItem {
  const entry = asRecord(raw);
  const links = toArray(entry.link);
  const alternate =
    links.find((candidate) => attr(candidate, '@_rel') === 'alternate') ?? links[0] ?? entry.link;

  const summary = text(entry.content) || text(entry.summary) || '';
  const author = asRecord(entry.author);

  return {
    id: text(entry.id) || attr(alternate, '@_href'),
    title: clean(decodeEntities(text(entry.title))),
    link: attr(alternate, '@_href') || text(alternate),
    summary: clean(stripHtml(decodeEntities(summary))),
    publishedAt: normalizeDate(text(entry.published) || text(entry.updated)),
    author: text(author.name) || null,
  };
}

function isUsable(item: FeedItem): boolean {
  return item.title.length > 0 && item.link.startsWith('http');
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function toArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function text(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return text(value[0]);
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const inner = record['#text'];
    if (typeof inner === 'string' || typeof inner === 'number') return String(inner);
  }
  return '';
}

function attr(value: unknown, name: string): string {
  const record = asRecord(Array.isArray(value) ? value[0] : value);
  const found = record[name];
  return typeof found === 'string' ? found : '';
}

/**
 * Named entities worth decoding. Deliberately a fixed table rather than a
 * general HTML entity map: it is bounded, it cannot recurse, and everything
 * outside it is left as literal text instead of being guessed at.
 */
const NAMED_ENTITIES: Readonly<Record<string, string>> = Object.freeze({
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '-',
  mdash: '-',
  lsquo: "'",
  rsquo: "'",
  ldquo: '"',
  rdquo: '"',
  hellip: '...',
  deg: '\u00b0',
  eacute: '\u00e9',
  egrave: '\u00e8',
  agrave: '\u00e0',
  ccedil: '\u00e7',
  times: '\u00d7',
  micro: '\u00b5',
  euro: '\u20ac',
  pound: '\u00a3',
});

/**
 * One decoding pass over numeric and known named references. Single pass by
 * design: the output is never re-scanned, so `&amp;lt;` decodes to `&lt;` and
 * stops there rather than unfolding into a tag.
 */
export function decodeEntities(input: string): string {
  if (input.indexOf('&') === -1) return input;
  return input.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]{1,9});/gi, (match, body: string) => {
    if (body.startsWith('#x') || body.startsWith('#X')) {
      const code = Number.parseInt(body.slice(2), 16);
      return codePoint(code) ?? match;
    }
    if (body.startsWith('#')) {
      const code = Number.parseInt(body.slice(1), 10);
      return codePoint(code) ?? match;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}

function codePoint(code: number): string | null {
  if (!Number.isInteger(code) || code < 9 || code > 0x10ffff) return null;
  // Surrogate halves are not characters; refusing them keeps the output valid.
  if (code >= 0xd800 && code <= 0xdfff) return null;
  return String.fromCodePoint(code);
}

/**
 * Publishers put things in front of the XML declaration: a byte-order mark, a
 * stray blank line, and in UNEP's case a block of Drupal theme-debug comments.
 * A parser is entitled to reject all of it; dropping it is cheaper than losing
 * the feed.
 */
export function stripLeadingNoise(xml: string): string {
  const withoutBom = xml.charCodeAt(0) === 0xfeff ? xml.slice(1) : xml;
  const declaration = withoutBom.indexOf('<?xml');
  if (declaration > 0) return withoutBom.slice(declaration);
  if (declaration === 0) return withoutBom;
  const firstTag = withoutBom.search(/<[a-zA-Z]/);
  return firstTag > 0 ? withoutBom.slice(firstTag) : withoutBom;
}

export function stripHtml(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, ' '),
  ).replace(/[ \t]{2,}/g, ' ');
}

function clean(value: string): string {
  return sanitizeUntrusted(value, 12_000).text.replace(/\s+\n/g, '\n').trim();
}

export function normalizeDate(value: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}
