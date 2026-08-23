import Link from "next/link";
import { CardEmpty, DashboardCard, SeeAllLink, TrendPill } from "./primitives";
import { IconRank } from "./icons";
import type { CampaignMetric } from "@/lib/dashboardMetrics";

/** The categorical palette from DESIGN.md, used only to tell rows apart. */
const SWATCHES = ["#3B82F6", "#8B5CF6", "#EC4899", "#F97316", "#10B981", "#06B6D4"];

export function TopPopupsCard({ campaigns }: { campaigns: CampaignMetric[] }) {
  return (
    <DashboardCard icon={<IconRank />} title="Top Pop-ups" action={<SeeAllLink href="/campaigns" />}>
      {campaigns.length === 0 ? (
        <CardEmpty>No leads captured yet, so there is nothing to rank.</CardEmpty>
      ) : (
        <ul className="flex flex-col">
          {campaigns.map((campaign, index) => {
            const color = SWATCHES[index % SWATCHES.length];
            return (
              <li key={campaign.id}>
                <Link
                  href={`/campaigns/${campaign.id}`}
                  className="-mx-2 flex items-center gap-2 rounded-lg px-2 py-2 transition-colors duration-200 hover:bg-[color:var(--color-surface-sunken)]"
                >
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold uppercase"
                    style={{ backgroundColor: `${color}1A`, color }}
                    aria-hidden="true"
                  >
                    {campaign.name.trim().charAt(0) || "?"}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-[color:var(--color-text-primary)]">
                    {campaign.name}
                  </span>
                  <span className="shrink-0 text-[13px] font-semibold tabular-nums text-[color:var(--color-text-primary)]">
                    {campaign.leads.toLocaleString()}
                  </span>
                  <TrendPill trend={campaign.trend} className="shrink-0" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardCard>
  );
}
