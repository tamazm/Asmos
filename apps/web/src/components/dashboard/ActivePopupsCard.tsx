import Link from "next/link";
import { CardEmpty, DashboardCard, RowIcon, SeeAllLink, TrendPill } from "./primitives";
import { IconBolt, IconPopup } from "./icons";
import type { DashboardMetrics } from "@/lib/dashboardMetrics";

export function ActivePopupsCard({ active }: { active: DashboardMetrics["active"] }) {
  return (
    <DashboardCard icon={<IconBolt />} title="Active Pop-ups" action={<SeeAllLink href="/campaigns" />}>
      <div className="flex items-baseline gap-2">
        <span className="text-[34px] font-bold leading-none tabular-nums tracking-tight text-[color:var(--color-text-primary)]">
          {active.count}
        </span>
        <span className="text-sm text-[color:var(--color-text-secondary)]">Active</span>
      </div>
      <p className="mt-1 text-xs text-[color:var(--color-text-secondary)]">
        Across {active.siteCount} {active.siteCount === 1 ? "site" : "sites"}
      </p>

      <div className="mt-4 border-t border-[color:var(--color-border)] pt-3">
        <p className="text-xs font-medium text-[color:var(--color-text-secondary)]">Top Performing</p>
        {active.top.length === 0 ? (
          <CardEmpty>
            No pop-up has served impressions yet. Rankings appear once traffic starts.
          </CardEmpty>
        ) : (
          <ul className="mt-2 flex flex-col">
            {active.top.map((campaign) => (
              <li key={campaign.id}>
                <Link
                  href={`/campaigns/${campaign.id}`}
                  className="-mx-2 flex items-center gap-2 rounded-lg px-2 py-2 transition-colors duration-200 hover:bg-[color:var(--color-surface-sunken)]"
                >
                  <RowIcon>
                    <IconPopup />
                  </RowIcon>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-[color:var(--color-text-primary)]">
                    {campaign.name}
                  </span>
                  <span className="shrink-0 text-[13px] font-semibold tabular-nums text-[color:var(--color-text-primary)]">
                    {campaign.conversionRate.toFixed(1)}%
                  </span>
                  <TrendPill trend={campaign.trend} className="shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </DashboardCard>
  );
}
