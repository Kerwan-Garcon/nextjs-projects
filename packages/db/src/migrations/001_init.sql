-- SAVE US :: initial schema
-- Relational integrity is deliberate: evidence cannot dangle, contributions
-- cannot float free of a problem, and agent findings always belong to a run.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE domains (
  key          TEXT PRIMARY KEY,
  label        TEXT NOT NULL,
  description  TEXT NOT NULL,
  accent       TEXT NOT NULL,
  sort_order   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handle        TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  bio           TEXT,
  reputation    INTEGER NOT NULL DEFAULT 0,
  trust         REAL NOT NULL DEFAULT 0.5 CHECK (trust >= 0 AND trust <= 1),
  is_anonymous  BOOLEAN NOT NULL DEFAULT FALSE,
  origin        TEXT NOT NULL DEFAULT 'HUMAN',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT users_handle_shape CHECK (handle ~ '^[a-z0-9][a-z0-9_-]{2,31}$')
);

CREATE TABLE user_domains (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  domain_key  TEXT NOT NULL REFERENCES domains(key) ON DELETE CASCADE,
  weight      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, domain_key)
);

CREATE TABLE auth_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX auth_sessions_user_idx ON auth_sessions(user_id);

CREATE TABLE sources (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title             TEXT NOT NULL,
  authors           TEXT[] NOT NULL DEFAULT '{}',
  publisher         TEXT NOT NULL,
  publication_date  TEXT,
  url               TEXT NOT NULL,
  canonical_url     TEXT NOT NULL UNIQUE,
  source_type       TEXT NOT NULL,
  domain            TEXT NOT NULL,
  reliability       TEXT NOT NULL DEFAULT 'UNKNOWN',
  reliability_note  TEXT,
  retrieved_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  content_hash      TEXT NOT NULL UNIQUE,
  origin            TEXT NOT NULL DEFAULT 'HUMAN',
  added_by_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  flags             TEXT[] NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sources_type_idx ON sources(source_type);
CREATE INDEX sources_reliability_idx ON sources(reliability);

CREATE TABLE problems (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ref               TEXT NOT NULL UNIQUE,
  slug              TEXT NOT NULL UNIQUE,
  title             TEXT NOT NULL,
  summary           TEXT NOT NULL,
  description       TEXT NOT NULL,
  why_it_matters    JSONB NOT NULL DEFAULT '[]'::jsonb,
  constraints       JSONB NOT NULL DEFAULT '{}'::jsonb,
  success_criteria  JSONB NOT NULL DEFAULT '[]'::jsonb,
  current_knowledge JSONB NOT NULL DEFAULT '[]'::jsonb,
  open_questions    TEXT[] NOT NULL DEFAULT '{}',
  geography_label   TEXT NOT NULL,
  geography_scale   TEXT NOT NULL,
  country_code      TEXT,
  difficulty        SMALLINT NOT NULL CHECK (difficulty BETWEEN 0 AND 10),
  urgency           SMALLINT NOT NULL CHECK (urgency BETWEEN 0 AND 10),
  status            TEXT NOT NULL DEFAULT 'OPEN',
  origin            TEXT NOT NULL DEFAULT 'HUMAN',
  published_by_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX problems_status_idx ON problems(status);
CREATE INDEX problems_urgency_idx ON problems(urgency DESC);

CREATE TABLE problem_domains (
  problem_id  UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  domain_key  TEXT NOT NULL REFERENCES domains(key) ON DELETE RESTRICT,
  is_primary  BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (problem_id, domain_key)
);
CREATE INDEX problem_domains_domain_idx ON problem_domains(domain_key);

CREATE TABLE problem_sources (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id  UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  source_id   UUID NOT NULL REFERENCES sources(id) ON DELETE RESTRICT,
  role        TEXT NOT NULL DEFAULT 'EVIDENCE',
  note        TEXT,
  added_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (problem_id, source_id)
);

CREATE TABLE hypotheses (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ref                   TEXT NOT NULL UNIQUE,
  problem_id            UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  author_id             UUID REFERENCES users(id) ON DELETE SET NULL,
  author_agent_role     TEXT,
  title                 TEXT NOT NULL,
  claim                 TEXT NOT NULL,
  mechanism             TEXT NOT NULL,
  expected_impact       TEXT NOT NULL,
  assumptions           TEXT[] NOT NULL DEFAULT '{}',
  unknowns              TEXT[] NOT NULL DEFAULT '{}',
  risks                 TEXT[] NOT NULL DEFAULT '{}',
  estimated_cost        TEXT,
  estimated_scalability TEXT,
  validation_method     TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'DRAFT',
  epistemic_kind        TEXT NOT NULL DEFAULT 'HUMAN_HYPOTHESIS',
  origin                TEXT NOT NULL DEFAULT 'HUMAN',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT hypothesis_has_an_author CHECK (author_id IS NOT NULL OR author_agent_role IS NOT NULL)
);
CREATE INDEX hypotheses_problem_idx ON hypotheses(problem_id);
CREATE INDEX hypotheses_status_idx ON hypotheses(status);

CREATE TABLE hypothesis_contributors (
  hypothesis_id UUID NOT NULL REFERENCES hypotheses(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'CONTRIBUTOR',
  PRIMARY KEY (hypothesis_id, user_id)
);

CREATE TABLE hypothesis_evidence (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hypothesis_id      UUID NOT NULL REFERENCES hypotheses(id) ON DELETE CASCADE,
  source_id          UUID NOT NULL REFERENCES sources(id) ON DELETE RESTRICT,
  stance             TEXT NOT NULL,
  claim              TEXT NOT NULL,
  epistemic_kind     TEXT NOT NULL DEFAULT 'SOURCE_CLAIM',
  strength           SMALLINT NOT NULL DEFAULT 3 CHECK (strength BETWEEN 1 AND 5),
  added_by_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  added_by_run_id    UUID,
  note               TEXT,
  origin             TEXT NOT NULL DEFAULT 'HUMAN',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (hypothesis_id, source_id, stance)
);
CREATE INDEX hypothesis_evidence_hypothesis_idx ON hypothesis_evidence(hypothesis_id);

CREATE TABLE contributions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind         TEXT NOT NULL,
  target_type  TEXT NOT NULL,
  target_id    UUID NOT NULL,
  problem_id   UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  author_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body         TEXT NOT NULL,
  source_ids   UUID[] NOT NULL DEFAULT '{}',
  score        REAL NOT NULL DEFAULT 0,
  signals      JSONB NOT NULL DEFAULT '{}'::jsonb,
  status       TEXT NOT NULL DEFAULT 'ACTIVE',
  origin       TEXT NOT NULL DEFAULT 'HUMAN',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX contributions_target_idx ON contributions(target_type, target_id);
CREATE INDEX contributions_problem_idx ON contributions(problem_id);
CREATE INDEX contributions_author_idx ON contributions(author_id);

CREATE TABLE comments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contribution_id UUID NOT NULL REFERENCES contributions(id) ON DELETE CASCADE,
  author_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id       UUID REFERENCES comments(id) ON DELETE CASCADE,
  body            TEXT NOT NULL,
  origin          TEXT NOT NULL DEFAULT 'HUMAN',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX comments_contribution_idx ON comments(contribution_id);

CREATE TABLE endorsements (
  contribution_id UUID NOT NULL REFERENCES contributions(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL DEFAULT 'USEFUL',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (contribution_id, user_id)
);

CREATE TABLE agents (
  role         TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  mission      TEXT NOT NULL,
  description  TEXT NOT NULL,
  tools        TEXT[] NOT NULL DEFAULT '{}',
  permissions  JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled      BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE research_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id    UUID REFERENCES problems(id) ON DELETE CASCADE,
  hypothesis_id UUID REFERENCES hypotheses(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  question      TEXT NOT NULL,
  action        TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'QUEUED',
  requested_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  brief         JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ
);
CREATE INDEX research_sessions_hypothesis_idx ON research_sessions(hypothesis_id);

CREATE TABLE agent_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_role      TEXT NOT NULL REFERENCES agents(role) ON DELETE RESTRICT,
  session_id      UUID REFERENCES research_sessions(id) ON DELETE CASCADE,
  problem_id      UUID REFERENCES problems(id) ON DELETE CASCADE,
  hypothesis_id   UUID REFERENCES hypotheses(id) ON DELETE CASCADE,
  action          TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'QUEUED',
  provider        TEXT NOT NULL,
  model           TEXT NOT NULL,
  input_digest    TEXT NOT NULL,
  prompt_summary  TEXT NOT NULL DEFAULT '',
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at     TIMESTAMPTZ,
  duration_ms     INTEGER,
  tokens_in       INTEGER,
  tokens_out      INTEGER,
  error           TEXT,
  requested_by_id UUID REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX agent_runs_session_idx ON agent_runs(session_id);
CREATE INDEX agent_runs_hypothesis_idx ON agent_runs(hypothesis_id);

ALTER TABLE hypothesis_evidence
  ADD CONSTRAINT hypothesis_evidence_run_fk
  FOREIGN KEY (added_by_run_id) REFERENCES agent_runs(id) ON DELETE SET NULL;

CREATE TABLE agent_findings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL,
  statement       TEXT NOT NULL,
  epistemic_kind  TEXT NOT NULL,
  confidence      TEXT NOT NULL,
  source_ids      UUID[] NOT NULL DEFAULT '{}',
  reasoning       TEXT NOT NULL,
  unresolved      TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX agent_findings_run_idx ON agent_findings(run_id);

CREATE TABLE validations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hypothesis_id UUID NOT NULL REFERENCES hypotheses(id) ON DELETE CASCADE,
  decision      TEXT NOT NULL,
  criteria      JSONB NOT NULL DEFAULT '[]'::jsonb,
  rationale     TEXT NOT NULL,
  decided_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  decided_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  origin        TEXT NOT NULL DEFAULT 'HUMAN'
);
CREATE INDEX validations_hypothesis_idx ON validations(hypothesis_id);

CREATE TABLE reputation_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL,
  delta           INTEGER NOT NULL,
  reason          TEXT NOT NULL,
  problem_id      UUID REFERENCES problems(id) ON DELETE SET NULL,
  contribution_id UUID REFERENCES contributions(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX reputation_events_user_idx ON reputation_events(user_id);
CREATE INDEX reputation_events_created_idx ON reputation_events(created_at DESC);

CREATE TABLE raw_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connector     TEXT NOT NULL,
  external_id   TEXT NOT NULL,
  title         TEXT NOT NULL,
  url           TEXT NOT NULL,
  publisher     TEXT NOT NULL,
  published_at  TEXT,
  body          TEXT NOT NULL,
  content_hash  TEXT NOT NULL,
  flags         TEXT[] NOT NULL DEFAULT '{}',
  fetched_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (connector, external_id)
);

CREATE TABLE problem_candidates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connector       TEXT NOT NULL,
  raw_document_id UUID REFERENCES raw_documents(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  summary         TEXT NOT NULL,
  draft           JSONB NOT NULL,
  proposed_domains TEXT[] NOT NULL DEFAULT '{}',
  extracted_claims JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_ids      UUID[] NOT NULL DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'NORMALIZED',
  curation_score  REAL NOT NULL DEFAULT 0,
  blocking        TEXT[] NOT NULL DEFAULT '{}',
  warnings        TEXT[] NOT NULL DEFAULT '{}',
  curator_note    TEXT,
  curated_by_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  published_problem_id UUID REFERENCES problems(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX problem_candidates_status_idx ON problem_candidates(status);

CREATE TABLE audit_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type   TEXT NOT NULL,
  actor_id     TEXT,
  action       TEXT NOT NULL,
  target_type  TEXT,
  target_id    TEXT,
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_created_idx ON audit_log(created_at DESC);
