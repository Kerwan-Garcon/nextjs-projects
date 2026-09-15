import Link from 'next/link';
import { Empty, Panel, PanelHeader, Stat, StatusTag } from '@saveus/ui';
import { LogoutButton } from '@/components/logout-button';
import { apiGet, apiGetOrNull } from '@/lib/server-api';
import type { LearningProgress, SessionUser } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface MyWork {
  profile: {
    handle: string;
    displayName: string;
    reputation: number;
    tier: string;
    nextTier: string | null;
    tierProgress: number;
    stats: {
      problems: number;
      hypotheses: number;
      evidence: number;
      contributions: number;
      validated: number;
      endorsementsReceived: number;
    };
  };
  hypotheses: {
    id: string;
    ref: string;
    title: string;
    status: string;
    updatedAt: string;
    problemSlug: string;
    problemTitle: string;
  }[];
  contributions: {
    id: string;
    kind: string;
    body: string;
    score: number;
    createdAt: string;
    targetType: string;
    targetId: string;
    problemSlug: string;
    problemTitle: string;
  }[];
  sessions: {
    id: string;
    title: string;
    question: string;
    action: string;
    status: string;
    createdAt: string;
  }[];
}

export default async function MyWorkPage() {
  const session = await apiGet<{ user: SessionUser | null }>('/api/me');
  if (!session.user) {
    return (
      <div className="mx-auto max-w-lg py-20 text-center">
        <h1 className="mono text-[13px] uppercase tracking-[0.16em]">My work</h1>
        <p className="mt-3 text-[13px] text-ink-muted">
          Sign in to see the problems you are working on, the hypotheses you authored and every
          reputation event attached to your account.
        </p>
        <Link
          href="/sign-in"
          className="mono mt-6 inline-block border border-signal/60 bg-signal/10 px-5 py-2.5 text-[11px] uppercase tracking-[0.12em] text-signal"
        >
          Sign in
        </Link>
      </div>
    );
  }

  const [data, learning] = await Promise.all([
    apiGetOrNull<MyWork>('/api/my-work'),
    apiGetOrNull<{ progress: LearningProgress }>('/api/my-learning'),
  ]);
  if (!data) return <Empty title="Could not load your work" />;

  return (
    <div className="enter space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
        <div>
          <h1 className="mono text-[13px] uppercase tracking-[0.16em]">My work</h1>
          <p className="mono mt-1 text-[11px] text-ink-dim">
            {data.profile.handle} · {data.profile.tier}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/profile/${data.profile.handle}`}
            className="mono border border-line-strong px-3 py-1.5 text-[10px] uppercase tracking-[0.1em] text-ink-muted hover:border-signal/50 hover:text-signal"
          >
            Public profile
          </Link>
          <LogoutButton />
        </div>
      </div>

      <div className="grid gap-4 py-5 md:grid-cols-3 lg:grid-cols-6">
        <Stat label="Reputation" value={data.profile.reputation} hint={data.profile.tier} />
        <Stat label="Problems" value={data.profile.stats.problems} />
        <Stat label="Hypotheses" value={data.profile.stats.hypotheses} />
        <Stat label="Evidence" value={data.profile.stats.evidence} />
        <Stat label="Contributions" value={data.profile.stats.contributions} />
        <Stat label="Agent runs" value={data.sessions.length} hint="requested by you" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="My hypotheses" meta={`${data.hypotheses.length}`} />
          {data.hypotheses.length === 0 ? (
            <p className="px-4 py-5 text-[12px] leading-relaxed text-ink-dim">
              You have not authored a hypothesis yet. Open a problem, read what is already known,
              and propose a mechanism someone could attack.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {data.hypotheses.map((hypothesis) => (
                <li key={hypothesis.id}>
                  <Link
                    href={`/hypotheses/${hypothesis.id}`}
                    className="block px-4 py-3 transition-colors duration-150 hover:bg-panel-raised"
                  >
                    <div className="flex items-center gap-2">
                      <span className="mono text-[10px] text-ink-dim">#{hypothesis.ref}</span>
                      <StatusTag status={hypothesis.status} />
                      <span className="mono ml-auto text-[10px] text-ink-dim">
                        {hypothesis.updatedAt.slice(0, 10)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[13px] leading-snug text-ink">{hypothesis.title}</p>
                    <p className="mono mt-1 text-[10px] text-ink-dim">{hypothesis.problemTitle}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHeader title="My contributions" meta={`${data.contributions.length} most recent`} />
          {data.contributions.length === 0 ? (
            <p className="px-4 py-5 text-[12px] text-ink-dim">Nothing yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {data.contributions.slice(0, 15).map((contribution) => (
                <li key={contribution.id}>
                  <Link
                    href={
                      contribution.targetType === 'HYPOTHESIS'
                        ? `/hypotheses/${contribution.targetId}`
                        : `/problems/${contribution.problemSlug}`
                    }
                    className="block px-4 py-3 transition-colors duration-150 hover:bg-panel-raised"
                  >
                    <div className="flex items-center gap-2">
                      <span className="mono text-[9.5px] uppercase tracking-[0.1em] text-ink-dim">
                        {contribution.kind}
                      </span>
                      <span className="mono text-[10px] text-signal">
                        {contribution.score.toFixed(1)}/100
                      </span>
                      <span className="mono ml-auto text-[10px] text-ink-dim">
                        {contribution.createdAt.slice(0, 10)}
                      </span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-relaxed text-ink-muted">
                      {contribution.body}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {learning ? <LearningPanel progress={learning.progress} /> : null}

      <Panel className="mt-4">
        <PanelHeader title="Research sessions I requested" meta={`${data.sessions.length}`} />
        {data.sessions.length === 0 ? (
          <p className="px-4 py-5 text-[12px] text-ink-dim">
            None yet. Contextual research actions live on the hypothesis page.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {data.sessions.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <span className="mono text-[10px] uppercase tracking-[0.1em] text-ink">
                  {item.title}
                </span>
                <span className="flex-1 truncate text-[12px] text-ink-muted">{item.question}</span>
                <span className="mono text-[10px] text-ink-dim">{item.createdAt.slice(0, 10)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

/**
 * Learning progress, in the profile area where it was asked for.
 *
 * It sits next to the research work but is counted separately and never folded
 * into reputation: what you have read is not what you have contributed, and the
 * product would be lying if it added them together.
 */
function LearningPanel({ progress }: { progress: LearningProgress }) {
  const complete = progress.lessonsTotal > 0 && progress.lessonsCompleted === progress.lessonsTotal;

  return (
    <Panel className="mt-4">
      <PanelHeader
        title="Courses"
        meta={`${progress.lessonsCompleted}/${progress.lessonsTotal} lessons · ${progress.coursesCompleted}/${progress.coursesTotal} courses`}
        action={
          <Link
            href="/learn"
            className="mono border border-line-strong px-3 py-1.5 text-[10px] uppercase tracking-[0.1em] text-ink-muted hover:border-signal/50 hover:text-signal"
          >
            All courses
          </Link>
        }
      />
      <div className="px-4 py-3.5">
        <div className="flex items-center gap-2">
          <div
            className="flex flex-wrap gap-[2px]"
            role="img"
            aria-label={`${progress.lessonsCompleted} of ${progress.lessonsTotal} lessons read`}
          >
            {Array.from({ length: progress.lessonsTotal }, (_, index) => (
              <span
                key={index}
                className={`h-[8px] w-[14px] ${index < progress.lessonsCompleted ? 'bg-ok' : 'bg-line-strong'}`}
              />
            ))}
          </div>
        </div>

        {complete ? (
          <p className="mt-3 text-[12.5px] leading-relaxed text-ink-muted">
            You have read all of them. The place to put it is the board: pick an open problem and
            attack the weakest assumption you can find in it.
          </p>
        ) : progress.nextLesson ? (
          <p className="mt-3 text-[12.5px] leading-relaxed text-ink-muted">
            Next up:{' '}
            <Link
              href={`/learn/${progress.nextLesson.courseSlug}/${progress.nextLesson.slug}`}
              className="text-signal hover:underline"
            >
              {progress.nextLesson.title}
            </Link>{' '}
            <span className="text-ink-dim">in {progress.nextLesson.courseTitle}</span>
          </p>
        ) : null}

        <p className="mono mt-3 text-[10px] text-ink-dim">
          Reading is not counted as reputation. It is counted here, for you.
        </p>
      </div>
    </Panel>
  );
}
