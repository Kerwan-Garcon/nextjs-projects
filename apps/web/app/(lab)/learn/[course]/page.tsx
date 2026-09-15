import Link from 'next/link';
import { Panel, PanelHeader } from '@saveus/ui';
import { apiGetOr404 } from '@/lib/server-api';
import type { CourseDetail } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function CoursePage({ params }: { params: Promise<{ course: string }> }) {
  const { course: slug } = await params;
  const { course } = await apiGetOr404<{ course: CourseDetail }>(
    `/api/courses/${encodeURIComponent(slug)}`,
  );

  const next =
    course.lessons.find((lesson) => lesson.completedAt === null) ?? course.lessons[0] ?? null;

  return (
    <div className="enter max-w-3xl">
      <Link
        href="/learn"
        className="mono text-[10px] uppercase tracking-[0.1em] text-ink-dim hover:text-signal"
      >
        ← All courses
      </Link>

      <h1 className="mt-3 text-[20px] leading-tight text-ink">{course.title}</h1>
      <p className="mono mt-2 text-[11px] text-ink-dim">
        {course.lessonCount} lessons · about {course.estimatedMinutes} minutes ·{' '}
        {course.completedCount}/{course.lessonCount} done
      </p>
      <p className="mt-4 text-[13.5px] leading-relaxed text-ink-muted">{course.summary}</p>

      <Panel className="mt-5">
        <PanelHeader title="What you can do afterwards" />
        <p className="px-4 py-3 text-[13px] leading-relaxed text-ink">{course.outcome}</p>
      </Panel>

      {next ? (
        <Link
          href={`/learn/${course.slug}/${next.slug}`}
          className="mono mt-5 inline-block border border-signal/60 bg-signal/10 px-5 py-2.5 text-[11px] uppercase tracking-[0.12em] text-signal hover:bg-signal/20"
        >
          {course.completedCount === 0 ? 'Start' : 'Continue'} · {next.title}
        </Link>
      ) : null}

      <Panel className="mt-8">
        <PanelHeader title="Lessons" meta={`${course.lessonCount}`} />
        <ol className="divide-y divide-line">
          {course.lessons.map((lesson, index) => (
            <li key={lesson.id}>
              <Link
                href={`/learn/${course.slug}/${lesson.slug}`}
                className="flex items-start gap-4 px-4 py-3.5 transition-colors duration-150 hover:bg-panel-raised"
              >
                <span
                  className="mono mt-[2px] w-[22px] shrink-0 text-[11px]"
                  style={{ color: lesson.completedAt ? 'var(--color-ok)' : 'var(--color-ink-dim)' }}
                >
                  {lesson.completedAt ? '✓' : String(index + 1).padStart(2, '0')}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] leading-snug text-ink">{lesson.title}</span>
                  <span className="mt-1 block text-[12.5px] leading-relaxed text-ink-dim">
                    {lesson.hook}
                  </span>
                </span>
                <span className="mono shrink-0 text-[10px] text-ink-dim">{lesson.minutes} min</span>
              </Link>
            </li>
          ))}
        </ol>
      </Panel>
    </div>
  );
}
