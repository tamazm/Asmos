import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import type { CampaignEventType } from "@/generated/prisma/client";

const VARIANT_COLORS = ["#3B82F6", "#10B981", "#F97316", "#EC4899", "#8B5CF6", "#06B6D4"];

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 shadow-sm">
      <p className="text-xs font-medium text-[color:var(--color-text-secondary)]">{label}</p>
      <p className="mt-1.5 text-2xl font-bold tabular-nums text-[color:var(--color-text-primary)]">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-[color:var(--color-text-secondary)]">{sub}</p>}
    </div>
  );
}

function BarRow({ label, value, max, color, sub }: { label: string; value: number; max: number; color: string; sub?: string }) {
  const pct = max > 0 ? Math.max((value / max) * 100, value > 0 ? 2 : 0) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="truncate text-sm text-[color:var(--color-text-primary)]">{label}</span>
        <span className="shrink-0 tabular-nums text-sm font-semibold text-[color:var(--color-text-primary)]">{value.toLocaleString()}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--color-surface-sunken)]">
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      {sub && <p className="mt-0.5 text-xs text-[color:var(--color-text-secondary)]">{sub}</p>}
    </div>
  );
}

type CampaignRow = {
  id: string;
  name: string;
  type: string;
  status: string;
  impressions: number;
  submissions: number;
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

  if (campaigns.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Analytics" />
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-surface)] py-24 text-center">
          <div className="mb-3 rounded-[1.125rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-1.5">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-[0.75rem] bg-[color:var(--color-primary-light)]"
              style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8)" }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M3 17l4-8 4 4 4-6 4 10" stroke="#165DFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
          <p className="text-sm font-medium text-[color:var(--color-text-primary)]">No data yet</p>
          <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">Create a campaign to start collecting analytics.</p>
          <Link
            href="/campaigns/new"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[color:var(--color-primary)] px-4 h-10 text-sm font-semibold text-white hover:bg-[color:var(--color-primary-dark)] transition-colors duration-150 active:scale-[0.98]"
          >
            Create campaign
          </Link>
        </div>
      </div>
    );
  }

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

  const rows: CampaignRow[] = campaigns.map((campaign) => {
    const impressions = countFor(campaign.id, "IMPRESSION");
    const submissions = countFor(campaign.id, "SUBMISSION");
    return {
      id: campaign.id,
      name: campaign.name,
      type: campaign.type,
      status: campaign.status,
      impressions,
      submissions,
      conversionRate: impressions > 0 ? (submissions / impressions) * 100 : 0,
    };
  });

  const totals = rows.reduce(
    (acc, row) => ({ impressions: acc.impressions + row.impressions, submissions: acc.submissions + row.submissions }),
    { impressions: 0, submissions: 0 },
  );
  const overallCvr = totals.impressions > 0 ? (totals.submissions / totals.impressions) * 100 : 0;

  // Top campaigns by impressions
  const topByImpressions = [...rows].sort((a, b) => b.impressions - a.impressions).slice(0, 5);
  const maxImpressions = Math.max(...topByImpressions.map((r) => r.impressions), 1);

  // Top campaigns by CVR (min 10 impressions to be meaningful)
  const topByCvr = [...rows]
    .filter((r) => r.impressions >= 10)
    .sort((a, b) => b.conversionRate - a.conversionRate)
    .slice(0, 5);
  const maxCvr = Math.max(...topByCvr.map((r) => r.conversionRate), 1);

  // Campaign type breakdown
  const typeBreakdown = rows.reduce(
    (acc, r) => {
      acc[r.type] = (acc[r.type] ?? 0) + r.impressions;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Analytics" />

      {/* Summary metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Total impressions" value={totals.impressions.toLocaleString()} />
        <MetricCard label="Total submissions" value={totals.submissions.toLocaleString()} />
        <MetricCard label="Emails captured" value={emailsCaptured.toLocaleString()} />
        <MetricCard
          label="Conversion rate"
          value={`${overallCvr.toFixed(1)}%`}
          sub={totals.impressions > 0 ? `${totals.submissions} / ${totals.impressions}` : undefined}
        />
      </div>

      {totals.impressions === 0 ? (
        <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-8 text-center">
          <p className="text-sm font-medium text-[color:var(--color-text-primary)]">Waiting for traffic</p>
          <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
            Publish a campaign and install the widget to start seeing analytics here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Top by impressions */}
          {topByImpressions.length > 0 && (
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 shadow-sm">
              <p className="mb-4 text-sm font-semibold text-[color:var(--color-text-primary)]">Top campaigns by impressions</p>
              <div className="flex flex-col gap-4">
                {topByImpressions.map((row, i) => (
                  <BarRow
                    key={row.id}
                    label={row.name}
                    value={row.impressions}
                    max={maxImpressions}
                    color={VARIANT_COLORS[i % VARIANT_COLORS.length]}
                    sub={`${row.conversionRate.toFixed(1)}% conversion`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Top by CVR */}
          {topByCvr.length > 0 && (
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 shadow-sm">
              <p className="mb-4 text-sm font-semibold text-[color:var(--color-text-primary)]">Best conversion rates</p>
              <div className="flex flex-col gap-4">
                {topByCvr.map((row, i) => (
                  <BarRow
                    key={row.id}
                    label={row.name}
                    value={parseFloat(row.conversionRate.toFixed(1))}
                    max={maxCvr}
                    color={VARIANT_COLORS[i % VARIANT_COLORS.length]}
                    sub={`${row.impressions.toLocaleString()} impressions`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Campaign type breakdown */}
          <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 shadow-sm">
            <p className="mb-4 text-sm font-semibold text-[color:var(--color-text-primary)]">Impressions by campaign type</p>
            {Object.keys(typeBreakdown).length === 0 ? (
              <p className="text-sm text-[color:var(--color-text-secondary)]">No data yet.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {Object.entries(typeBreakdown).map(([type, count], i) => (
                  <BarRow
                    key={type}
                    label={{ FORM: "Lead form", WHEEL: "Spin to win", SCRATCH_CARD: "Scratch card" }[type] ?? type}
                    value={count}
                    max={Math.max(...Object.values(typeBreakdown), 1)}
                    color={VARIANT_COLORS[i % VARIANT_COLORS.length]}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Campaign status table */}
          <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 shadow-sm">
            <p className="mb-4 text-sm font-semibold text-[color:var(--color-text-primary)]">All campaigns</p>
            <div className="flex flex-col gap-1">
              {rows.map((row) => (
                <Link
                  key={row.id}
                  href={`/campaigns/${row.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-[color:var(--color-surface-sunken)] transition-colors duration-150"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant={row.status === "ACTIVE" ? "success" : "neutral"}>{row.status}</Badge>
                    <span className="truncate text-sm text-[color:var(--color-text-primary)]">{row.name}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-xs tabular-nums text-[color:var(--color-text-secondary)]">
                    <span>{row.impressions.toLocaleString()} imp</span>
                    <span className="font-medium text-[color:var(--color-text-primary)]">{row.conversionRate.toFixed(1)}%</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-[color:var(--color-text-secondary)] text-center">
        Time-series charts and device breakdown land with Phase 2 behavioral tracking.
      </p>
    </div>
  );
}
