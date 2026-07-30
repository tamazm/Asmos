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
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--color-surface-sunken)]">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M16 2H8C6.89543 2 6 2.89543 6 4V20C6 21.1046 6.89543 22 8 22H16C17.1046 22 18 21.1046 18 20V4C18 2.89543 17.1046 2 16 2Z" stroke="#9CA3AF" strokeWidth="1.5" />
              <path d="M9 7H15M9 11H15M9 15H12" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <p className="text-sm font-medium text-[color:var(--color-text-primary)]">No leads yet</p>
          <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
            Leads will appear here once visitors submit a popup form.
          </p>
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
