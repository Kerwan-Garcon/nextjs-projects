'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, cn } from '@saveus/ui';
import type { LessonQuestion, SessionUser } from '@/lib/types';

/**
 * The comprehension check.
 *
 * It is not a test. There is no pass mark, a wrong answer costs nothing, and
 * the explanation is shown either way - the explanation is the point. Nothing
 * here touches reputation, which is reserved for research contributions; a
 * platform that paid standing for finishing a quiz would get quiz-finishers.
 *
 * Answers are checked in the browser so the explanation appears the moment the
 * option is clicked. There is nothing to game by reading the answer first.
 */
export function LessonCheck({
  courseSlug,
  lessonSlug,
  questions,
  user,
  completedAt,
  savedAnswers,
  next,
}: {
  courseSlug: string;
  lessonSlug: string;
  questions: LessonQuestion[];
  user: SessionUser | null;
  completedAt: string | null;
  savedAnswers: number[];
  next: { slug: string; title: string } | null;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<number[]>(() =>
    questions.map((_, index) => savedAnswers[index] ?? -1),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(completedAt !== null);

  const answered = answers.filter((answer) => answer >= 0).length;
  const allAnswered = questions.length > 0 && answered === questions.length;

  function choose(questionIndex: number, optionIndex: number) {
    // An answer stands once given: changing it after seeing the explanation
    // would only be a way of lying to yourself.
    if ((answers[questionIndex] ?? -1) >= 0) return;
    setAnswers((current) =>
      current.map((value, index) => (index === questionIndex ? optionIndex : value)),
    );
  }

  async function markDone() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/courses/${encodeURIComponent(courseSlug)}/lessons/${encodeURIComponent(lessonSlug)}/complete`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ answers }),
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error?.message ?? 'Could not save that.');
        return;
      }
      setDone(true);
      router.refresh();
    } catch {
      setError('Network error. Your progress was not saved.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-5">
      {questions.map((question, questionIndex) => {
        const chosen = answers[questionIndex] ?? -1;
        const revealed = chosen >= 0;

        return (
          <div key={question.id} className="border border-line bg-panel">
            <p className="border-b border-line px-4 py-3 text-[13.5px] leading-relaxed text-ink">
              {question.prompt}
            </p>
            <ul className="divide-y divide-line">
              {question.options.map((option, optionIndex) => {
                const isCorrect = optionIndex === question.correctIndex;
                const isChosen = optionIndex === chosen;
                return (
                  <li key={optionIndex}>
                    <button
                      type="button"
                      disabled={revealed}
                      onClick={() => choose(questionIndex, optionIndex)}
                      className={cn(
                        'flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors duration-150',
                        !revealed && 'hover:bg-panel-raised',
                        revealed && isCorrect && 'bg-ok/10',
                        revealed && isChosen && !isCorrect && 'bg-alert/10',
                        revealed && !isChosen && !isCorrect && 'opacity-50',
                      )}
                    >
                      <span
                        className="mono mt-[2px] shrink-0 text-[11px]"
                        style={{
                          color: revealed
                            ? isCorrect
                              ? 'var(--color-ok)'
                              : isChosen
                                ? 'var(--color-alert)'
                                : 'var(--color-ink-dim)'
                            : 'var(--color-ink-dim)',
                        }}
                      >
                        {revealed ? (isCorrect ? '✓' : isChosen ? '✕' : '·') : '○'}
                      </span>
                      <span className="text-[13px] leading-relaxed text-ink-muted">{option}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {revealed ? (
              <p className="border-t border-line bg-panel-raised px-4 py-3 text-[12.5px] leading-relaxed text-ink-muted">
                <span className="mono text-[10px] uppercase tracking-[0.1em] text-ink-dim">
                  Why ·{' '}
                </span>
                {question.explanation}
              </p>
            ) : null}
          </div>
        );
      })}

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        {done ? (
          <span className="mono text-[11px] uppercase tracking-[0.1em] text-ok">
            ✓ Marked as read
          </span>
        ) : user ? (
          <Button
            type="button"
            variant="primary"
            onClick={markDone}
            disabled={pending || !allAnswered}
            title={allAnswered ? undefined : 'Answer the questions above first.'}
          >
            {pending ? 'Saving…' : 'Mark as read'}
          </Button>
        ) : (
          <span className="text-[12.5px] text-ink-dim">
            <Link href="/sign-in" className="text-signal hover:underline">
              Sign in
            </Link>{' '}
            to keep track of what you have read. The lessons themselves need no account.
          </span>
        )}

        {next ? (
          <Link
            href={`/learn/${courseSlug}/${next.slug}`}
            className="mono ml-auto border border-line-strong px-3 py-1.5 text-[10px] uppercase tracking-[0.1em] text-ink-muted hover:border-signal/50 hover:text-signal"
          >
            Next · {next.title} →
          </Link>
        ) : null}
      </div>

      {error ? <p className="text-[12px] text-alert">{error}</p> : null}

      <p className="mono text-[10px] leading-relaxed text-ink-dim">
        No score is recorded and no reputation is awarded. Reputation on this platform comes from
        research contributions that other people can check.
      </p>
    </div>
  );
}
