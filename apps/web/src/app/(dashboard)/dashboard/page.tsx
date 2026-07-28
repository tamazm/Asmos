import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";

type CampaignRow = {
  id: string;
  name: string;
  status: string;
  impressions: number;
  conversions: number;
};

export default async function DashboardHomePage() {
  const account = await getOrCreateAccount();
  const campaigns = await prisma.campaign.findMany({
    where: { accountId: account.id },
    orderBy: { createdAt: "desc" },
    include: { variants: { include: { events: true } } },
  });

  const activeCount = campaigns.filter((c) => c.status === "ACTIVE").length;
  const campaignEvents = campaigns.map((c) => c.variants.flatMap((v) => v.events));
  const impressions = campaignEvents.reduce(
    (sum, events) => sum + events.filter((e) => e.type === "IMPRESSION").length,
    0,
  );
  const submissions = campaignEvents.reduce(
    (sum, events) => sum + events.filter((e) => e.type === "SUBMISSION").length,
    0,
  );
  const emailsCaptured = await prisma.lead.count({
    where: { variant: { campaign: { accountId: account.id } }, email: { not: null } },
  });
  const conversionRate = impressions > 0 ? (submissions / impressions) * 100 : 0;

  const rows: CampaignRow[] = campaigns.slice(0, 5).map((campaign) => {
    const events = campaign.variants.flatMap((v) => v.events);
    return {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      impressions: events.filter((e) => e.type === "IMPRESSION").length,
      conversions: events.filter((e) => e.type === "SUBMISSION").length,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Dashboard" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active Campaigns" value={activeCount.toLocaleString()} />
        <StatCard label="Impressions" value={impressions.toLocaleString()} />
        <StatCard label="Emails Captured" value={emailsCaptured.toLocaleString()} />
        <StatCard label="Conversion Rate" value={`${conversionRate.toFixed(1)}%`} />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium text-[color:var(--color-text-secondary)]">
          Recent Campaigns
        </h2>
        <DataTable<CampaignRow>
          rows={rows}
          emptyMessage="No campaigns yet — create your first popup to get started."
          columns={[
            { header: "Name", render: (row) => row.name },
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
    </div>
  );
}
