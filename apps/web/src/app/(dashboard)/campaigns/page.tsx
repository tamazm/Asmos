import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { CampaignRowActions } from "./CampaignRowActions";

type CampaignRow = {
  id: string;
  name: string;
  type: string;
  status: string;
  variantCount: number;
  impressions: number;
  conversions: number;
};

export default async function CampaignsListPage() {
  const account = await getOrCreateAccount();
  const campaigns = await prisma.campaign.findMany({
    where: { accountId: account.id },
    orderBy: { createdAt: "desc" },
    include: { variants: { include: { events: true } } },
  });

  const rows: CampaignRow[] = campaigns.map((campaign) => {
    const events = campaign.variants.flatMap((v) => v.events);
    return {
      id: campaign.id,
      name: campaign.name,
      type: campaign.type,
      status: campaign.status,
      variantCount: campaign.variants.length,
      impressions: events.filter((e) => e.type === "IMPRESSION").length,
      conversions: events.filter((e) => e.type === "SUBMISSION").length,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pop-ups"
        actions={
          <Link
            href="/campaigns/new"
            className="inline-flex items-center justify-center rounded-lg bg-[color:var(--color-primary)] px-4 py-2 h-10 text-sm font-medium text-white hover:bg-[color:var(--color-primary-dark)] transition-colors duration-150 active:scale-[0.98]"
          >
            New Campaign
          </Link>
        }
      />

      <DataTable<CampaignRow>
        rows={rows}
        emptyMessage="No campaigns yet. Create your first popup to get started."
        columns={[
          {
            header: "Name",
            render: (row) => (
              <Link href={`/campaigns/${row.id}`} className="hover:underline">
                {row.name}
              </Link>
            ),
          },
          { header: "Type", render: (row) => row.type },
          {
            header: "Status",
            render: (row) => (
              <Badge variant={row.status === "ACTIVE" ? "success" : "neutral"}>
                {row.status}
              </Badge>
            ),
          },
          {
            header: "Variants",
            render: (row) =>
              row.variantCount > 1 ? (
                <Badge variant="neutral">{row.variantCount} variants</Badge>
              ) : (
                "1"
              ),
          },
          { header: "Impressions", render: (row) => row.impressions.toLocaleString() },
          { header: "Conversions", render: (row) => row.conversions.toLocaleString() },
          {
            header: "",
            render: (row) => (
              <CampaignRowActions campaignId={row.id} status={row.status} />
            ),
          },
        ]}
      />
    </div>
  );
}
