import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHarness, postJson, withCookie, type Harness } from './helpers.js';

interface CourseSummary {
  slug: string;
  title: string;
  track: string;
  domainKey: string | null;
  estimatedMinutes: number;
  lessonCount: number;
  completedCount: number;
}

interface LessonDetail {
  id: string;
  slug: string;
  title: string;
  minutes: number;
  blocks: {
    kind: string;
    text?: string;
    epistemicKind?: string;
    kindLabel?: string;
    sources?: { id: string; title: string; url: string; reliability: string }[];
  }[];
  questions: {
    id: string;
    prompt: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  }[];
  problems: { ref: string; slug: string; title: string }[];
  completedAt: string | null;
  answers: number[];
  previous: { slug: string } | null;
  next: { slug: string } | null;
}

let harness: Harness;
let cookie: string;
let courses: CourseSummary[];

beforeAll(async () => {
  harness = await createHarness();
  cookie = await harness.signIn('curator-01');
  courses = (await harness.json<{ courses: CourseSummary[] }>('/api/courses')).courses;
}, 120_000);

afterAll(async () => {
  await harness?.close();
});

describe('courses', () => {
  it('serves both tracks without a session', async () => {
    expect(courses.length).toBeGreaterThan(0);
    expect(new Set(courses.map((course) => course.track))).toEqual(new Set(['METHOD', 'SYSTEMS']));
    for (const course of courses) {
      expect(course.lessonCount, course.slug).toBeGreaterThan(0);
      expect(course.completedCount, course.slug).toBe(0);
      expect(course.estimatedMinutes, course.slug).toBeGreaterThan(0);
    }
  });

  it('resolves every citation in a lesson to a real source record', async () => {
    let statementsSeen = 0;
    let citationsSeen = 0;

    for (const course of courses) {
      const detail = await harness.json<{ course: { lessons: { slug: string }[] } }>(
        `/api/courses/${course.slug}`,
      );
      for (const summary of detail.course.lessons) {
        const { lesson } = await harness.json<{ lesson: LessonDetail }>(
          `/api/courses/${course.slug}/lessons/${summary.slug}`,
        );
        for (const block of lesson.blocks) {
          if (block.kind !== 'STATEMENT') continue;
          statementsSeen += 1;
          expect(block.epistemicKind, `${course.slug}/${summary.slug}`).toBeTruthy();
          expect(block.kindLabel, `${course.slug}/${summary.slug}`).toBeTruthy();

          const sources = block.sources ?? [];
          if (block.epistemicKind === 'FACT' || block.epistemicKind === 'SOURCE_CLAIM') {
            // The rule the whole product turns on: a claim of this kind that
            // cannot be followed to a real publication must not be shown.
            expect(sources.length, `${course.slug}/${summary.slug}: ${block.text}`).toBeGreaterThan(
              0,
            );
          }
          for (const source of sources) {
            citationsSeen += 1;
            expect(source.url).toMatch(/^https?:\/\//);
            expect(source.title.length).toBeGreaterThan(0);
          }
        }
      }
    }

    expect(statementsSeen).toBeGreaterThan(20);
    expect(citationsSeen).toBeGreaterThan(20);
  });

  it('points a lesson at problems that are on the board', async () => {
    const { lesson } = await harness.json<{ lesson: LessonDetail }>(
      '/api/courses/what-counts-as-a-problem/lessons/a-topic-is-not-a-problem',
    );
    expect(lesson.problems.length).toBeGreaterThan(0);

    for (const pointer of lesson.problems) {
      const response = await harness.request(`/api/problems/${pointer.slug}`);
      expect(response.status, pointer.slug).toBe(200);
    }
  });

  it('links lessons in order', async () => {
    const { course } = await harness.json<{ course: { lessons: { slug: string }[] } }>(
      '/api/courses/what-counts-as-a-problem',
    );
    const first = course.lessons[0]!;
    const last = course.lessons[course.lessons.length - 1]!;

    const head = await harness.json<{ lesson: LessonDetail }>(
      `/api/courses/what-counts-as-a-problem/lessons/${first.slug}`,
    );
    const tail = await harness.json<{ lesson: LessonDetail }>(
      `/api/courses/what-counts-as-a-problem/lessons/${last.slug}`,
    );

    expect(head.lesson.previous).toBeNull();
    expect(head.lesson.next?.slug).toBe(course.lessons[1]!.slug);
    expect(tail.lesson.next).toBeNull();
  });

  it('404s on an unknown course or lesson', async () => {
    expect((await harness.request('/api/courses/not-a-course')).status).toBe(404);
    expect(
      (await harness.request('/api/courses/what-counts-as-a-problem/lessons/not-a-lesson')).status,
    ).toBe(404);
  });

  it('refuses a slug that is not one', async () => {
    expect((await harness.request('/api/courses/..%2F..%2Fetc')).status).toBe(400);
  });
});

describe('lesson progress', () => {
  const path = '/api/courses/reading-evidence/lessons/saying-unknown';

  it('needs a session to record', async () => {
    const response = await harness.request(`${path}/complete`, postJson({ answers: [0] }));
    expect(response.status).toBe(401);
  });

  it('records completion for the reader who did it', async () => {
    const before = await harness.json<{ lesson: LessonDetail }>(path, withCookie(cookie));
    expect(before.lesson.completedAt).toBeNull();

    const answers = before.lesson.questions.map((question) => question.correctIndex);
    const response = await harness.request(`${path}/complete`, postJson({ answers }, cookie));
    expect(response.status).toBe(200);

    const after = await harness.json<{ lesson: LessonDetail }>(path, withCookie(cookie));
    expect(after.lesson.completedAt).not.toBeNull();
    expect(after.lesson.answers).toEqual(answers);

    // Re-reading it is idempotent, not a second completion.
    const again = await harness.request(`${path}/complete`, postJson({ answers }, cookie));
    expect(again.status).toBe(200);

    const anonymous = await harness.json<{ lesson: LessonDetail }>(path);
    expect(anonymous.lesson.completedAt).toBeNull();
  });

  it('reports progress in the profile area', async () => {
    const { progress } = await harness.json<{
      progress: {
        lessonsCompleted: number;
        lessonsTotal: number;
        nextLesson: { slug: string } | null;
      };
    }>('/api/my-learning', withCookie(cookie));

    expect(progress.lessonsCompleted).toBeGreaterThan(0);
    expect(progress.lessonsTotal).toBeGreaterThan(progress.lessonsCompleted);
    expect(progress.nextLesson).not.toBeNull();
  });

  // The constraint from the brief, asserted rather than assumed: reputation is
  // research reputation. Finishing a lesson must never move it.
  it('awards no reputation for finishing a lesson', async () => {
    const readReputation = async (): Promise<{ reputation: number; events: number }> => {
      const user = await harness.db
        .selectFrom('users')
        .where('handle', '=', 'curator-01')
        .select('reputation')
        .executeTakeFirstOrThrow();
      const events = await harness.db
        .selectFrom('reputation_events')
        .select(({ fn }) => fn.countAll<string>().as('count'))
        .executeTakeFirstOrThrow();
      return { reputation: user.reputation, events: Number(events.count) };
    };

    const before = await readReputation();
    const response = await harness.request(
      '/api/courses/reading-evidence/lessons/sources-are-not-equal/complete',
      postJson({ answers: [0, 0] }, cookie),
    );
    expect(response.status).toBe(200);

    expect(await readReputation()).toEqual(before);
  });

  it('refuses an answer list that is not one', async () => {
    const response = await harness.request(
      `${path}/complete`,
      postJson({ answers: ['yes'] }, cookie),
    );
    expect(response.status).toBe(400);
  });
});
