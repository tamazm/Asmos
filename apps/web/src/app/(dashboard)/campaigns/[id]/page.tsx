import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { confidenceVsControl } from "@/lib/stats";
import { VariantManager, type VariantStat } from "./VariantManager";
import { InsightsPanel, type InsightRow } from "./InsightsPanel";
import { AnalyticsTab } from "./AnalyticsTab";
// Dummy-data tabs, disabled until real bandit/performance data backs them —
// see mockBracketData.ts.
// import { KnockoutBracket } from "./KnockoutBracket";
// import { PerformanceTable } from "./PerformanceTable";
import { CampaignTabs } from "./CampaignTabs";
import { CampaignRowActions } from "../CampaignRowActions";

export default async function CampaignDetailPage(props: PageProps<"/campaigns/[id]">) {
  const { id } = await props.params;
  const account = await getOrCreateAccount();

  const campaign = await prisma.campaign.findFirst({
    where: { id, accountId: account.id },
    include: {
      variants: {
        include: { events: true, _count: { select: { leads: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!campaign) notFound();

  const insights = await prisma.campaignInsight.findMany({
    where: { campaignId: campaign.id },
    orderBy: { createdAt: "desc" },
  });
  const insightRows: InsightRow[] = insights.map((insight) => ({
    id: insight.id,
    summary: insight.summary,
    suggestedVariant: insight.suggestedVariant as InsightRow["suggestedVariant"],
    createdAt: insight.createdAt.toISOString(),
  }));

  const control = campaign.variants.find((v) => v.isControl) ?? campaign.variants[0];
  const controlSample = {
    impressions: control.events.filter((e) => e.type === "IMPRESSION").length,
    conversions: control.events.filter((e) => e.type === "SUBMISSION").length,
  };

  const variantStats: VariantStat[] = campaign.variants.map((variant) => {
    const impressions = variant.events.filter((e) => e.type === "IMPRESSION").length;
    const submissions = variant.events.filter((e) => e.type === "SUBMISSION").length;
    const design = (variant.design ?? {}) as {
      headline?: string;
      body?: string;
      primaryColor?: string;
      ctaText?: string;
    };

    return {
      id: variant.id,
      name: variant.name,
      isControl: variant.isControl,
      isWinner: campaign.winningVariantId === variant.id,
      trafficPercent: variant.trafficPercent,
      impressions,
      submissions,
      conversionRate: impressions > 0 ? (submissions / impressions) * 100 : 0,
      confidenceVsControl: variant.isControl
        ? null
        : confidenceVsControl(controlSample, { impressions, conversions: submissions }),
      headline: design.headline ?? "",
      body: design.body ?? "",
      primaryColor: design.primaryColor ?? "#165DFF",
      ctaText: design.ctaText ?? "",
    };
  });

  const totals = variantStats.reduce(
    (acc, v) => ({
      impressions: acc.impressions + v.impressions,
      submissions: acc.submissions + v.submissions,
    }),
    { impressions: 0, submissions: 0 },
  );
  const overallConversionRate =
    totals.impressions > 0 ? (totals.submissions / totals.impressions) * 100 : 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={campaign.name}
        backHref="/campaigns"
        backLabel="Back to Pop-ups"
        status={campaign.status}
      />

      <CampaignTabs
        tabs={[
          {
            key: "overview",
            label: "Overview",
            content: (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Variants" value={variantStats.length.toLocaleString()} />
                <StatCard label="Impressions" value={totals.impressions.toLocaleString()} />
                <StatCard label="Submissions" value={totals.submissions.toLocaleString()} />
                <StatCard
                  label="Conversion Rate"
                  value={`${overallConversionRate.toFixed(1)}%`}
                />
              </div>
            ),
          },
          // Disabled — dummy data only, see mockBracketData.ts.
          // {
          //   key: "knockout-bracket",
          //   label: "Knockout Bracket",
          //   content: <KnockoutBracket />,
          // },
          {
            key: "analytics",
            label: "Analytics",
            content: <AnalyticsTab variants={variantStats} />,
          },
          {
            key: "variants",
            label: "Variants",
            content: (
              <VariantManager
                campaignId={campaign.id}
                hasWinner={Boolean(campaign.winningVariantId)}
                variants={variantStats}
              />
            ),
          },
          // Disabled — dummy data only, see mockBracketData.ts.
          // {
          //   key: "performance",
          //   label: "Performance",
          //   content: <PerformanceTable />,
          // },
          {
            key: "insights",
            label: "Insights",
            content: <InsightsPanel campaignId={campaign.id} insights={insightRows} />,
          },
          {
            key: "settings",
            label: "Settings",
            content: (
              <div className="flex flex-col gap-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[color:var(--color-text-primary)]">
                      Campaign status
                    </p>
                    <p className="text-sm text-[color:var(--color-text-secondary)]">
                      Pausing stops the widget from serving this campaign&apos;s variants.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={campaign.status === "ACTIVE" ? "success" : "neutral"}>
                      {campaign.status}
                    </Badge>
                    <CampaignRowActions campaignId={campaign.id} status={campaign.status} />
                  </div>
                </div>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
