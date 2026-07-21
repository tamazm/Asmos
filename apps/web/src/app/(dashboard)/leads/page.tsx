import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/ui/DataTable";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";

type LeadRow = {
  id: string;
  name: string;
  email: string;
  campaign: string;
  reward: string;
};

export default async function LeadsPage() {
  const account = await getOrCreateAccount();
  const leads = await prisma.lead.findMany({
    where: { campaign: { accountId: account.id } },
    orderBy: { createdAt: "desc" },
    include: { campaign: { select: { name: true } } },
    take: 100,
  });

  const rows: LeadRow[] = leads.map((lead) => ({
    id: lead.id,
    name: lead.name ?? "—",
    email: lead.email ?? "—",
    campaign: lead.campaign.name,
    reward: lead.rewardClaimedCode ?? "—",
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Leads" />
      <DataTable<LeadRow>
        rows={rows}
        emptyMessage="Captured leads will show up here once a campaign goes live."
        columns={[
          { header: "Name", render: (row) => row.name },
          { header: "Email", render: (row) => row.email },
          { header: "Campaign", render: (row) => row.campaign },
          { header: "Reward Code", render: (row) => row.reward },
        ]}
      />
    </div>
  );
}
