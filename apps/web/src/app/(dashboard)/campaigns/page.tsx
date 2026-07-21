import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";

type CampaignRow = {
  id: string;
  name: string;
  type: string;
  status: string;
  impressions: number;
  conversions: number;
};

export default async function CampaignsListPage() {
  const account = await getOrCreateAccount();
  const campaigns = await prisma.campaign.findMany({
    where: { accountId: account.id },
    orderBy: { createdAt: "desc" },
    include: { events: true },
  });

  const rows: CampaignRow[] = campaigns.map((campaign) => ({
    id: campaign.id,
    name: campaign.name,
    type: campaign.type,
    status: campaign.status,
    impressions: campaign.events.filter((e) => e.type === "IMPRESSION").length,
    conversions: campaign.events.filter((e) => e.type === "SUBMISSION").length,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pop-ups"
        actions={
          <Link
            href="/campaigns/new"
            className="rounded-lg bg-[color:var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[color:var(--color-primary-dark)]"
          >
            New Campaign
          </Link>
        }
      />

      <DataTable<CampaignRow>
        rows={rows}
        emptyMessage="No campaigns yet — create your first popup to get started."
        columns={[
          { header: "Name", render: (row) => row.name },
          { header: "Type", render: (row) => row.type },
          {
            header: "Status",
            render: (row) => (
              <Badge variant={row.status === "ACTIVE" ? "success" : "neutral"}>
                {row.status}
              </Badge>
            ),
          },
          { header: "Impressions", render: (row) => row.impressions.toLocaleString() },
          { header: "Conversions", render: (row) => row.conversions.toLocaleString() },
        ]}
      />
    </div>
  );
}
