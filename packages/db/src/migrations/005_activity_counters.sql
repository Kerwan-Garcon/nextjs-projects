-- Activity counters, kept on the row instead of computed per read.
--
-- Measured before writing this, on 5 021 problems and 200 256 contributions:
--
--   board sorted by urgency    3.2 ms    the LIMIT stops early, 24 subqueries
--   board sorted by activity   556 ms    seq scan, 5 021 subquery evaluations
--
-- Sorting by a computed column is what breaks it. `max(created_at)` has to be
-- evaluated for every candidate row before anything can be sorted, so the LIMIT
-- saves nothing and the cost is O(problems x contributions per problem). At
-- fifty thousand problems that is not 556 ms, it is five seconds.
--
-- So the counts move onto the row and triggers keep them true. The trade is
-- explicit: every contribution write now also touches its problem row, which
-- costs one indexed lookup and one update, and makes a hot problem a point of
-- row-level contention. For a board that is read far more often than it is
-- written, that is the right side of the trade.

ALTER TABLE problems
  ADD COLUMN contribution_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN hypothesis_count   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN evidence_count     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN researcher_count   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN last_activity_at   TIMESTAMPTZ;

-- Backfill from the truth before the triggers take over.
UPDATE problems p SET
  contribution_count = c.n,
  researcher_count   = c.authors,
  last_activity_at   = c.latest
FROM (
  SELECT problem_id, count(*)::int AS n, count(DISTINCT author_id)::int AS authors,
         max(created_at) AS latest
  FROM contributions GROUP BY problem_id
) c
WHERE c.problem_id = p.id;

UPDATE problems p SET hypothesis_count = h.n
FROM (SELECT problem_id, count(*)::int AS n FROM hypotheses GROUP BY problem_id) h
WHERE h.problem_id = p.id;

UPDATE problems p SET evidence_count = s.n
FROM (SELECT problem_id, count(*)::int AS n FROM problem_sources GROUP BY problem_id) s
WHERE s.problem_id = p.id;

-- The index the activity sort could not have before: the column is stored now,
-- so ordering by it is a scan the LIMIT can stop.
CREATE INDEX problems_activity_idx ON problems (last_activity_at DESC NULLS LAST);
CREATE INDEX problems_created_idx ON problems (created_at DESC);
-- The board's default order is urgency then difficulty. A composite index
-- serves it as one scan the LIMIT stops, instead of an incremental sort that
-- reads several hundred rows to return twenty-four.
CREATE INDEX problems_urgency_difficulty_idx ON problems (urgency DESC, difficulty DESC);
CREATE INDEX problems_difficulty_urgency_idx ON problems (difficulty DESC, urgency DESC);

-- ---------------------------------------------------------------------------
-- Contributions
--
-- `researcher_count` is a distinct count, which cannot simply be incremented.
-- It moves only when an author's first contribution to a problem arrives, or
-- their last one leaves - both answerable with one indexed existence check.
-- ---------------------------------------------------------------------------
CREATE INDEX contributions_problem_author_idx ON contributions (problem_id, author_id);
CREATE INDEX contributions_problem_created_idx ON contributions (problem_id, created_at DESC);

CREATE FUNCTION contributions_touch_problem() RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE problems SET
      contribution_count = contribution_count + 1,
      researcher_count = researcher_count + (
        CASE WHEN EXISTS (
          SELECT 1 FROM contributions
          WHERE problem_id = NEW.problem_id AND author_id = NEW.author_id AND id <> NEW.id
        ) THEN 0 ELSE 1 END
      ),
      last_activity_at = GREATEST(COALESCE(last_activity_at, NEW.created_at), NEW.created_at)
    WHERE id = NEW.problem_id;
    RETURN NEW;
  END IF;

  IF (TG_OP = 'DELETE') THEN
    UPDATE problems SET
      contribution_count = GREATEST(0, contribution_count - 1),
      researcher_count = GREATEST(0, researcher_count - (
        CASE WHEN EXISTS (
          SELECT 1 FROM contributions
          WHERE problem_id = OLD.problem_id AND author_id = OLD.author_id AND id <> OLD.id
        ) THEN 0 ELSE 1 END
      ))
    WHERE id = OLD.problem_id;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contributions_counters
AFTER INSERT OR DELETE ON contributions
FOR EACH ROW EXECUTE FUNCTION contributions_touch_problem();

-- ---------------------------------------------------------------------------
-- Hypotheses and evidence. Plain counters; no distinctness to preserve.
-- ---------------------------------------------------------------------------
CREATE FUNCTION hypotheses_touch_problem() RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE problems SET hypothesis_count = hypothesis_count + 1 WHERE id = NEW.problem_id;
    RETURN NEW;
  END IF;
  UPDATE problems SET hypothesis_count = GREATEST(0, hypothesis_count - 1) WHERE id = OLD.problem_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER hypotheses_counters
AFTER INSERT OR DELETE ON hypotheses
FOR EACH ROW EXECUTE FUNCTION hypotheses_touch_problem();

CREATE FUNCTION problem_sources_touch_problem() RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE problems SET evidence_count = evidence_count + 1 WHERE id = NEW.problem_id;
    RETURN NEW;
  END IF;
  UPDATE problems SET evidence_count = GREATEST(0, evidence_count - 1) WHERE id = OLD.problem_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER problem_sources_counters
AFTER INSERT OR DELETE ON problem_sources
FOR EACH ROW EXECUTE FUNCTION problem_sources_touch_problem();

-- ---------------------------------------------------------------------------
-- Search
--
-- `lower(title) LIKE '%heat%'` cannot use a btree at all, so it was a sequential
-- scan over every problem: 12 ms at five thousand rows, and linear from there.
-- Trigram indexes are what makes an unanchored LIKE indexable.
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX problems_title_trgm_idx ON problems USING gin (lower(title) gin_trgm_ops);
CREATE INDEX problems_summary_trgm_idx ON problems USING gin (lower(summary) gin_trgm_ops);
CREATE INDEX problems_geography_trgm_idx ON problems USING gin (lower(geography_label) gin_trgm_ops);
