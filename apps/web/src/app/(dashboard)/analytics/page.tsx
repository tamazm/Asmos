import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import type { CampaignEventType } from "@/generated/prisma/client";

type FunnelRow = {
  id: string;
  name: string;
  type: string;
  status: string;
  impressions: number;
  interactions: number;
  submissions: number;
  giftClaims: number;
  conversionRate: number;
};

export default async function AnalyticsPage() {
  const account = await getOrCreateAccount();

  const campaigns = await prisma.campaign.findMany({
    where: { accountId: account.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      variants: { select: { id: true } },
    },
  });

  const variantToCampaign = new Map<string, string>();
  for (const campaign of campaigns) {
    for (const variant of campaign.variants) {
      variantToCampaign.set(variant.id, campaign.id);
    }
  }

  const grouped = await prisma.campaignEvent.groupBy({
    by: ["variantId", "type"],
    where: { variant: { campaign: { accountId: account.id } } },
    _count: { _all: true },
  });

  const counts = new Map<string, number>();
  for (const row of grouped) {
    const campaignId = variantToCampaign.get(row.variantId);
    if (!campaignId) continue;
    const key = `${campaignId}:${row.type}`;
    counts.set(key, (counts.get(key) ?? 0) + row._count._all);
  }

  function countFor(campaignId: string, type: CampaignEventType) {
    return counts.get(`${campaignId}:${type}`) ?? 0;
  }

  const emailsCaptured = await prisma.lead.count({
    where: { variant: { campaign: { accountId: account.id } }, email: { not: null } },
  });

  const rows: FunnelRow[] = campaigns.map((campaign) => {
    const impressions = countFor(campaign.id, "IMPRESSION");
    const interactions = countFor(campaign.id, "INTERACTION");
    const submissions = countFor(campaign.id, "SUBMISSION");
    const giftClaims = countFor(campaign.id, "GIFT_CLAIMED");
    return {
      id: campaign.id,
      name: campaign.name,
      type: campaign.type,
      status: campaign.status,
      impressions,
      interactions,
      submissions,
      giftClaims,
      conversionRate: impressions > 0 ? (submissions / impressions) * 100 : 0,
    };
  });

  const totals = rows.reduce(
    (acc, row) => ({
      impressions: acc.impressions + row.impressions,
      interactions: acc.interactions + row.interactions,
      submissions: acc.submissions + row.submissions,
      giftClaims: acc.giftClaims + row.giftClaims,
    }),
    { impressions: 0, interactions: 0, submissions: 0, giftClaims: 0 },
  );
  const overallConversionRate =
    totals.impressions > 0 ? (totals.submissions / totals.impressions) * 100 : 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Analytics" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Impressions" value={totals.impressions.toLocaleString()} />
        <StatCard label="Interactions" value={totals.interactions.toLocaleString()} />
        <StatCard label="Submissions" value={totals.submissions.toLocaleString()} />
        <StatCard label="Gift Claims" value={totals.giftClaims.toLocaleString()} />
        <StatCard
          label="Conversion Rate"
          value={`${overallConversionRate.toFixed(1)}%`}
        />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium text-[color:var(--color-text-secondary)]">
          Campaign Funnel
        </h2>
        <DataTable<FunnelRow>
          rows={rows}
          emptyMessage="Funnel data will show up here once a campaign starts collecting impressions."
          columns={[
            { header: "Campaign", render: (row) => row.name },
            { header: "Type", render: (row) => row.type },
            {
              header: "Status",
              render: (row) => (
                <Badge variant={row.status === "ACTIVE" ? "success" : "neutral"}>
                  {row.status}
                </Badge>
              ),
            },
            { header: "Impressions", render: (row) => row.impressions.toLocaleString() },
            { header: "Interactions", render: (row) => row.interactions.toLocaleString() },
            { header: "Submissions", render: (row) => row.submissions.toLocaleString() },
            { header: "Gift Claims", render: (row) => row.giftClaims.toLocaleString() },
            {
              header: "Conv. Rate",
              render: (row) => `${row.conversionRate.toFixed(1)}%`,
            },
          ]}
        />
      </div>

      <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-8 text-center text-sm text-[color:var(--color-text-secondary)]">
        Emails captured: {emailsCaptured.toLocaleString()}. Site-wide behavioral
        analytics (page-level engagement, drop-off, navigation flow) lands
        once Phase 2 tracking infrastructure is built.
      </div>
    </div>
  );
}
