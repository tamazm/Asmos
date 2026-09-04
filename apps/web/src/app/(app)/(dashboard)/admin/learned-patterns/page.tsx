import { currentUser } from "@/lib/auth-adapter";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { isSuperadminEmail } from "@/lib/superadmin";
import Link from "next/link";
import { approveLearnedPattern, rejectLearnedPattern } from "./actions";

// AI popup variation roadmap, Phase 4 - review surface for patterns mined
// across all accounts (lib/inngest/mineCrossAccountPatterns.ts, runs weekly).
// Deliberately human-gated: nothing here reaches the live system prompt
// until a superadmin approves it (see popupGeneration.ts's
// getLearnedPatternsSection). Rejecting is just as important as approving -
// a false-positive pattern promoted to every customer's popups at once is
// the failure mode this page exists to prevent.
export default async function LearnedPatternsPage() {
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!isSuperadminEmail(email)) {
    redirect("/campaigns");
  }

  const [pending, reviewed] = await Promise.all([
    prisma.learnedPattern.findMany({
      where: { status: "DRAFT" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.learnedPattern.findMany({
      where: { status: { in: ["APPROVED", "REJECTED"] } },
      orderBy: { reviewedAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <div className="flex flex-col gap-8 p-6 lg:p-10 max-w-[1400px] mx-auto w-full">
      <div>
        <div className="flex items-center gap-3 mb-2 text-sm text-[color:var(--color-text-secondary)]">
          <Link href="/admin" className="hover:text-[color:var(--color-text-primary)]">Admin</Link>
          <span>/</span>
          <span className="text-[color:var(--color-text-primary)] font-medium">Learned Patterns</span>
        </div>
        <PageHeader title="Learned Patterns" />
        <p className="mt-2 text-sm text-[color:var(--color-text-secondary)] max-w-2xl">
          Candidates mined weekly across every account&apos;s campaign performance - patterns that conclusively
          won in at least 5 independent campaigns within the same category. Approving a pattern adds it to the
          system prompt used for every future AI generation; rejecting discards it. Nothing here affects live
          generation until you act on it.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-[color:var(--color-text-primary)]">
          Pending review ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-8 text-center text-sm text-[color:var(--color-text-secondary)]">
            No candidates waiting for review. The mining job runs weekly and needs at least 5 independent
            campaigns showing the same conclusive pattern before it proposes anything here.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {pending.map((p) => (
              <div
                key={p.id}
                className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 flex flex-col gap-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="neutral">{p.category}</Badge>
                  <Badge variant="neutral">axis: {p.testAxis}</Badge>
                  <Badge variant="warning">{p.failurePattern}</Badge>
                  <span className="text-xs text-[color:var(--color-text-secondary)]">
                    {p.sampleSize} independent campaigns · mined {p.createdAt.toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-[color:var(--color-text-primary)]">{p.description}</p>
                <div className="flex items-center gap-2">
                  <form action={approveLearnedPattern.bind(null, p.id)}>
                    <Button type="submit">Approve</Button>
                  </form>
                  <form action={rejectLearnedPattern.bind(null, p.id)}>
                    <button
                      type="submit"
                      className="rounded-lg border border-[color:var(--color-border)] px-4 py-2 text-sm font-medium text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-sunken)] transition-colors"
                    >
                      Reject
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-[color:var(--color-text-primary)]">Review history</h2>
        <div className="overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] text-[color:var(--color-text-secondary)]">
                  <th className="px-4 py-3 font-medium whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 font-medium">Pattern</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">Reviewed by</th>
                  <th className="px-4 py-3 font-medium whitespace-nowrap">Reviewed at</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--color-border)]">
                {reviewed.map((p) => (
                  <tr key={p.id} className="align-top">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge variant={p.status === "APPROVED" ? "success" : "neutral"}>{p.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-[color:var(--color-text-primary)]">
                      {p.category} / {p.testAxis} / {p.failurePattern}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-[color:var(--color-text-secondary)]">
                      {p.reviewedBy ?? "-"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-[color:var(--color-text-secondary)]">
                      {p.reviewedAt ? p.reviewedAt.toLocaleString() : "-"}
                    </td>
                  </tr>
                ))}
                {reviewed.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-[color:var(--color-text-secondary)]">
                      No reviewed patterns yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
