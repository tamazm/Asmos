import { StatCard } from "@/components/ui/StatCard";
import Link from "next/link";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { RecentCampaignsBoard, type RecentCampaignRow } from "./RecentCampaignsBoard";
import { DashboardEmptyState } from "./DashboardEmptyState";

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

  const rows: RecentCampaignRow[] = campaigns.slice(0, 5).map((campaign) => {
    const events = campaign.variants.flatMap((v) => v.events);
    const variants = campaign.variants.map((variant) => {
      const variantImpressions = variant.events.filter((e) => e.type === "IMPRESSION").length;
      const variantSubmissions = variant.events.filter((e) => e.type === "SUBMISSION").length;
      return {
        id: variant.id,
        name: variant.name,
        isControl: variant.isControl,
        isWinner: campaign.winningVariantId === variant.id,
        trafficPercent: variant.trafficPercent,
        impressions: variantImpressions,
        submissions: variantSubmissions,
        conversionRate: variantImpressions > 0 ? (variantSubmissions / variantImpressions) * 100 : 0,
      };
    });
    return {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      impressions: events.filter((e) => e.type === "IMPRESSION").length,
      conversions: events.filter((e) => e.type === "SUBMISSION").length,
      variants,
    };
  });

  const STATS = [
    { label: "Active campaigns", value: activeCount.toString() },
    { label: "Impressions (total)", value: impressions.toLocaleString() },
    { label: "Emails captured", value: emailsCaptured.toLocaleString() },
    { label: "Conversion rate", value: `${conversionRate}%` },
  ];

  return (
    <div className="animate-page-enter space-y-7">
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
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 reveal-stagger is-visible">
        {STATS.map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </div>

      {campaigns.length === 0 ? (
        /* ── Welcome empty state ── */
        <DashboardEmptyState />
      ) : (
        <RecentCampaignsBoard rows={rows} />
      )}
    </div>
  );
}
