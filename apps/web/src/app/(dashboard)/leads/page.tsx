// @ts-nocheck
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/ui/DataTable";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { LeadsFilters } from "./LeadsFilters";
import { LeadsExportButton } from "./LeadsExportButton";
import type { Prisma } from "@/generated/prisma/client";

type LeadRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  campaign: string;
  reward: string;
  createdAt: string;
};

export default async function LeadsPage(props: PageProps<"/leads">) {
  const searchParams = await props.searchParams;
  const campaignId =
    typeof searchParams.campaignId === "string" ? searchParams.campaignId : undefined;
  const from = typeof searchParams.from === "string" ? searchParams.from : undefined;
  const to = typeof searchParams.to === "string" ? searchParams.to : undefined;

  const account = await getOrCreateAccount();

  const campaigns = await prisma.campaign.findMany({
    where: { accountId: account.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true },
  });

  const where: Prisma.LeadWhereInput = {
    variant: {
      campaign: {
        accountId: account.id,
        ...(campaignId ? { id: campaignId } : {}),
      },
    },
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
          },
        }
      : {}),
  };

  const leads = await prisma.lead.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { variant: { include: { campaign: { select: { name: true } } } } },
    take: 200,
  });

  const rows: LeadRow[] = leads.map((lead) => ({
    id: lead.id,
    name: lead.name ?? "",
    email: lead.email ?? "",
    phone: lead.phone ?? "",
    campaign: lead.variant.campaign.name,
    reward: lead.rewardClaimedCode ?? "",
    createdAt: new Date(lead.createdAt).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
  }));

  // Build export URL params
  const exportParams = new URLSearchParams();
  if (campaignId) exportParams.set("campaignId", campaignId);
  if (from) exportParams.set("from", from);
  if (to) exportParams.set("to", to);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Leads"
        actions={
          <LeadsExportButton
            exportUrl={`/api/leads/export?${exportParams.toString()}`}
            count={rows.length}
          />
        }
      />
      <Suspense fallback={null}>
        <LeadsFilters campaigns={campaigns} />
      </Suspense>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-surface)] py-20 text-center">
          <div className="mb-5 rounded-[1.125rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-1.5">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-[0.75rem] bg-[color:var(--color-primary-light)]"
              style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8)" }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="#165DFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="9" cy="7" r="4" stroke="#165DFF" strokeWidth="1.5" />
                <path d="M23 21v-2a4 4 0 00-3-3.87" stroke="#165DFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M16 3.13a4 4 0 010 7.75" stroke="#165DFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
          <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">No leads yet</p>
          <p
            className="mt-1 max-w-xs text-sm text-[color:var(--color-text-secondary)]"
            style={{ textWrap: "pretty" } as React.CSSProperties}
          >
            {campaignId
              ? "No leads captured for this campaign yet. Make sure the widget is installed and the campaign is active."
              : "Leads will appear here once visitors submit a popup form. Create a campaign to get started."}
          </p>
          {!campaignId && (
            <Link
              href="/campaigns/new"
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[color:var(--color-primary)] px-4 h-10 text-sm font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-[color:var(--color-primary-dark)] active:scale-[0.97]"
            >
              Create campaign
            </Link>
          )}
        </div>
      ) : (
        <DataTable<LeadRow>
          rows={rows}
          emptyMessage="No leads match your filters."
          columns={[
            { header: "Name", render: (row) => row.name || <span className="text-[color:var(--color-text-secondary)]">–</span> },
            { header: "Email", render: (row) => row.email || <span className="text-[color:var(--color-text-secondary)]">–</span> },
            { header: "Phone", render: (row) => row.phone || <span className="text-[color:var(--color-text-secondary)]">–</span> },
            { header: "Campaign", render: (row) => row.campaign },
            { header: "Reward code", render: (row) => row.reward ? <code className="rounded bg-[color:var(--color-surface-sunken)] px-1.5 py-0.5 text-xs font-mono">{row.reward}</code> : <span className="text-[color:var(--color-text-secondary)]">–</span> },
            { header: "Date", render: (row) => <span className="tabular-nums text-[color:var(--color-text-secondary)]">{row.createdAt}</span> },
          ]}
        />
      )}
    </div>
  );
}
