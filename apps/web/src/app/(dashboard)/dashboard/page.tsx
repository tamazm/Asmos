import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { RecentCampaignsBoard, type RecentCampaignRow } from "./RecentCampaignsBoard";

export default async function DashboardHomePage() {
  const account = await getOrCreateAccount();
  const campaigns = await prisma.campaign.findMany({
    where: { accountId: account.id },
    orderBy: { createdAt: "desc" },
    include: { variants: { include: { events: true } } },
  });

  const activeCount = campaigns.filter((c) => c.status === "ACTIVE").length;
  const campaignEvents = campaigns.map((c) => c.variants.flatMap((v) => v.events));
  const impressions = campaignEvents.reduce(
    (sum, events) => sum + events.filter((e) => e.type === "IMPRESSION").length,
    0,
  );
  const submissions = campaignEvents.reduce(
    (sum, events) => sum + events.filter((e) => e.type === "SUBMISSION").length,
    0,
  );
  const emailsCaptured = await prisma.lead.count({
    where: { variant: { campaign: { accountId: account.id } }, email: { not: null } },
  });
  const conversionRate = impressions > 0 ? (submissions / impressions) * 100 : 0;

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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Dashboard" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active Campaigns" value={activeCount.toLocaleString()} />
        <StatCard label="Impressions" value={impressions.toLocaleString()} />
        <StatCard label="Emails Captured" value={emailsCaptured.toLocaleString()} />
        <StatCard label="Conversion Rate" value={`${conversionRate.toFixed(1)}%`} />
      </div>

      <RecentCampaignsBoard rows={rows} />
    </div>
  );
}
