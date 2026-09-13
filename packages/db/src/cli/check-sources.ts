import { checkUrl } from '@saveus/common';
import { SEED_SOURCES } from '../seed/sources.js';

/**
 * Link check for the seeded source library.
 *
 * The platform's credibility rests on "follow the citation" always leading
 * somewhere real, so this is a thing anyone can run rather than a claim in a
 * README. Publishers behind bot protection answer 403 to a script and 200 to a
 * browser; that is reported separately from a genuine 404.
 *
 *   pnpm --filter @saveus/db check:sources
 */

const CONCURRENCY = 4;
const DELAY_MS = 350;

interface Result {
  key: string;
  url: string;
  status: number | string;
  verdict: 'OK' | 'BLOCKED' | 'MISSING' | 'ERROR';
}

async function head(url: string): Promise<number | string> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; save-us-linkcheck/0.1)' },
      signal: AbortSignal.timeout(20_000),
    });
    return response.status;
  } catch (error) {
    return error instanceof Error ? error.name : 'ERROR';
  }
}

function verdictFor(status: number | string): Result['verdict'] {
  if (typeof status !== 'number') return 'ERROR';
  if (status >= 200 && status < 400) return 'OK';
  // 401/403/406/429 are bot protection, not a missing document.
  if ([401, 403, 406, 429].includes(status)) return 'BLOCKED';
  if (status === 404 || status === 410) return 'MISSING';
  return 'ERROR';
}

const results: Result[] = [];
const queue = [...SEED_SOURCES];

// First, the checks that need no network at all.
for (const source of SEED_SOURCES) {
  const check = checkUrl(source.url);
  if (!check.ok) {
    console.error(`INVALID  ${source.key}: ${check.reason} - ${source.url}`);
    process.exitCode = 1;
  }
}

async function worker(): Promise<void> {
  for (;;) {
    const source = queue.shift();
    if (!source) return;
    const status = await head(source.url);
    results.push({ key: source.key, url: source.url, status, verdict: verdictFor(status) });
    await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

const byVerdict = (verdict: Result['verdict']) =>
  results.filter((result) => result.verdict === verdict);

for (const result of [...byVerdict('MISSING'), ...byVerdict('ERROR')]) {
  console.error(
    `${result.verdict.padEnd(8)} ${String(result.status).padEnd(5)} ${result.key}  ${result.url}`,
  );
}

console.log(
  `\n${results.length} sources checked: ${byVerdict('OK').length} reachable, ` +
    `${byVerdict('BLOCKED').length} bot-blocked (the document exists; the publisher refuses scripts), ` +
    `${byVerdict('MISSING').length} missing, ${byVerdict('ERROR').length} errored.`,
);

if (byVerdict('MISSING').length > 0) {
  console.error('\nSources that no longer resolve must be corrected or removed.');
  process.exitCode = 1;
}
