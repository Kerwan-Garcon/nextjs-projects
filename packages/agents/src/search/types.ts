/**
 * Research search abstraction.
 *
 * There is no fake search engine here. The MVP provider queries the platform's
 * own evidence corpus - real records with real publisher URLs - and a second
 * implementation can call an external index when credentials exist. Either way
 * the original source URL travels with every result.
 */
export interface SearchResult {
  /** Source id when the result is already in the corpus, null when external. */
  sourceId: string | null;
  title: string;
  url: string;
  publisher: string;
  publicationDate: string | null;
  snippet: string | null;
  /** 0..1, provider-specific. Used for ordering only. */
  relevance: number;
  provider: string;
}

export interface SearchOptions {
  limit?: number;
  domainKeys?: string[];
  problemId?: string;
}

export interface ResearchSearchProvider {
  readonly name: string;
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
}
