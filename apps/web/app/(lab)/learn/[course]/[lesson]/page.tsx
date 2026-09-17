import Link from 'next/link';
import { Meter, Panel, PanelHeader, SectionHeading } from '@saveus/ui';
import { LessonBlocks } from '@/components/lesson-blocks';
import { LessonCheck } from '@/components/lesson-check';
import { apiGet, apiGetOr404 } from '@/lib/server-api';
import type { LessonDetail, SessionUser } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function LessonPage({
  params,
}: {
  params: Promise<{ course: string; lesson: string }>;
}) {
  const { course: courseSlug, lesson: lessonSlug } = await params;
  const [{ lesson }, session] = await Promise.all([
    apiGetOr404<{ lesson: LessonDetail }>(
      `/api/courses/${encodeURIComponent(courseSlug)}/lessons/${encodeURIComponent(lessonSlug)}`,
    ),
    apiGet<{ user: SessionUser | null }>('/api/me'),
  ]);

  return (
    <div className="enter max-w-3xl">
      <Link
        href={`/learn/${lesson.course.slug}`}
        className="mono text-[10px] uppercase tracking-[0.1em] text-ink-dim hover:text-signal"
      >
        ← {lesson.course.title}
      </Link>

      <h1 className="mt-3 text-[20px] leading-tight text-ink">{lesson.title}</h1>
      <p className="mt-2 text-[13.5px] leading-relaxed text-ink-muted">{lesson.hook}</p>
      <p className="mono mt-2 text-[10.5px] text-ink-dim">
        about {lesson.minutes} minutes
        {lesson.completedAt ? ` · read ${lesson.completedAt.slice(0, 10)}` : ''}
      </p>

      <div className="mt-8">
        <LessonBlocks blocks={lesson.blocks} />
      </div>

      {lesson.questions.length > 0 ? (
        <>
          <SectionHeading>Check yourself</SectionHeading>
          <LessonCheck
            courseSlug={lesson.course.slug}
            lessonSlug={lesson.slug}
            questions={lesson.questions}
            user={session.user}
            completedAt={lesson.completedAt}
            savedAnswers={lesson.answers}
            next={lesson.next}
          />
        </>
      ) : null}

      {lesson.problems.length > 0 ? (
        <>
          <SectionHeading>Where to put this</SectionHeading>
          <p className="-mt-2 mb-4 text-[12.5px] leading-relaxed text-ink-dim">
            Open problems on the board that this lesson prepares you to read. They are real, they
            are unsolved, and the discussion on them is open.
          </p>
          <Panel>
            <PanelHeader title="Open problems" meta={`${lesson.problems.length}`} />
            <ul className="divide-y divide-line">
              {lesson.problems.map((problem) => (
                <li key={problem.ref}>
                  <Link
                    href={`/problems/${problem.slug}`}
                    className="block px-4 py-3.5 transition-colors duration-150 hover:bg-panel-raised"
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="mono text-[10px] text-ink-dim">#{problem.ref}</span>
                      <span className="text-[13.5px] leading-snug text-ink">{problem.title}</span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-relaxed text-ink-muted">
                      {problem.summary}
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-5">
                      <Meter label="Difficulty" value={problem.difficulty} tone="neutral" />
                      <Meter label="Urgency" value={problem.urgency} tone="warn" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        </>
      ) : null}

      <nav className="mt-10 flex items-center justify-between gap-4 border-t border-line pt-4">
        {lesson.previous ? (
          <Link
            href={`/learn/${lesson.course.slug}/${lesson.previous.slug}`}
            className="mono text-[10px] uppercase tracking-[0.1em] text-ink-dim hover:text-signal"
          >
            ← {lesson.previous.title}
          </Link>
        ) : (
          <span />
        )}
        {lesson.next ? (
          <Link
            href={`/learn/${lesson.course.slug}/${lesson.next.slug}`}
            className="mono text-right text-[10px] uppercase tracking-[0.1em] text-ink-dim hover:text-signal"
          >
            {lesson.next.title} →
          </Link>
        ) : (
          <Link
            href={`/learn/${lesson.course.slug}`}
            className="mono text-right text-[10px] uppercase tracking-[0.1em] text-ink-dim hover:text-signal"
          >
            Back to the course →
          </Link>
        )}
      </nav>
    </div>
  );
}
