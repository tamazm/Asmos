/* eslint-disable @typescript-eslint/no-explicit-any */
import { notFound } from "next/navigation";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { InsightsPanel, type InsightRow } from "../InsightsPanel";

export default async function CampaignInsightsPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const account = await getOrCreateAccount();

  const campaign = await prisma.campaign.findFirst({
    where: { id, accountId: account.id },
    include: {
      variants: {
        include: { events: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!campaign) notFound();

  const insights = await prisma.campaignInsight.findMany({
    where: { campaignId: campaign.id },
    orderBy: { createdAt: "desc" },
  });

  const insightRows: InsightRow[] = insights.map((insight: any) => ({
    id: insight.id,
    summary: insight.summary,
    suggestedVariant: insight.suggestedVariant as InsightRow["suggestedVariant"],
    createdAt: insight.createdAt.toISOString(),
  }));

  // Compute compact campaign stats
  const totalImpressions = campaign.variants.reduce(
    (sum: number, v: any) => sum + v.events.filter((e: any) => e.type === "IMPRESSION").length,
    0,
  );
  const totalSubmissions = campaign.variants.reduce(
    (sum: number, v: any) => sum + v.events.filter((e: any) => e.type === "SUBMISSION").length,
    0,
  );
  const overallCvr =
    totalImpressions > 0 ? ((totalSubmissions / totalImpressions) * 100).toFixed(1) : "0.0";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="AI Insights"
        backHref={`/campaigns/${id}`}
        backLabel="Back to campaign"
      />

      {/* Campaign context bar -- compact, not a stat grid */}
      <div
        className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-5 py-3"
        aria-label="Campaign summary"
      >
        <span className="text-sm font-semibold text-[color:var(--color-text-primary)]">
          {campaign.name}
        </span>
        <CampaignStat label="Variants" value={campaign.variants.length.toString()} />
        <CampaignStat label="Impressions" value={totalImpressions.toLocaleString()} />
        <CampaignStat label="Submissions" value={totalSubmissions.toLocaleString()} />
        <CampaignStat label="Conversion rate" value={`${overallCvr}%`} />
      </div>

      {/* Section intro */}
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-[color:var(--color-text-primary)]">
          What Asmos has learned
        </h2>
        <p className="text-sm text-[color:var(--color-text-secondary)]">
          Plain-English explanations of why variants are winning or losing, plus occasional
          suggestions for new variants to test. The bandit already reallocates traffic live.
          These reports explain the pattern.
        </p>
      </div>

      {/* Insights panel -- full page version */}
      <InsightsPanel campaignId={id} insights={insightRows} />
    </div>
  );
}

function CampaignStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-xs text-[color:var(--color-text-secondary)]">{label}</span>
      <span className="text-sm font-semibold tabular-nums text-[color:var(--color-text-primary)]">
        {value}
      </span>
    </div>
  );
}
