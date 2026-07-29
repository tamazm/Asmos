import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/StatCard";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";

type CampaignRow = {
  id: string;
  name: string;
  type: string;
  status: string;
  impressions: number;
  conversions: number;
  rate: string;
};

export default async function DashboardHomePage() {
  const account = await getOrCreateAccount();
  const campaigns = await prisma.campaign.findMany({
    where: { accountId: account.id },
    orderBy: { createdAt: "desc" },
    include: { variants: { include: { events: true } } },
  });

  const activeCount = campaigns.filter((c) => c.status === "ACTIVE").length;
  const allEvents = campaigns.flatMap((c) => c.variants.flatMap((v) => v.events));
  const impressions = allEvents.filter((e) => e.type === "IMPRESSION").length;
  const submissions = allEvents.filter((e) => e.type === "SUBMISSION").length;
  const emailsCaptured = await prisma.lead.count({
    where: {
      variant: { campaign: { accountId: account.id } },
      email: { not: null },
    },
  });
  const conversionRate =
    impressions > 0 ? ((submissions / impressions) * 100).toFixed(1) : "0.0";

  const rows: CampaignRow[] = campaigns.slice(0, 8).map((c) => {
    const events = c.variants.flatMap((v) => v.events);
    const imp = events.filter((e) => e.type === "IMPRESSION").length;
    const conv = events.filter((e) => e.type === "SUBMISSION").length;
    return {
      id: c.id,
      name: c.name,
      type: c.type ?? "Form",
      status: c.status,
      impressions: imp,
      conversions: conv,
      rate: imp > 0 ? `${((conv / imp) * 100).toFixed(1)}%` : "—",
    };
  });

  const STATS = [
    { label: "Active campaigns", value: activeCount.toString() },
    { label: "Impressions (total)", value: impressions.toLocaleString() },
    { label: "Emails captured", value: emailsCaptured.toLocaleString() },
    { label: "Conversion rate", value: `${conversionRate}%` },
  ];

  return (
    <div className="animate-page-enter space-y-6">
      {/* Page heading */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[color:var(--color-text-primary)]">
            Dashboard
          </h1>
          <p className="mt-0.5 text-sm text-[color:var(--color-text-secondary)]">
            Your campaigns, captures, and conversions at a glance.
          </p>
        </div>
        <Link
          href="/campaigns/new"
          className="rounded-lg bg-[color:var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[color:var(--color-primary-dark)] transition-colors duration-150 active:scale-[0.98]"
        >
          New campaign
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {STATS.map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </div>

      {/* Campaigns table */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[color:var(--color-text-primary)]">
            Recent campaigns
          </h2>
          <Link
            href="/campaigns"
            className="text-sm font-medium text-[color:var(--color-primary)] hover:underline"
          >
            View all
          </Link>
        </div>

        {rows.length > 0 ? (
          <div className="overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)]">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-[color:var(--color-text-secondary)]">
                    Campaign
                  </th>
                  <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-[color:var(--color-text-secondary)] sm:table-cell">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-[color:var(--color-text-secondary)]">
                    Status
                  </th>
                  <th className="hidden px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-[color:var(--color-text-secondary)] md:table-cell">
                    Impressions
                  </th>
                  <th className="hidden px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-[color:var(--color-text-secondary)] md:table-cell">
                    Conversions
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-[color:var(--color-text-secondary)]">
                    Rate
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--color-border)]">
                {rows.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-[color:var(--color-surface-sunken)] transition-colors duration-100"
                  >
                    <td className="px-4 py-3.5">
                      <Link
                        href={`/campaigns/${c.id}`}
                        className="font-medium text-[color:var(--color-text-primary)] hover:text-[color:var(--color-primary)] transition-colors duration-100"
                      >
                        {c.name}
                      </Link>
                    </td>
                    <td className="hidden px-4 py-3.5 text-[color:var(--color-text-secondary)] sm:table-cell">
                      {c.type}
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge
                        variant={c.status === "ACTIVE" ? "success" : "neutral"}
                      >
                        {c.status === "ACTIVE" ? "Live" : "Draft"}
                      </Badge>
                    </td>
                    <td className="hidden px-4 py-3.5 text-right tabular-nums text-[color:var(--color-text-secondary)] md:table-cell">
                      {c.impressions.toLocaleString()}
                    </td>
                    <td className="hidden px-4 py-3.5 text-right tabular-nums text-[color:var(--color-text-secondary)] md:table-cell">
                      {c.conversions.toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-[color:var(--color-text-primary)]">
                      {c.rate}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-surface)] py-16 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[color:var(--color-primary-light)]">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M12 4v16m-8-8h16"
                  stroke="var(--color-primary)"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <p className="mb-1 text-sm font-semibold text-[color:var(--color-text-primary)]">
              No campaigns yet
            </p>
            <p className="mb-5 text-sm text-[color:var(--color-text-secondary)]">
              Create your first popup campaign to get started.
            </p>
            <Link
              href="/campaigns/new"
              className="rounded-lg bg-[color:var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[color:var(--color-primary-dark)] transition-colors duration-150"
            >
              Create campaign
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
