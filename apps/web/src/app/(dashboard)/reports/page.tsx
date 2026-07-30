import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { ReportCard } from "./ReportCard";

export default async function ReportsPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ campaignId?: string; from?: string; to?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const campaignId =
    typeof searchParams.campaignId === "string" ? searchParams.campaignId : "";
  const from = typeof searchParams.from === "string" ? searchParams.from : "";
  const to = typeof searchParams.to === "string" ? searchParams.to : "";

  const account = await getOrCreateAccount();
  const campaigns = await prisma.campaign.findMany({
    where: { accountId: account.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true },
  });

  const hasCampaigns = campaigns.length > 0;

  function buildParams(extra: Record<string, string> = {}): string {
    const p = new URLSearchParams();
    const effectiveCampaignId = extra.campaignId ?? campaignId;
    const effectiveFrom = extra.from ?? from;
    const effectiveTo = extra.to ?? to;
    if (effectiveCampaignId) p.set("campaignId", effectiveCampaignId);
    if (effectiveFrom) p.set("from", effectiveFrom);
    if (effectiveTo) p.set("to", effectiveTo);
    return p.toString();
  }

  const performanceUrl = `/api/reports/performance?${buildParams()}`;
  const leadsUrl = `/api/leads/export?${buildParams()}`;
  const dateTag = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Reports" />

      {/* Filters */}
      <form method="GET" className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="from" className="text-sm font-medium text-[color:var(--color-text-primary)]">
            From
          </label>
          <input
            id="from"
            name="from"
            type="date"
            defaultValue={from}
            className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm text-[color:var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-primary)]"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="to" className="text-sm font-medium text-[color:var(--color-text-primary)]">
            To
          </label>
          <input
            id="to"
            name="to"
            type="date"
            defaultValue={to}
            className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm text-[color:var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-primary)]"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="campaignId" className="text-sm font-medium text-[color:var(--color-text-primary)]">
            Campaign
          </label>
          <select
            id="campaignId"
            name="campaignId"
            defaultValue={campaignId}
            className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm text-[color:var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-primary)]"
          >
            <option value="">All campaigns</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="rounded-lg bg-[color:var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[color:var(--color-primary-dark)] transition-colors duration-150"
        >
          Apply filters
        </button>
      </form>

      {!hasCampaigns ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-surface)] py-24 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--color-surface-sunken)]">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-sm font-medium text-[color:var(--color-text-primary)]">No campaigns yet</p>
          <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
            Create a campaign to start generating reports.
          </p>
          <Link
            href="/campaigns/new"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[color:var(--color-primary)] px-4 h-10 text-sm font-semibold text-white hover:bg-[color:var(--color-primary-dark)] transition-colors duration-150 active:scale-[0.98]"
          >
            Create campaign
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ReportCard
            title="Performance Report"
            description="Impressions, submissions, conversion rate, and top variant per campaign for the selected date range."
            downloadUrl={performanceUrl}
            filename={`performance-report-${dateTag}.csv`}
          />
          <ReportCard
            title="Leads Export"
            description="All lead submissions including name, email, phone, campaign, and reward code for the selected date range."
            downloadUrl={leadsUrl}
            filename={`leads-export-${dateTag}.csv`}
          />
        </div>
      )}
    </div>
  );
}
