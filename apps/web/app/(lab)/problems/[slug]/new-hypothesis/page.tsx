import Link from 'next/link';
import { HypothesisForm } from '@/components/hypothesis-form';
import { apiGet, apiGetOr404 } from '@/lib/server-api';
import type { ProblemDetail, SessionUser } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function NewHypothesisPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [{ problem }, session] = await Promise.all([
    apiGetOr404<{ problem: ProblemDetail }>(`/api/problems/${encodeURIComponent(slug)}`),
    apiGet<{ user: SessionUser | null }>('/api/me'),
  ]);

  return (
    <div className="enter mx-auto max-w-3xl">
      <Link
        href={`/problems/${problem.slug}`}
        className="mono text-[10px] uppercase tracking-[0.12em] text-ink-dim hover:text-signal"
      >
        ← #{problem.ref} {problem.title}
      </Link>

      <h1 className="mt-5 text-[22px] font-semibold tracking-[-0.01em]">Propose a hypothesis</h1>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
        A hypothesis here is a structured object, not a post. State the claim precisely enough that
        someone could show it is wrong, say what you are assuming, and admit what you do not know —
        the unknowns field is the one that earns trust.
      </p>

      <div className="mt-4 border border-line bg-panel px-4 py-3">
        <p className="label mb-2">Open questions on this problem</p>
        <ul className="space-y-1">
          {problem.openQuestions.map((question, index) => (
            <li key={index} className="text-[12px] leading-relaxed text-ink-dim">
              — {question}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6">
        <HypothesisForm problemId={problem.id} problemSlug={problem.slug} user={session.user} />
      </div>
    </div>
  );
}
