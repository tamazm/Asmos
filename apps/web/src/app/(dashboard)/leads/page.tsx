import { Suspense } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/ui/DataTable";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { LeadsFilters } from "./LeadsFilters";
import type { Prisma } from "@/generated/prisma/client";

type LeadRow = {
  id: string;
  name: string;
  email: string;
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
    take: 100,
  });

  const rows: LeadRow[] = leads.map((lead) => ({
    id: lead.id,
    name: lead.name ?? "—",
    email: lead.email ?? "—",
    campaign: lead.variant.campaign.name,
    reward: lead.rewardClaimedCode ?? "—",
    createdAt: lead.createdAt.toLocaleDateString(),
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Leads" />
      <Suspense fallback={null}>
        <LeadsFilters campaigns={campaigns} />
      </Suspense>
      <DataTable<LeadRow>
        rows={rows}
        emptyMessage="Captured leads will show up here once a campaign goes live."
        columns={[
          { header: "Name", render: (row) => row.name },
          { header: "Email", render: (row) => row.email },
          { header: "Campaign", render: (row) => row.campaign },
          { header: "Reward Code", render: (row) => row.reward },
          { header: "Date", render: (row) => row.createdAt },
        ]}
      />
    </div>
  );
}
