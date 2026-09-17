# Under load

Everything here was measured, not assumed. The numbers come from
`pnpm --filter @saveus/db loadgen` (5 021 problems, 20 053 hypotheses,
200 255 contributions) and `node tools/bench/http.mjs`, on four cores.

Reproduce any of it:

```bash
pnpm --filter @saveus/db loadgen 5000     # synthetic volume
node tools/bench/http.mjs                 # end-to-end, over HTTP
pnpm --filter @saveus/db loadgen:clear    # remove it again
```

---

## What was actually slow

| Query                     | Before  | After    |
| ------------------------- | ------- | -------- |
| Board, sorted by urgency  | 3.2 ms  | 1.3 ms   |
| **Board, sorted by activity** | **556 ms** | **0.63 ms** |
| Search (`LIKE '%heat%'`)  | 12.2 ms | 0.19 ms  |
| Platform counters         | 22.7 ms | cached   |

**The activity sort was the real problem**, and not for the reason it looks
like. The board computed five correlated subqueries per row, which is fine
while the sort can stop early — `ORDER BY urgency` uses an index, so the `LIMIT`
means twenty-four evaluations. Ordering by `max(created_at)` cannot stop early:
every candidate row has to be computed before anything can be sorted. The plan
showed a sequential scan with the subquery running 5 021 times, and the cost
grows with the product of problems and contributions per problem. At fifty
thousand problems it would not be 556 ms, it would be five seconds.

So the counts moved onto the row and triggers keep them true. Sorting is now an
index scan the `LIMIT` stops.

**Search was a sequential scan** because an unanchored `LIKE` cannot use a
btree. Trigram indexes (`pg_trgm`) make it indexable — 64× here, and the gap
widens with the table.

**The platform counters ran on every page** because the header shows them. Six
counts across the whole database, 22.7 ms, for numbers nobody is harmed by
seeing a minute late. They are cached now.

### What it costs

Denormalisation is a trade and this one is explicit: every contribution write
also touches its problem row. Generating 200 000 contributions went from 7 s to
44 s once the triggers existed — about 0.18 ms per insert, plus row-level
contention on a problem that is being written to hard. For a board read far more
often than it is written, that is the right side of the trade. If this ever
inverts, the answer is a periodic rollup rather than a trigger.

`researcher_count` is a distinct count, which cannot simply be incremented. It
moves only when an author's first contribution to a problem arrives or their
last one leaves — both answered by one indexed existence check.

Counters drift, so the API suite checks them against the computed truth after
real writes rather than after a backfill.

---

## Where the time goes now

| Concurrency | Board p50 | Board p95 | Throughput   |
| ----------- | --------- | --------- | ------------ |
| 1           | 4.6 ms    | 6.5 ms    | 205 req/s    |
| 24          | 64 ms     | 93 ms     | 350 req/s    |

Unloaded, every endpoint answers in single-digit milliseconds. Under
concurrency the latency rises while throughput does not, which is the signature
of a saturated CPU rather than a slow database — the SQL is still 1.3 ms.

**So the database is no longer the bottleneck; the Node process is.** That
changes what is worth doing next:

- **More index tuning will not help.** The queries are already index scans that
  stop at the limit.
- **The shared-cache headers are the lever.** `/api/problems` and `/api/meta`
  are public and identical for every visitor, and carry
  `s-maxage=30, stale-while-revalidate=300`. Behind a CDN that is the difference
  between a burst reaching the origin and not.
- **Horizontal scale is the other one.** The app holds no per-process state that
  matters: the queue, the rate limiter and the cache all have shared
  implementations.

---

## Rate limiting

Counters live in Postgres by default, in Redis when `REDIS_URL` is set, and in
process memory only in tests. A per-process counter is not a limit on any
deployment with more than one process — on a serverless host every invocation
starts with an empty one.

**Redis is worth having, but not for this.** Measured, the Postgres limiter
costs nothing detectable at 24 concurrent: 323 req/s against 350 with the
in-process limiter, which is inside the noise. Add Redis when you want a shared
cache across instances, not to make the limiter cheaper.

The limits themselves are a deployment decision — a CDN absorbing the board and
a single origin taking everything want different numbers — so they are
configurable:

| Variable                           | Default |
| ---------------------------------- | ------- |
| `RATE_LIMIT_READ_PER_MINUTE`       | 600     |
| `RATE_LIMIT_WRITE_PER_MINUTE`      | 30      |
| `RATE_LIMIT_AGENT_RUNS_PER_MINUTE` | 12      |
| `RATE_LIMIT_DRIVER`                | `postgres`, or `redis` when `REDIS_URL` is set |

A value of `0` or a negative number falls back to the default rather than being
read as "no limit".

Every response carries `RateLimit-Limit`, `-Remaining` and `-Reset`; every
refusal carries `Retry-After`.

---

## Caching

Deliberately narrow. Staleness in a research record is a correctness problem,
and a page showing yesterday's evidence is worse than one that takes another ten
milliseconds. Only two things are cached, and both are global and tolerant:

| Value             | TTL | Why it is safe                                    |
| ----------------- | --- | ------------------------------------------------- |
| Platform counters | 60 s | Header numbers. Part of no claim about evidence.  |
| Domain reference  | 5 min | Changes on deploy.                               |

`MemoryCache` per process, `RedisCache` when shared, `NoopCache` in tests so a
cache never hides a bug. A cache that cannot be reached makes a request slow,
never failed.

---

## Connections

A serverless invocation gets a pool of one, a long-running server gets ten, and
the host decides TLS. See `packages/db/src/config.ts` and the deployment notes.
Use the **pooled** connection string on Neon: a direct one works until
concurrent invocations exhaust the connection limit, which happens under traffic
rather than during testing.
