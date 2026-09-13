import type { Db } from '@saveus/db';
import type { SourceConnector } from './connector.js';
import { HttpFetcher, type FetchState } from './http.js';
import {
  analysisConnector,
  institutionalConnector,
  journalConnector,
  type FeedStateStore,
} from './connectors/feeds.js';
import { EuropePmcConnector } from './connectors/europepmc.js';
import { DEFAULT_CONNECTORS as OFFLINE_CONNECTORS } from './connectors/mock.js';

/**
 * Connector selection.
 *
 * Live intake reaches out to other people's servers, so it is opt-in:
 * `INTAKE_LIVE=true` turns it on. Without it - in tests, in CI, and on a laptop
 * with no network - the pipeline runs against the seeded offline connectors and
 * exercises exactly the same code path.
 */

/** Conditional-request state, persisted so an unchanged feed costs a 304. */
export function createFeedStateStore(db: Db, connector: string): FeedStateStore {
  return {
    async get(url: string): Promise<FetchState> {
      const row = await db
        .selectFrom('fetch_state')
        .where('url', '=', url)
        .select(['etag', 'last_modified'])
        .executeTakeFirst();
      return { etag: row?.etag ?? null, lastModified: row?.last_modified ?? null };
    },

    async set(url, state): Promise<void> {
      await db
        .insertInto('fetch_state')
        .values({
          url,
          connector,
          etag: state.etag,
          last_modified: state.lastModified,
          last_status: state.status,
          last_error: state.error,
          last_fetched_at: new Date(),
        })
        .onConflict((oc) =>
          oc.column('url').doUpdateSet({
            etag: state.etag,
            last_modified: state.lastModified,
            last_status: state.status,
            last_error: state.error,
            last_fetched_at: new Date(),
          }),
        )
        .execute();
    },
  };
}

export function isLiveIntakeEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.INTAKE_LIVE === 'true' || env.INTAKE_LIVE === '1';
}

/**
 * The live set. Three connectors, chosen for signal rather than volume:
 * institutional newsrooms, peer-reviewed tables of contents, and the literature
 * itself queried for abstracts that state a gap.
 */
export function liveConnectors(db: Db, fetcher = new HttpFetcher()): SourceConnector[] {
  return [
    institutionalConnector(fetcher, createFeedStateStore(db, 'institutional-feeds')),
    journalConnector(fetcher, createFeedStateStore(db, 'journal-feeds')),
    analysisConnector(fetcher, createFeedStateStore(db, 'analysis-feeds')),
    new EuropePmcConnector(fetcher),
  ];
}

export function resolveConnectors(db: Db, env: NodeJS.ProcessEnv = process.env): SourceConnector[] {
  return isLiveIntakeEnabled(env) ? liveConnectors(db) : [...OFFLINE_CONNECTORS];
}
