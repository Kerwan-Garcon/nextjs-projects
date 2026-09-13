import {
  EPISTEMIC_DESCRIPTORS,
  tierFor,
  type EpistemicKind,
  type Reliability,
} from '@saveus/common';
import type { Db } from '@saveus/db';

/**
 * Row -> DTO mapping.
 *
 * The API speaks camelCase to clients and never leaks a database row shape.
 * Epistemic kind and origin travel on every object that carries a statement,
 * because the interface is required to render them differently.
 */

export interface SourceDto {
  id: string;
  title: string;
  authors: string[];
  publisher: string;
  publicationDate: string | null;
  url: string;
  sourceType: string;
  domain: string;
  reliability: Reliability;
  reliabilityNote: string | null;
  retrievedAt: string;
  contentHash: string;
  origin: string;
}

export interface StatementDto {
  text: string;
  kind: EpistemicKind;
  kindLabel: string;
  sourceIds: string[];
  note: string | null;
}

export function toStatement(value: {
  text: string;
  kind: EpistemicKind;
  sourceIds?: string[];
  note?: string | null;
}): StatementDto {
  return {
    text: value.text,
    kind: value.kind,
    kindLabel: EPISTEMIC_DESCRIPTORS[value.kind].label,
    sourceIds: value.sourceIds ?? [],
    note: value.note ?? null,
  };
}

type SourceRowLike = {
  id: string;
  title: string;
  authors: string[];
  publisher: string;
  publication_date: string | null;
  url: string;
  source_type: string;
  domain: string;
  reliability: Reliability;
  reliability_note: string | null;
  retrieved_at: Date;
  content_hash: string;
  origin: string;
};

export function toSource(row: SourceRowLike): SourceDto {
  return {
    id: row.id,
    title: row.title,
    authors: row.authors,
    publisher: row.publisher,
    publicationDate: row.publication_date,
    url: row.url,
    sourceType: row.source_type,
    domain: row.domain,
    reliability: row.reliability,
    reliabilityNote: row.reliability_note,
    retrievedAt: row.retrieved_at.toISOString(),
    contentHash: row.content_hash,
    origin: row.origin,
  };
}

export async function loadSources(db: Db, ids: readonly string[]): Promise<SourceDto[]> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return [];

  const rows = await db.selectFrom('sources').where('id', 'in', unique).selectAll().execute();
  return rows.map(toSource);
}

export interface AuthorDto {
  id: string;
  handle: string;
  displayName: string;
  reputation: number;
  tier: string;
  isAnonymous: boolean;
  origin: string;
}

export function toAuthor(row: {
  id: string;
  handle: string;
  display_name: string;
  reputation: number;
  is_anonymous: boolean;
  origin: string;
}): AuthorDto {
  return {
    id: row.id,
    handle: row.handle,
    displayName: row.display_name,
    reputation: row.reputation,
    tier: tierFor(row.reputation).label,
    isAnonymous: row.is_anonymous,
    origin: row.origin,
  };
}
