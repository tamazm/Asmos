import { currentUser } from "@/lib/auth-adapter";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { AccountsTable } from "@/components/admin/AccountsTable";
import { isSuperadminEmail } from "@/lib/superadmin";
import { AI_GENERATION_LIMITS } from "@/lib/limits";
import Link from "next/link";

// Accounts closest to burning through their tier's lifetime AI-generation
// budget (see lib/limits.ts) — surfaced here so an account hitting the wall
// shows up before they email support about generation suddenly refusing to
// run, rather than only being discoverable one account-detail page at a time.
const QUOTA_WATCH_THRESHOLD = 0.7;

export default async function AdminDashboardPage() {
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;

  // Strictly enforce superadmin on backend page load
  if (!isSuperadminEmail(email)) {
    redirect("/dashboard");
  }

  // Fetch Global Platform Economics
  const [
    totalAccounts,
    totalCampaigns,
    totalAIGenerations,
    impressionsAgg,
    submissionsAgg,
  ] = await Promise.all([
    prisma.account.count(),
    prisma.campaign.count(),
    prisma.account.aggregate({ _sum: { aiGenerationsCount: true } }),
    prisma.campaignEvent.count({ where: { type: "IMPRESSION" } }),
    prisma.campaignEvent.count({ where: { type: "SUBMISSION" } }),
  ]);

  // Fetch all accounts for table
  const accounts = await prisma.account.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      industry: true,
      planTier: true,
      aiGenerationsCount: true,
      createdAt: true,
    }
  });

  const totalGens = totalAIGenerations._sum.aiGenerationsCount ?? 0;

  const quotaWatchList = accounts
    .map((a) => {
      const limit = AI_GENERATION_LIMITS[a.planTier];
      return { ...a, limit, usagePercent: limit > 0 ? a.aiGenerationsCount / limit : 0 };
    })
    .filter((a) => a.usagePercent >= QUOTA_WATCH_THRESHOLD)
    .sort((a, b) => b.usagePercent - a.usagePercent)
    .slice(0, 10);

  return (
    <div className="flex flex-col gap-8 p-6 lg:p-10 max-w-[1400px] mx-auto w-full">
      <PageHeader
        title="Superadmin Dashboard"
        actions={
          <div className="flex items-center gap-2">
            <Link href="/admin/learned-patterns" className="rounded-lg bg-[color:var(--color-primary-light)] px-4 py-2 text-sm font-semibold text-[color:var(--color-primary)] hover:opacity-90 transition-opacity">
              Learned Patterns →
            </Link>
            <Link href="/admin/scraped-popups" className="rounded-lg bg-[color:var(--color-primary-light)] px-4 py-2 text-sm font-semibold text-[color:var(--color-primary)] hover:opacity-90 transition-opacity">
              Scraped Popups →
            </Link>
            <Link href="/admin/logs" className="rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 transition-colors">
              View Error Logs →
            </Link>
          </div>
        }
      />

      {/* Global Economics */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-[color:var(--color-text)]">Global Platform Economics</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          
          <div className="flex flex-col rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
            <span className="text-sm font-medium text-[color:var(--color-text-secondary)]">Total Accounts</span>
            <span className="mt-2 text-3xl font-bold text-[color:var(--color-text)]">{totalAccounts.toLocaleString()}</span>
          </div>

          <div className="flex flex-col rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
            <span className="text-sm font-medium text-[color:var(--color-text-secondary)]">Total Campaigns</span>
            <span className="mt-2 text-3xl font-bold text-[color:var(--color-text)]">{totalCampaigns.toLocaleString()}</span>
          </div>

          <div className="flex flex-col rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
            <span className="text-sm font-medium text-[color:var(--color-text-secondary)]">Total AI Generations</span>
            <span className="mt-2 text-3xl font-bold text-[color:var(--color-text)]">{totalGens.toLocaleString()}</span>
          </div>

          <div className="flex flex-col rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
            <span className="text-sm font-medium text-[color:var(--color-text-secondary)]">Total Impressions</span>
            <span className="mt-2 text-3xl font-bold text-[color:var(--color-text)]">{impressionsAgg.toLocaleString()}</span>
          </div>

          <div className="flex flex-col rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
            <span className="text-sm font-medium text-[color:var(--color-text-secondary)]">Total Submissions</span>
            <span className="mt-2 text-3xl font-bold text-[color:var(--color-text)]">{submissionsAgg.toLocaleString()}</span>
          </div>

        </div>
      </section>

      {/* AI Generation Quota Watch */}
      {quotaWatchList.length > 0 && (
        <section>
          <h2 className="mb-1 text-lg font-semibold text-[color:var(--color-text)]">AI Generation Quota Watch</h2>
          <p className="mb-4 text-sm text-[color:var(--color-text-secondary)]">
            Accounts at {Math.round(QUOTA_WATCH_THRESHOLD * 100)}%+ of their tier&apos;s lifetime AI-generation limit.
          </p>
          <div className="overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)]">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-[color:var(--color-text-secondary)]">Account</th>
                    <th className="px-4 py-3 font-semibold text-[color:var(--color-text-secondary)]">Plan</th>
                    <th className="px-4 py-3 font-semibold text-[color:var(--color-text-secondary)]">Usage</th>
                    <th className="px-4 py-3 font-semibold text-[color:var(--color-text-secondary)]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--color-border)]">
                  {quotaWatchList.map((a) => {
                    const pct = Math.min(100, Math.round(a.usagePercent * 100));
                    const isCritical = a.usagePercent >= 0.9;
                    return (
                      <tr key={a.id} className="hover:bg-[color:var(--color-surface-sunken)]/50 transition-colors">
                        <td className="px-4 py-3">
                          <Link href={`/admin/accounts/${a.id}`} className="font-medium text-[color:var(--color-primary)] hover:underline">
                            {a.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-[color:var(--color-text-secondary)]">{a.planTier}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[color:var(--color-surface-sunken)]">
                              <div
                                className={`h-full rounded-full ${isCritical ? "bg-red-500" : "bg-amber-500"}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className={`text-xs font-medium ${isCritical ? "text-red-600" : "text-amber-600"}`}>
                              {a.aiGenerationsCount} / {a.limit}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isCritical && (
                            <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">
                              Critical
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Accounts Management */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[color:var(--color-text)]">Accounts Management</h2>
        </div>
        <AccountsTable accounts={accounts} />
      </section>

    </div>
  );
}
