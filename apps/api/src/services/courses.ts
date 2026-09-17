import { AppError, EPISTEMIC_DESCRIPTORS, type EpistemicKind } from '@saveus/common';
import { json, type Db } from '@saveus/db';
import { toSource, type SourceDto } from './serializers.js';

/**
 * The courses.
 *
 * Read-only apart from one write: a signed-in reader marking a lesson done.
 * There is deliberately no score, no streak and no reputation here. The brief
 * is explicit that reputation is research reputation, and a platform that pays
 * people for finishing a quiz gets quiz-finishing. What a reader gets instead
 * is the thing the lesson was for: a list of real problems they are now
 * equipped to read.
 *
 * Everything is public. Progress is the only part that needs an identity, and
 * an anonymous account is an identity - the courses are open to anyone, signed
 * in or not.
 */

export type LessonBlockDto =
  | { kind: 'PROSE'; text: string }
  | {
      kind: 'STATEMENT';
      text: string;
      epistemicKind: EpistemicKind;
      kindLabel: string;
      sources: SourceDto[];
    }
  | { kind: 'CALLOUT'; title: string; text: string }
  | {
      kind: 'COMPARE';
      caption: string;
      wrong: { label: string; text: string };
      right: { label: string; text: string };
    }
  | { kind: 'CHECKLIST'; title: string; items: string[] };

export interface LessonSummaryDto {
  id: string;
  slug: string;
  title: string;
  hook: string;
  minutes: number;
  completedAt: string | null;
}

export interface CourseSummaryDto {
  id: string;
  slug: string;
  title: string;
  summary: string;
  outcome: string;
  track: string;
  domainKey: string | null;
  estimatedMinutes: number;
  lessonCount: number;
  completedCount: number;
}

export interface CourseDetailDto extends CourseSummaryDto {
  lessons: LessonSummaryDto[];
}

export interface LessonQuestionDto {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface ProblemPointerDto {
  ref: string;
  slug: string;
  title: string;
  summary: string;
  difficulty: number;
  urgency: number;
}

export interface LessonDetailDto {
  id: string;
  slug: string;
  title: string;
  hook: string;
  minutes: number;
  blocks: LessonBlockDto[];
  questions: LessonQuestionDto[];
  problems: ProblemPointerDto[];
  completedAt: string | null;
  answers: number[];
  course: { slug: string; title: string; track: string };
  previous: { slug: string; title: string } | null;
  next: { slug: string; title: string } | null;
}

/** Lesson ids this user has finished. Empty for a reader who is not signed in. */
async function completedLessonIds(db: Db, userId: string | null): Promise<Map<string, Date>> {
  if (!userId) return new Map();
  const rows = await db
    .selectFrom('lesson_progress')
    .where('user_id', '=', userId)
    .select(['lesson_id', 'completed_at'])
    .execute();
  return new Map(rows.map((row) => [row.lesson_id, row.completed_at]));
}

export async function listCourses(db: Db, userId: string | null): Promise<CourseSummaryDto[]> {
  const [courses, lessons, done] = await Promise.all([
    db.selectFrom('courses').selectAll().orderBy('track').orderBy('sort_order').execute(),
    db.selectFrom('lessons').select(['id', 'course_id']).execute(),
    completedLessonIds(db, userId),
  ]);

  const byCourse = new Map<string, string[]>();
  for (const lesson of lessons) {
    const list = byCourse.get(lesson.course_id) ?? [];
    list.push(lesson.id);
    byCourse.set(lesson.course_id, list);
  }

  return courses.map((course) => {
    const lessonIds = byCourse.get(course.id) ?? [];
    return {
      id: course.id,
      slug: course.slug,
      title: course.title,
      summary: course.summary,
      outcome: course.outcome,
      track: course.track,
      domainKey: course.domain_key,
      estimatedMinutes: course.estimated_minutes,
      lessonCount: lessonIds.length,
      completedCount: lessonIds.filter((id) => done.has(id)).length,
    };
  });
}

export async function getCourse(
  db: Db,
  slug: string,
  userId: string | null,
): Promise<CourseDetailDto> {
  const course = await db
    .selectFrom('courses')
    .where('slug', '=', slug)
    .selectAll()
    .executeTakeFirst();
  if (!course) throw new AppError('NOT_FOUND', 'No such course');

  const [lessons, done] = await Promise.all([
    db
      .selectFrom('lessons')
      .where('course_id', '=', course.id)
      .select(['id', 'slug', 'title', 'hook', 'minutes'])
      .orderBy('sort_order')
      .execute(),
    completedLessonIds(db, userId),
  ]);

  return {
    id: course.id,
    slug: course.slug,
    title: course.title,
    summary: course.summary,
    outcome: course.outcome,
    track: course.track,
    domainKey: course.domain_key,
    estimatedMinutes: course.estimated_minutes,
    lessonCount: lessons.length,
    completedCount: lessons.filter((lesson) => done.has(lesson.id)).length,
    lessons: lessons.map((lesson) => ({
      id: lesson.id,
      slug: lesson.slug,
      title: lesson.title,
      hook: lesson.hook,
      minutes: lesson.minutes,
      completedAt: done.get(lesson.id)?.toISOString() ?? null,
    })),
  };
}

export async function getLesson(
  db: Db,
  courseSlug: string,
  lessonSlug: string,
  userId: string | null,
): Promise<LessonDetailDto> {
  const course = await db
    .selectFrom('courses')
    .where('slug', '=', courseSlug)
    .select(['id', 'slug', 'title', 'track'])
    .executeTakeFirst();
  if (!course) throw new AppError('NOT_FOUND', 'No such course');

  const siblings = await db
    .selectFrom('lessons')
    .where('course_id', '=', course.id)
    .select(['id', 'slug', 'title', 'hook', 'minutes', 'blocks', 'problem_refs', 'sort_order'])
    .orderBy('sort_order')
    .execute();

  const index = siblings.findIndex((lesson) => lesson.slug === lessonSlug);
  const lesson = siblings[index];
  if (!lesson) throw new AppError('NOT_FOUND', 'No such lesson');

  const blocks = lesson.blocks;
  const sourceIds = [
    ...new Set(blocks.flatMap((block) => (block.kind === 'STATEMENT' ? block.sourceKeys : []))),
  ];

  const [sourceRows, questions, problems, progress] = await Promise.all([
    sourceIds.length > 0
      ? db.selectFrom('sources').where('id', 'in', sourceIds).selectAll().execute()
      : Promise.resolve([]),
    db
      .selectFrom('lesson_questions')
      .where('lesson_id', '=', lesson.id)
      .select(['id', 'prompt', 'options', 'correct_index', 'explanation'])
      .orderBy('sort_order')
      .execute(),
    lesson.problem_refs.length > 0
      ? db
          .selectFrom('problems')
          .where('ref', 'in', lesson.problem_refs)
          .select(['ref', 'slug', 'title', 'summary', 'difficulty', 'urgency'])
          .execute()
      : Promise.resolve([]),
    userId
      ? db
          .selectFrom('lesson_progress')
          .where('user_id', '=', userId)
          .where('lesson_id', '=', lesson.id)
          .select(['completed_at', 'answers'])
          .executeTakeFirst()
      : Promise.resolve(undefined),
  ]);

  const sourcesById = new Map(sourceRows.map((row) => [row.id, toSource(row)]));
  const problemsByRef = new Map(problems.map((row) => [row.ref, row]));

  const previous = index > 0 ? siblings[index - 1] : undefined;
  const next = index < siblings.length - 1 ? siblings[index + 1] : undefined;

  return {
    id: lesson.id,
    slug: lesson.slug,
    title: lesson.title,
    hook: lesson.hook,
    minutes: lesson.minutes,
    blocks: blocks.map((block): LessonBlockDto => {
      if (block.kind !== 'STATEMENT') return block;
      return {
        kind: 'STATEMENT',
        text: block.text,
        epistemicKind: block.epistemicKind,
        kindLabel: EPISTEMIC_DESCRIPTORS[block.epistemicKind].label,
        // A source the library no longer holds is dropped rather than rendered
        // as a dead citation. The seed test forbids this from happening; this
        // is the guard for a source deleted after the fact.
        sources: block.sourceKeys
          .map((id) => sourcesById.get(id))
          .filter((source): source is SourceDto => source !== undefined),
      };
    }),
    // correctIndex travels to the client on purpose: the answer is checked in
    // the browser so the explanation appears immediately, and since nothing is
    // scored or rewarded there is nothing to gain by reading it.
    questions: questions.map((question) => ({
      id: question.id,
      prompt: question.prompt,
      options: question.options,
      correctIndex: question.correct_index,
      explanation: question.explanation,
    })),
    problems: lesson.problem_refs
      .map((ref) => problemsByRef.get(ref))
      .filter((row): row is NonNullable<typeof row> => row !== undefined),
    completedAt: progress?.completed_at.toISOString() ?? null,
    answers: progress?.answers ?? [],
    course: { slug: course.slug, title: course.title, track: course.track },
    previous: previous ? { slug: previous.slug, title: previous.title } : null,
    next: next ? { slug: next.slug, title: next.title } : null,
  };
}

export async function completeLesson(
  db: Db,
  userId: string,
  courseSlug: string,
  lessonSlug: string,
  answers: number[],
): Promise<{ completedAt: string }> {
  const lesson = await db
    .selectFrom('lessons as l')
    .innerJoin('courses as c', 'c.id', 'l.course_id')
    .where('c.slug', '=', courseSlug)
    .where('l.slug', '=', lessonSlug)
    .select('l.id')
    .executeTakeFirst();
  if (!lesson) throw new AppError('NOT_FOUND', 'No such lesson');

  const completedAt = new Date();
  await db
    .insertInto('lesson_progress')
    .values({
      user_id: userId,
      lesson_id: lesson.id,
      completed_at: completedAt,
      answers: json(answers),
    })
    .onConflict((oc) =>
      oc.columns(['user_id', 'lesson_id']).doUpdateSet({
        completed_at: completedAt,
        answers: json(answers),
      }),
    )
    .execute();

  return { completedAt: completedAt.toISOString() };
}

export interface LearningProgressDto {
  lessonsCompleted: number;
  lessonsTotal: number;
  coursesCompleted: number;
  coursesTotal: number;
  nextLesson: { courseSlug: string; courseTitle: string; slug: string; title: string } | null;
}

/** The compact view for the profile area. */
export async function learningProgress(db: Db, userId: string): Promise<LearningProgressDto> {
  const [lessons, done] = await Promise.all([
    db
      .selectFrom('lessons as l')
      .innerJoin('courses as c', 'c.id', 'l.course_id')
      .select([
        'l.id',
        'l.slug',
        'l.title',
        'c.id as course_id',
        'c.slug as course_slug',
        'c.title as course_title',
      ])
      .orderBy('c.track')
      .orderBy('c.sort_order')
      .orderBy('l.sort_order')
      .execute(),
    completedLessonIds(db, userId),
  ]);

  const perCourse = new Map<string, { total: number; done: number }>();
  for (const lesson of lessons) {
    const entry = perCourse.get(lesson.course_id) ?? { total: 0, done: 0 };
    entry.total += 1;
    if (done.has(lesson.id)) entry.done += 1;
    perCourse.set(lesson.course_id, entry);
  }

  const next = lessons.find((lesson) => !done.has(lesson.id));

  return {
    lessonsCompleted: lessons.filter((lesson) => done.has(lesson.id)).length,
    lessonsTotal: lessons.length,
    coursesCompleted: [...perCourse.values()].filter(
      (entry) => entry.total > 0 && entry.done === entry.total,
    ).length,
    coursesTotal: perCourse.size,
    nextLesson: next
      ? {
          courseSlug: next.course_slug,
          courseTitle: next.course_title,
          slug: next.slug,
          title: next.title,
        }
      : null,
  };
}
