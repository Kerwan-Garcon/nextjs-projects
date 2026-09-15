-- Interactive courses.
--
-- The board is written for people who already know how to read a constraint
-- table. That is a real barrier, and the platform's own premise - that
-- intelligence is distributed across billions of people and mostly wasted -
-- makes it an unacceptable one. These are the on-ramp.
--
-- They are built out of the same material as everything else: lessons are made
-- of typed statements with sources, not prose, so a lesson teaches the
-- epistemic layer by being written in it. Nothing here awards reputation.
-- Reputation is for research contributions; handing it out for finishing a
-- quiz is exactly the childish scoring this product exists without.

CREATE TABLE courses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              TEXT NOT NULL UNIQUE,
  title             TEXT NOT NULL,
  summary           TEXT NOT NULL,
  -- What a reader can do afterwards that they could not before.
  outcome           TEXT NOT NULL,
  track             TEXT NOT NULL,
  domain_key        TEXT REFERENCES domains(key) ON DELETE SET NULL,
  estimated_minutes INTEGER NOT NULL DEFAULT 10,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX courses_track_idx ON courses(track, sort_order);

CREATE TABLE lessons (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  slug        TEXT NOT NULL,
  title       TEXT NOT NULL,
  -- One sentence naming the idea the lesson turns on.
  hook        TEXT NOT NULL,
  -- Ordered blocks: prose, labelled statements, comparisons, checklists.
  blocks      JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Problems on the board this lesson prepares a reader to read.
  problem_refs TEXT[] NOT NULL DEFAULT '{}',
  minutes     INTEGER NOT NULL DEFAULT 4,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  UNIQUE (course_id, slug)
);
CREATE INDEX lessons_course_idx ON lessons(course_id, sort_order);

-- Questions check comprehension and then explain. They are not scored against
-- anybody and a wrong answer costs nothing: the explanation is the point.
CREATE TABLE lesson_questions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id     UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  prompt        TEXT NOT NULL,
  options       JSONB NOT NULL,
  correct_index INTEGER NOT NULL,
  explanation   TEXT NOT NULL,
  sort_order    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX lesson_questions_lesson_idx ON lesson_questions(lesson_id, sort_order);

CREATE TABLE lesson_progress (
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id    UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Which option was chosen per question, so a reader can see what they
  -- answered. Kept for them, not for ranking them against anyone.
  answers      JSONB NOT NULL DEFAULT '[]'::jsonb,
  PRIMARY KEY (user_id, lesson_id)
);
CREATE INDEX lesson_progress_user_idx ON lesson_progress(user_id, completed_at DESC);
