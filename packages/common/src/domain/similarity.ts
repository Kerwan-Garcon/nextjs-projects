import { normalizeTitle } from '../security/text.js';

/**
 * Near-duplicate detection.
 *
 * Intake sees the same story arrive from a journal feed, an institutional
 * newsroom and a literature search within days. Exact-match deduplication
 * catches none of that, so titles are compared as character trigram sets.
 * Cheap, language-agnostic, and good enough to keep the curation queue from
 * filling with the same paper three times.
 */

const SHINGLE_SIZE = 3;

export function shingles(text: string, size = SHINGLE_SIZE): Set<string> {
  const normalized = normalizeTitle(text).replace(/\s+/g, ' ');
  const result = new Set<string>();
  if (normalized.length < size) {
    if (normalized.length > 0) result.add(normalized);
    return result;
  }
  for (let index = 0; index <= normalized.length - size; index += 1) {
    result.add(normalized.slice(index, index + size));
  }
  return result;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;

  let intersection = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const value of small) {
    if (large.has(value)) intersection += 1;
  }
  return intersection / (a.size + b.size - intersection);
}

export function titleSimilarity(a: string, b: string): number {
  return jaccard(shingles(a), shingles(b));
}

/** Above this, two titles describe the same thing closely enough to merge. */
export const DUPLICATE_THRESHOLD = 0.7;

export interface DuplicateMatch {
  candidate: string;
  similarity: number;
}

/**
 * Closest existing title, if any is close enough to matter. Returns the best
 * match rather than a boolean so the curator can see what it collided with.
 */
export function findNearDuplicate(
  title: string,
  existing: readonly string[],
  threshold = DUPLICATE_THRESHOLD,
): DuplicateMatch | null {
  const target = shingles(title);
  let best: DuplicateMatch | null = null;

  for (const candidate of existing) {
    const similarity = jaccard(target, shingles(candidate));
    if (similarity >= threshold && (!best || similarity > best.similarity)) {
      best = { candidate, similarity };
    }
  }
  return best;
}
