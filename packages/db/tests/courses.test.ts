import { describe, expect, it } from 'vitest';
import { SEED_COURSES } from '../src/seed/courses.js';
import { SEED_SOURCES } from '../src/seed/sources.js';
import { SEED_PROBLEMS } from '../src/seed/problems.js';
import { DOMAIN_REFERENCE } from '../src/seed/domains.js';

const sourceKeys = new Set(SEED_SOURCES.map((source) => source.key));
const problemRefs = new Set(SEED_PROBLEMS.map((problem) => problem.ref));

const lessons = SEED_COURSES.flatMap((course) =>
  course.lessons.map((lesson) => ({ course, lesson, path: `${course.slug}/${lesson.slug}` })),
);
const statements = lessons.flatMap(({ lesson, path }) =>
  lesson.blocks
    .filter((block) => block.kind === 'STATEMENT')
    .map((block) => ({ block: block as Extract<typeof block, { kind: 'STATEMENT' }>, path })),
);

describe('course seed', () => {
  it('has courses in both tracks', () => {
    const tracks = new Set(SEED_COURSES.map((course) => course.track));
    expect(tracks).toEqual(new Set(['METHOD', 'SYSTEMS']));
  });

  it('gives every course and lesson a unique slug', () => {
    const courseSlugs = SEED_COURSES.map((course) => course.slug);
    expect(new Set(courseSlugs).size).toBe(courseSlugs.length);
    for (const course of SEED_COURSES) {
      const lessonSlugs = course.lessons.map((lesson) => lesson.slug);
      expect(new Set(lessonSlugs).size, course.slug).toBe(lessonSlugs.length);
      expect(course.lessons.length).toBeGreaterThan(0);
    }
  });

  // The point of the check. Every citation in a lesson must resolve against the
  // same library the problems cite - a course that cites a source the platform
  // cannot show is exactly the fabricated citation this product exists against.
  it('cites only sources that exist in the library', () => {
    const cited = statements.flatMap(({ block, path }) =>
      block.sourceKeys.map((key) => ({ key, path })),
    );
    expect(cited.length).toBeGreaterThan(0);
    const missing = cited.filter((entry) => !sourceKeys.has(entry.key));
    expect(missing, `unresolvable source keys: ${JSON.stringify(missing)}`).toEqual([]);
  });

  // The same rule the epistemic layer applies to problems and hypotheses: a
  // FACT or a SOURCE_CLAIM without a source is not one.
  it('never states a FACT or SOURCE_CLAIM without a source', () => {
    const unsourced = statements
      .filter(
        ({ block }) =>
          (block.epistemicKind === 'FACT' || block.epistemicKind === 'SOURCE_CLAIM') &&
          block.sourceKeys.length === 0,
      )
      .map(({ block, path }) => `${path}: ${block.text.slice(0, 60)}`);
    expect(unsourced).toEqual([]);
  });

  it('marks the open questions UNKNOWN rather than omitting them', () => {
    const unknowns = statements.filter(({ block }) => block.epistemicKind === 'UNKNOWN');
    expect(unknowns.length).toBeGreaterThan(0);
    for (const { block, path } of unknowns) {
      expect(block.sourceKeys, path).toEqual([]);
    }
  });

  it('points every course at problems that exist on the board', () => {
    const refs = lessons.flatMap(({ lesson, path }) =>
      lesson.problemRefs.map((ref) => ({ ref, path })),
    );
    const missing = refs.filter((entry) => !problemRefs.has(entry.ref));
    expect(missing, `unknown problem refs: ${JSON.stringify(missing)}`).toEqual([]);

    for (const course of SEED_COURSES) {
      const pointed = course.lessons.some((lesson) => lesson.problemRefs.length > 0);
      expect(pointed, `${course.slug} points at no problem`).toBe(true);
    }
  });

  it('files a systems course under a domain that exists', () => {
    const domains = new Set(DOMAIN_REFERENCE.map((domain) => domain.key));
    for (const course of SEED_COURSES) {
      if (course.domainKey === null) continue;
      expect(domains.has(course.domainKey), course.slug).toBe(true);
    }
    // A method course is about how to work here, not about a subject.
    for (const course of SEED_COURSES.filter((entry) => entry.track === 'METHOD')) {
      expect(course.domainKey, course.slug).toBeNull();
    }
  });

  it('asks answerable questions', () => {
    const questions = lessons.flatMap(({ lesson, path }) =>
      lesson.questions.map((question) => ({ question, path })),
    );
    expect(questions.length).toBeGreaterThan(0);
    for (const { question, path } of questions) {
      expect(question.options.length, path).toBeGreaterThanOrEqual(2);
      expect(new Set(question.options).size, path).toBe(question.options.length);
      expect(question.correctIndex, path).toBeGreaterThanOrEqual(0);
      expect(question.correctIndex, path).toBeLessThan(question.options.length);
      expect(question.explanation.length, path).toBeGreaterThan(20);
    }
    for (const { lesson, path } of lessons) {
      expect(lesson.questions.length, path).toBeGreaterThan(0);
    }
  });

  it('reports a reading time derived from its lessons', () => {
    for (const course of SEED_COURSES) {
      const summed = course.lessons.reduce((total, lesson) => total + lesson.minutes, 0);
      expect(course.estimatedMinutes, course.slug).toBe(summed);
      expect(course.estimatedMinutes, course.slug).toBeGreaterThan(0);
    }
  });
});
