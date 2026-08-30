/* eslint-disable @typescript-eslint/no-explicit-any */
import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { ConfidenceBar } from "@/components/ui/ConfidenceBar";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { confidenceVsControl } from "@/lib/stats";
import { VariantDetailActions } from "./VariantDetailActions";
import { PopupPreviewCard } from "./PopupPreviewCard";
import { VisualEditor } from "./VisualEditor";
import { StitchDesignPanel } from "./StitchDesignPanel";

export default async function VariantDetailPage(props: {
  params: Promise<{ id: string; variantId: string }>;
}) {
  const { id: campaignId, variantId } = await props.params;
  const account = await getOrCreateAccount();

  // Fetch the campaign (with all variants + events) to compute stats
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, accountId: account.id },
    include: {
      variants: {
        include: {
          events: true,
          _count: { select: { leads: true } },
          stitchDesigns: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              id: true,
              prompt: true,
              deviceType: true,
              status: true,
              lastError: true,
              createdAt: true,
              htmlContent: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!campaign) notFound();

  const variant = campaign.variants.find((v: any) => v.id === variantId);
  if (!variant) notFound();

  // Compute stats for this variant
  const impressions = variant.events.filter((e: any) => e.type === "IMPRESSION").length;
  const submissions = variant.events.filter((e: any) => e.type === "SUBMISSION").length;
  const conversionRate = impressions > 0 ? (submissions / impressions) * 100 : 0;
  const leadsCount = variant._count.leads;
  const isWinner = campaign.winningVariantId === variant.id;

  // Confidence vs control
  const control = campaign.variants.find((v: any) => v.isControl) ?? campaign.variants[0];
  const controlSample = {
    impressions: control.events.filter((e: any) => e.type === "IMPRESSION").length,
    conversions: control.events.filter((e: any) => e.type === "SUBMISSION").length,
  };
  const confidence = variant.isControl
    ? null
    : confidenceVsControl(controlSample, { impressions, conversions: submissions });

  // Build stats for all variants (for comparison chart)
  const allVariantStats = campaign.variants.map((v: any) => {
    const vi = v.events.filter((e: any) => e.type === "IMPRESSION").length;
    const vs = v.events.filter((e: any) => e.type === "SUBMISSION").length;
    return {
      id: v.id,
      name: v.name,
      isControl: v.isControl,
      isWinner: campaign.winningVariantId === v.id,
      trafficPercent: v.trafficPercent,
      conversionRate: vi > 0 ? (vs / vi) * 100 : 0,
      impressions: vi,
      submissions: vs,
    };
  });

  const maxRate = Math.max(...allVariantStats.map((v: any) => v.conversionRate), 0.0001);

  // Design fields
  const design = (variant.design ?? {}) as {
    headline?: string;
    body?: string;
    ctaText?: string;
    primaryColor?: string;
    imageUrl?: string;
  };

  const statusLabel = isWinner ? "Winner" : variant.isControl ? "Control" : "Variant";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={variant.name}
        backHref={`/campaigns/${campaignId}`}
        backLabel="Back to campaign"
        status={statusLabel}
        actions={
          <VariantDetailActions
            campaignId={campaignId}
            variantId={variantId}
            isControl={variant.isControl}
            isWinner={isWinner}
            hasWinner={Boolean(campaign.winningVariantId)}
            currentDesign={design}
            currentName={variant.name}
            conversionRate={conversionRate}
          />
        }
      />

      {/* Stat grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Impressions" value={impressions.toLocaleString()} />
        <StatCard
          label="Conversion Rate"
          value={`${conversionRate.toFixed(1)}%`}
        />
        <StatCard
          label="Traffic Allocation"
          value={`${variant.trafficPercent.toFixed(1)}%`}
        />
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 shadow-sm">
          <p className="text-xs font-medium text-[color:var(--color-text-secondary)]">
            Confidence vs Control
          </p>
          <div className="mt-2">
            {variant.isControl ? (
              <p className="text-sm text-[color:var(--color-text-secondary)]">
                This is the control
              </p>
            ) : confidence === null ? (
              <p className="text-sm text-[color:var(--color-text-secondary)]">
                Not enough data yet
              </p>
            ) : (
              <>
                <p className="mb-1.5 text-2xl font-bold tabular-nums text-[color:var(--color-text-primary)]">
                  {confidence.toFixed(0)}%
                </p>
                <ConfidenceBar percent={confidence} />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Variant Design Editor */}
      <VisualEditor 
        campaignId={campaignId}
        variantId={variantId}
        defaultColor="#111827"
        initialDesign={design}
      />

      {/* AI Design Preview (Google Stitch) - reference only, does not affect the live popup */}
      <StitchDesignPanel
        campaignId={campaignId}
        variantId={variantId}
        initialDesign={variant.stitchDesigns[0] ?? null}
      />

      {/* Popup Preview */}
      <PopupPreviewCard
        headline={design.headline}
        body={design.body}
        ctaText={design.ctaText}
        primaryColor={design.primaryColor}
        campaignName={campaign.name}
        generatedCode={variant.generatedCode}
      />

      {/* Performance vs Other Variants */}
      <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-[color:var(--color-text-primary)]">
          Performance vs Other Variants
        </h2>
        <div className="flex flex-col gap-4">
          {[...allVariantStats]
            .sort((a, b) => b.conversionRate - a.conversionRate)
            .map((v: any) => {
              const isThis = v.id === variantId;
              const barPct = (v.conversionRate / maxRate) * 100;
              return (
                <div key={v.id}>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{
                          backgroundColor: isThis
                            ? "#165DFF"
                            : "var(--color-text-secondary)",
                          opacity: isThis ? 1 : 0.4,
                        }}
                      />
                      <span
                        className={`truncate text-sm ${
                          isThis
                            ? "font-semibold text-[color:var(--color-text-primary)]"
                            : "text-[color:var(--color-text-secondary)]"
                        }`}
                      >
                        {v.name}
                      </span>
                      {v.isControl && (
                        <Badge variant="neutral" className="shrink-0">
                          Control
                        </Badge>
                      )}
                      {v.isWinner && (
                        <Badge variant="success" className="shrink-0">
                          Winner
                        </Badge>
                      )}
                      {isThis && (
                        <Badge variant="neutral" className="shrink-0">
                          This variant
                        </Badge>
                      )}
                    </div>
                    <span className="shrink-0 tabular-nums text-sm font-semibold text-[color:var(--color-text-primary)]">
                      {v.conversionRate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--color-surface-sunken)]">
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{
                        width: `${barPct}%`,
                        backgroundColor: isThis ? "#165DFF" : "#D1D5DB",
                      }}
                    />
                  </div>
                  <p className="mt-1 text-xs tabular-nums text-[color:var(--color-text-secondary)]">
                    {v.impressions.toLocaleString()} impressions &middot;{" "}
                    {v.submissions.toLocaleString()} conversions
                  </p>
                </div>
              );
            })}
        </div>
      </div>

      {/* Traffic History */}
      <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-[color:var(--color-text-primary)]">
          Traffic Allocation
        </h2>
        <div className="flex items-start gap-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] px-4 py-3">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-[color:var(--color-primary)]"
          >
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M12 8v4m0 4h.01"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <div>
            <p className="text-sm font-medium text-[color:var(--color-text-primary)]">
              Managed by AI optimization
            </p>
            <p className="mt-0.5 text-sm text-[color:var(--color-text-secondary)]">
              Asmos automatically adjusts traffic allocation after every impression based on
              variant performance. This variant is currently receiving{" "}
              <span className="font-semibold tabular-nums">
                {variant.trafficPercent.toFixed(1)}%
              </span>{" "}
              of traffic. Allocation is recalculated in real time as more data arrives.
            </p>
          </div>
        </div>
      </div>

      {/* Leads Captured */}
      <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 shadow-sm">
        <h2 className="mb-3 text-base font-semibold text-[color:var(--color-text-primary)]">
          Leads Captured
        </h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-3xl font-bold tabular-nums text-[color:var(--color-text-primary)]">
              {leadsCount.toLocaleString()}
            </p>
            <p className="mt-0.5 text-sm text-[color:var(--color-text-secondary)]">
              total leads from this variant
            </p>
          </div>
          <Link
            href="/leads"
            className="inline-flex items-center justify-center rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2 text-sm font-medium text-[color:var(--color-text-primary)] transition-colors duration-150 hover:bg-[color:var(--color-surface-sunken)] active:scale-[0.98]"
          >
            View all leads
          </Link>
        </div>
      </div>
    </div>
  );
}
