import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { confidenceVsControl } from "@/lib/stats";
import { VariantManager, type VariantStat } from "./VariantManager";
import { InsightsPanel, type InsightRow } from "./InsightsPanel";
import { AnalyticsTab } from "./AnalyticsTab";
import { KnockoutBracketWithVariants } from "./KnockoutBracketWithVariants";
import { PerformanceTable } from "./PerformanceTable";
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const insightRows: InsightRow[] = insights.map((insight: any) => ({
    id: insight.id,
    summary: insight.summary,
    suggestedVariant: insight.suggestedVariant as InsightRow["suggestedVariant"],
    createdAt: insight.createdAt.toISOString(),
  }));

  if (campaign.status === "GENERATING") {
    return (
      <div className="flex flex-col gap-6 p-6 lg:p-10 max-w-[1400px] mx-auto w-full">
        <PageHeader 
          title={campaign.name} 
        />
        <p className="text-sm text-[color:var(--color-text-secondary)] mt-[-1rem]">Campaign generation in progress</p>
        <div className="flex flex-col items-center justify-center gap-6 py-20">
          <div className="relative flex h-24 w-24 items-center justify-center">
            <span className="absolute inline-block h-24 w-24 rounded-full border border-[color:var(--color-primary)] opacity-20 animate-ping" />
            <span className="absolute inline-block h-16 w-16 rounded-full border border-[color:var(--color-primary)]/40" />
            <span className="inline-block h-6 w-6 rounded-full border-2 border-[color:var(--color-primary)] border-t-transparent animate-spin" />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-semibold text-[color:var(--color-text-primary)]">AI is designing your variants</h3>
            <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
              This usually takes about 30 seconds. Feel free to wait or check back later.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (campaign.status === "FAILED") {
    return (
      <div className="flex flex-col gap-6 p-6 lg:p-10 max-w-[1400px] mx-auto w-full">
        <PageHeader title={campaign.name} />
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 flex flex-col items-center justify-center gap-4 text-center">
          <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center text-red-600">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-red-900">Campaign Generation Failed</h3>
            <p className="mt-1 text-sm text-red-700 max-w-lg">
              We encountered an issue while generating your AI variants. 
              {campaign.lastError && <span className="block mt-2 font-mono text-xs opacity-80">Error ID: {campaign.lastError}</span>}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const control = campaign.variants.find((v: any) => v.isControl) ?? campaign.variants[0];
  const controlSample = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    impressions: control.events.filter((e: any) => e.type === "IMPRESSION").length,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    conversions: control.events.filter((e: any) => e.type === "SUBMISSION").length,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const variantStats: VariantStat[] = campaign.variants.map((variant: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const impressions = variant.events.filter((e: any) => e.type === "IMPRESSION").length;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const submissions = variant.events.filter((e: any) => e.type === "SUBMISSION").length;
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
      status: variant.status,
      tournamentRound: variant.tournamentRound,
      // Popup generation metadata
      testAxis: variant.testAxis ?? null,
      hypothesis: variant.hypothesis ?? null,
      motivatingMetric: variant.motivatingMetric ?? null,
      isAutoGenerated: Boolean(variant.hypothesis && !variant.isControl),
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
          {
            key: "knockout-bracket",
            label: "Knockout Bracket",
            content: (
              <div className="flex flex-col gap-12">
                <div>
                  <h3 className="mb-4 text-lg font-semibold text-[color:var(--color-text-primary)]">
                    Current Round (Round {campaign.tournamentRound})
                  </h3>
                  <KnockoutBracketWithVariants
                    campaignId={campaign.id}
                    initialVariants={variantStats.filter(v => v.tournamentRound === campaign.tournamentRound)}
                  />
                </div>
                
                {campaign.tournamentRound > 1 && (
                  <div className="flex flex-col gap-8 border-t border-[color:var(--color-border)] pt-8">
                    <h3 className="text-lg font-semibold text-[color:var(--color-text-primary)]">
                      Past Rounds History
                    </h3>
                    {Array.from({ length: campaign.tournamentRound - 1 }).map((_, i) => {
                      const roundNum = campaign.tournamentRound - 1 - i;
                      const roundHistory = variantStats.filter(v => v.tournamentRound === roundNum);
                      if (roundHistory.length === 0) return null;
                      return (
                        <div key={roundNum} className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 opacity-75">
                          <h4 className="mb-4 text-sm font-medium text-[color:var(--color-text-secondary)]">Round {roundNum}</h4>
                          <KnockoutBracketWithVariants
                            campaignId={campaign.id}
                            initialVariants={roundHistory}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ),
          },
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
          {
            key: "performance",
            label: "Performance",
            content: <PerformanceTable variants={variantStats} />,
          },
          {
            key: "insights",
            label: "Insights",
            content: (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-[color:var(--color-text-secondary)]">
                    Recent insights. For the full history and deeper analysis, open the dedicated
                    insights page.
                  </p>
                  <Link
                    href={`/campaigns/${campaign.id}/insights`}
                    className="inline-flex items-center justify-center rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2 text-sm font-medium text-[color:var(--color-text-primary)] transition-colors duration-150 hover:bg-[color:var(--color-surface-sunken)] active:scale-[0.98] shrink-0"
                  >
                    View all insights
                  </Link>
                </div>
                <InsightsPanel campaignId={campaign.id} insights={insightRows} />
              </div>
            ),
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
                    <Badge variant={campaign.status === "ACTIVE" ? "success" : campaign.status === "PAUSED" ? "warning" : "neutral"}>
                      {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1).toLowerCase()}
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
