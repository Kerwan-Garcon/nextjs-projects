import { sql, type Db } from '@saveus/db';
import type { ResearchSearchProvider, SearchOptions, SearchResult } from './types.js';

/**
 * Corpus search over the platform's own source records.
 *
 * Postgres full-text ranking across title, publisher and the note attached to
 * the source, with a reliability tie-break. Every result carries the original
 * publisher URL, which is the point: nothing in this system ever loses the
 * link back to where a claim came from.
 */
export class CorpusSearchProvider implements ResearchSearchProvider {
  readonly name = 'corpus';

  constructor(private readonly db: Db) {}

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const limit = Math.min(options.limit ?? 8, 25);
    const terms = query
      .toLowerCase()
      .match(/[a-zà-ÿ][a-zà-ÿ0-9-]{2,}/g)
      ?.slice(0, 12);

    if (!terms || terms.length === 0) return [];

    const tsQuery = terms.join(' | ');

    const rows = await sql<{
      id: string;
      title: string;
      url: string;
      publisher: string;
      publication_date: string | null;
      reliability_note: string | null;
      reliability: string;
      rank: number;
    }>`
      SELECT s.id, s.title, s.url, s.publisher, s.publication_date, s.reliability_note, s.reliability,
             ts_rank(
               to_tsvector('simple', s.title || ' ' || s.publisher || ' ' || coalesce(s.reliability_note, '')),
               to_tsquery('simple', ${tsQuery})
             ) AS rank
      FROM sources s
      WHERE to_tsvector('simple', s.title || ' ' || s.publisher || ' ' || coalesce(s.reliability_note, ''))
            @@ to_tsquery('simple', ${tsQuery})
      ORDER BY rank DESC,
               CASE s.reliability WHEN 'HIGH' THEN 0 WHEN 'MEDIUM' THEN 1 WHEN 'LOW' THEN 2 ELSE 3 END,
               s.created_at DESC
      LIMIT ${limit}
    `.execute(this.db);

    const top = rows.rows[0]?.rank ?? 1;

    return rows.rows.map((row) => ({
      sourceId: row.id,
      title: row.title,
      url: row.url,
      publisher: row.publisher,
      publicationDate: row.publication_date,
      snippet: row.reliability_note,
      relevance: top > 0 ? Math.min(1, row.rank / top) : 0,
      provider: this.name,
    }));
  }
}

/**
 * Fallback used when a problem's own attached sources should be preferred over
 * a global corpus match - for instance when an agent runs against a hypothesis
 * whose problem already carries a curated evidence set.
 */
export class ProblemScopedSearchProvider implements ResearchSearchProvider {
  readonly name = 'corpus:problem-scoped';

  constructor(
    private readonly db: Db,
    private readonly fallback: ResearchSearchProvider,
  ) {}

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    if (!options.problemId) return this.fallback.search(query, options);
    const limit = Math.min(options.limit ?? 8, 25);

    const rows = await this.db
      .selectFrom('problem_sources as ps')
      .innerJoin('sources as s', 's.id', 'ps.source_id')
      .where('ps.problem_id', '=', options.problemId)
      .select([
        's.id',
        's.title',
        's.url',
        's.publisher',
        's.publication_date',
        's.reliability_note',
        's.reliability',
      ])
      .orderBy(
        sql`CASE s.reliability WHEN 'HIGH' THEN 0 WHEN 'MEDIUM' THEN 1 WHEN 'LOW' THEN 2 ELSE 3 END`,
      )
      .limit(limit)
      .execute();

    const scoped: SearchResult[] = rows.map((row, index) => ({
      sourceId: row.id,
      title: row.title,
      url: row.url,
      publisher: row.publisher,
      publicationDate: row.publication_date,
      snippet: row.reliability_note,
      relevance: 1 - index / (rows.length + 1),
      provider: this.name,
    }));

    if (scoped.length >= limit) return scoped;

    const extra = await this.fallback.search(query, { ...options, limit: limit - scoped.length });
    const seen = new Set(scoped.map((result) => result.sourceId));
    return [...scoped, ...extra.filter((result) => !seen.has(result.sourceId))];
  }
}
