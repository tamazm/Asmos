import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { CampaignRowActions } from "./CampaignRowActions";

// ─── Humanize raw campaign type ─────────────────────────────────────────────
const CAMPAIGN_TYPE_LABELS: Record<string, string> = {
  FORM: "Lead form",
  WHEEL: "Spin to win",
  SCRATCH_CARD: "Scratch card",
};

function humanizeCampaignType(raw: string): string {
  return CAMPAIGN_TYPE_LABELS[raw] ?? raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase().replace(/_/g, " ");
}

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
            className="inline-flex items-center justify-center rounded-lg bg-[color:var(--color-primary)] px-4 py-2 h-10 text-sm font-medium text-white transition-[background-color,transform] duration-200 hover:bg-[color:var(--color-primary-dark)] active:scale-[0.97]"
          >
            New Campaign
          </Link>
        }
      />

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-surface)] py-20 text-center">
          {/* Double-Bezel icon */}
          <div className="mb-5 rounded-[1.125rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-1.5">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-[0.75rem] bg-[color:var(--color-primary-light)]"
              style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8)" }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M3 11l19-9-9 19-2-8-8-2zM22 2L11 13"
                  stroke="#165DFF"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
          <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">
            No campaigns yet
          </p>
          <p
            className="mt-1 max-w-xs text-sm text-[color:var(--color-text-secondary)]"
            style={{ textWrap: "pretty" } as React.CSSProperties}
          >
            Create your first popup to start collecting leads and running A/B tests.
          </p>
          <Link
            href="/campaigns/new"
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[color:var(--color-primary)] px-4 h-10 text-sm font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-[color:var(--color-primary-dark)] active:scale-[0.97]"
          >
            New Campaign
          </Link>
        </div>
      ) : (
        <DataTable<CampaignRow>
          rows={rows}
          columns={[
            {
              header: "Name",
              render: (row) => (
                <Link href={`/campaigns/${row.id}`} className="hover:underline">
                  {row.name}
                </Link>
              ),
            },
            { header: "Type", render: (row) => humanizeCampaignType(row.type) },
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
      )}
    </div>
  );
}
