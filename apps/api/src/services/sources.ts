import { randomUUID } from 'node:crypto';
import { AppError, normalizeSource, type RawSource } from '@saveus/common';
import type { Db } from '@saveus/db';

/**
 * Source identity, in one place.
 *
 * A source is identified by its canonical URL first and its content hash
 * second. Both matter: two people submitting the same document with different
 * titles must land on the same record (canonical URL), and the same document
 * arriving from two connectors under different URLs must also collapse
 * (content hash). Getting this wrong once produced a 500 on an ordinary
 * resubmission, which is why it now lives here rather than being re-implemented
 * per call site.
 */
export async function findOrCreateSource(
  db: Db,
  raw: RawSource,
  options: { addedById?: string | null; origin?: 'HUMAN' | 'AGENT' | 'INGESTED' } = {},
): Promise<{ id: string; created: boolean }> {
  const normalized = normalizeSource(raw);
  if (!normalized.ok) {
    throw AppError.validation(`Source rejected: ${normalized.reason}`, normalized.detail);
  }

  const existing = await db
    .selectFrom('sources')
    .where((eb) =>
      eb.or([
        eb('content_hash', '=', normalized.source.contentHash),
        eb('canonical_url', '=', normalized.source.canonicalUrl),
      ]),
    )
    .select('id')
    .executeTakeFirst();

  if (existing) return { id: existing.id, created: false };

  const id = randomUUID();
  await db
    .insertInto('sources')
    .values({
      id,
      title: normalized.source.title,
      authors: normalized.source.authors,
      publisher: normalized.source.publisher,
      publication_date: normalized.source.publicationDate,
      url: normalized.source.url,
      canonical_url: normalized.source.canonicalUrl,
      source_type: normalized.source.sourceType,
      domain: normalized.source.domain,
      reliability: normalized.source.reliability,
      reliability_note: normalized.source.reliabilityNote,
      content_hash: normalized.source.contentHash,
      origin: options.origin ?? 'HUMAN',
      added_by_id: options.addedById ?? null,
      flags: normalized.source.flags,
    })
    .execute();

  return { id, created: true };
}
