-- Rate limiting that survives the process.
--
-- The in-memory limiter is correct for a long-running server and worthless the
-- moment there is more than one process. On a serverless host every invocation
-- has its own empty map, so the limit is effectively "per request" - which is
-- no limit at all. Postgres is the one thing every deployment of this platform
-- has, so the shared counter lives here.
--
-- A fixed window rather than a sliding one: it is a single atomic upsert, and
-- the failure mode of a fixed window (up to twice the limit across a boundary)
-- is one this platform can afford. Precision here is not worth a second round
-- trip on every request.
CREATE TABLE rate_limits (
  key        TEXT PRIMARY KEY,
  count      INTEGER NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX rate_limits_expiry_idx ON rate_limits(expires_at);

-- Publishers who asked us to wait.
--
-- `Retry-After` was already parsed and then thrown away, so a 429 changed
-- nothing: the next cycle fetched the same host at the same rate, and within a
-- cycle the other seven URLs on that host went out anyway. Recording the
-- cooldown makes the request that was refused actually stop happening.
--
-- Keyed by host rather than by URL on purpose. A publisher rate-limits a
-- client, not a path: the literature connector asks one host eight questions,
-- and a 429 on the first is an answer about all eight.
CREATE TABLE host_cooldowns (
  host        TEXT PRIMARY KEY,
  until       TIMESTAMPTZ NOT NULL,
  reason      TEXT,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX host_cooldowns_until_idx ON host_cooldowns(until);
