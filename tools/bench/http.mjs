/**
 * End-to-end load, over HTTP.
 *
 * A query plan is not a latency. This drives the real endpoints against the
 * real server so the number includes serialisation, the framework, the pool and
 * everything else between the client and the index - which is where the time
 * usually turns out to be.
 *
 *   node tools/bench/http.mjs [baseUrl] [concurrency] [seconds]
 */
const BASE = process.argv[2] ?? 'http://127.0.0.1:3100';
const CONCURRENCY = Number(process.argv[3] ?? 24);
const SECONDS = Number(process.argv[4] ?? 6);

const SCENARIOS = [
  ['board, default sort', '/api/problems?limit=24'],
  ['board, by activity', '/api/problems?limit=24&sort=activity'],
  ['board, filtered', '/api/problems?limit=24&domain=health&sort=urgency'],
  ['search', '/api/problems?limit=24&q=heat'],
  ['reference + counters', '/api/meta'],
];

const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];

async function run(label, path) {
  const deadline = Date.now() + SECONDS * 1000;
  const latencies = [];
  let failures = 0;

  const worker = async () => {
    while (Date.now() < deadline) {
      const startedAt = performance.now();
      try {
        const response = await fetch(`${BASE}${path}`);
        // Drain the body: leaving it unread measures the headers, not the work.
        await response.arrayBuffer();
        if (!response.ok) failures += 1;
      } catch {
        failures += 1;
      }
      latencies.push(performance.now() - startedAt);
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  latencies.sort((a, b) => a - b);
  const rps = latencies.length / SECONDS;

  console.log(
    `  ${label.padEnd(22)} ${String(Math.round(rps)).padStart(6)} req/s` +
      `   p50 ${percentile(latencies, 0.5).toFixed(1).padStart(7)} ms` +
      `   p95 ${percentile(latencies, 0.95).toFixed(1).padStart(7)} ms` +
      `   p99 ${percentile(latencies, 0.99).toFixed(1).padStart(7)} ms` +
      (failures ? `   ${failures} FAILED` : ''),
  );

  return { label, rps, p50: percentile(latencies, 0.5), p95: percentile(latencies, 0.95), failures };
}

const health = await fetch(`${BASE}/api/health`).catch(() => null);
if (!health?.ok) {
  console.error(`No server at ${BASE}. Start one first.`);
  process.exit(1);
}

console.log(`${CONCURRENCY} concurrent, ${SECONDS}s each, against ${BASE}\n`);
const results = [];
for (const [label, path] of SCENARIOS) results.push(await run(label, path));

const worst = results.reduce((a, b) => (a.p95 > b.p95 ? a : b));
console.log(`\n  worst p95: ${worst.label} at ${worst.p95.toFixed(0)} ms`);
if (results.some((r) => r.failures > 0)) process.exitCode = 1;
