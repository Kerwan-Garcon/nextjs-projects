import Link from 'next/link';
import { Empty, Panel, PanelHeader } from '@saveus/ui';
import { apiGet } from '@/lib/server-api';
import type { CourseSummary } from '@/lib/types';

export const dynamic = 'force-dynamic';

const TRACKS: { key: string; title: string; blurb: string }[] = [
  {
    key: 'METHOD',
    title: 'How to work here',
    blurb:
      'What separates a topic from a problem, what a hypothesis has to contain before anyone can attack it, and how to read a number back to the document it came from. Start here if the board looks impenetrable.',
  },
  {
    key: 'SYSTEMS',
    title: 'The systems themselves',
    blurb:
      'Climate and energy, cities, health, food and land. Enough of each to follow an argument about it, argued from the same sources the problems cite.',
  },
];

/**
 * The course index.
 *
 * The board is written for people who can already read a constraint table, and
 * that is a barrier this platform cannot afford: its own premise is that most
 * of the intelligence available to the problem is outside the room. These are
 * the on-ramp, they are free, and they need no account to read.
 */
export default async function LearnPage() {
  const { courses } = await apiGet<{ courses: CourseSummary[] }>('/api/courses');
  const totalMinutes = courses.reduce((total, course) => total + course.estimatedMinutes, 0);
  const done = courses.reduce((total, course) => total + course.completedCount, 0);
  const lessons = courses.reduce((total, course) => total + course.lessonCount, 0);

  return (
    <div className="enter max-w-4xl">
      <h1 className="mono text-[13px] uppercase tracking-[0.16em]">Learn</h1>
      <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink-muted">
        {lessons} lessons, about {totalMinutes} minutes in total, free and open to anyone. They are
        written in the same notation as the rest of the product: every factual claim carries its
        kind and its source, and where the honest answer is that nobody knows, the lesson says so.
      </p>
      <p className="mono mt-3 text-[11px] text-ink-dim">
        Nothing here earns reputation. Reputation is for research; finishing a lesson is for you.
        {done > 0 ? ` · ${done}/${lessons} done` : ''}
      </p>

      {courses.length === 0 ? (
        <div className="mt-8">
          <Empty title="No courses loaded" />
        </div>
      ) : null}

      {TRACKS.map((track) => {
        const inTrack = courses.filter((course) => course.track === track.key);
        if (inTrack.length === 0) return null;

        return (
          <section key={track.key} className="mt-10">
            <h2 className="section-head mb-3">
              <span className="label text-ink-muted">{track.title}</span>
            </h2>
            <p className="mb-4 max-w-2xl text-[12.5px] leading-relaxed text-ink-dim">
              {track.blurb}
            </p>

            <div className="grid gap-3 md:grid-cols-2">
              {inTrack.map((course) => (
                <Link key={course.id} href={`/learn/${course.slug}`} className="group block">
                  <Panel className="h-full transition-colors duration-150 group-hover:border-signal/40">
                    <PanelHeader
                      title={course.title}
                      meta={`${course.lessonCount} lessons · ${course.estimatedMinutes} min`}
                    />
                    <div className="px-4 py-3">
                      <p className="text-[13px] leading-relaxed text-ink-muted">{course.summary}</p>
                      <p className="mt-3 text-[12px] leading-relaxed text-ink-dim">
                        <span className="mono text-[10px] uppercase tracking-[0.1em] text-ink-dim">
                          Afterwards ·{' '}
                        </span>
                        {course.outcome}
                      </p>
                      <Progress done={course.completedCount} total={course.lessonCount} />
                    </div>
                  </Panel>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Progress({ done, total }: { done: number; total: number }) {
  return (
    <div className="mt-4 flex items-center gap-2">
      <div className="flex gap-[2px]" role="img" aria-label={`${done} of ${total} lessons done`}>
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className={`h-[7px] w-[16px] ${index < done ? 'bg-ok' : 'bg-line-strong'}`}
          />
        ))}
      </div>
      <span className="mono text-[10px] text-ink-dim">
        {done}/{total}
      </span>
    </div>
  );
}
