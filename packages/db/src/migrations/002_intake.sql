-- Intake: real connectors, relevance gating and an auditable curation trail.

-- Conditional-request state per feed, so an unchanged feed costs the publisher
-- a 304 and costs us nothing.
CREATE TABLE fetch_state (
  url             TEXT PRIMARY KEY,
  connector       TEXT NOT NULL,
  etag            TEXT,
  last_modified   TEXT,
  last_status     TEXT NOT NULL DEFAULT 'NEW',
  last_error      TEXT,
  last_fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX fetch_state_connector_idx ON fetch_state(connector);

-- One row per connector per cycle. This is what makes the pipeline auditable:
-- what came in, what was thrown out, and why.
CREATE TABLE ingestion_runs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connector    TEXT NOT NULL,
  trigger      TEXT NOT NULL DEFAULT 'MANUAL',
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at  TIMESTAMPTZ,
  fetched      INTEGER NOT NULL DEFAULT 0,
  accepted     INTEGER NOT NULL DEFAULT 0,
  weak         INTEGER NOT NULL DEFAULT 0,
  rejected     INTEGER NOT NULL DEFAULT 0,
  duplicates   INTEGER NOT NULL DEFAULT 0,
  candidates   INTEGER NOT NULL DEFAULT 0,
  deferred     INTEGER NOT NULL DEFAULT 0,
  flagged      INTEGER NOT NULL DEFAULT 0,
  rejection_reasons JSONB NOT NULL DEFAULT '{}'::jsonb,
  error        TEXT
);
CREATE INDEX ingestion_runs_started_idx ON ingestion_runs(started_at DESC);

-- Every fetched document is kept with the verdict it received, so the filter
-- can be tuned against what it actually threw away.
ALTER TABLE raw_documents
  ADD COLUMN intake_verdict TEXT NOT NULL DEFAULT 'ACCEPT',
  ADD COLUMN intake_score   REAL NOT NULL DEFAULT 0,
  ADD COLUMN intake_code    TEXT,
  ADD COLUMN intake_reasons TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN intake_matched TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN ingestion_run_id UUID REFERENCES ingestion_runs(id) ON DELETE SET NULL;
CREATE INDEX raw_documents_verdict_idx ON raw_documents(intake_verdict);

ALTER TABLE problem_candidates
  ADD COLUMN relevance_score REAL NOT NULL DEFAULT 0,
  ADD COLUMN assessment JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX problem_candidates_relevance_idx ON problem_candidates(relevance_score DESC);

-- A published problem remembers the candidate it came from, so the board can
-- always answer "where did this come from".
ALTER TABLE problems
  ADD COLUMN source_candidate_id UUID REFERENCES problem_candidates(id) ON DELETE SET NULL;
