import Link from "next/link";
import { Sparkline } from "@/components/ui/Sparkline";
import { CardEmpty, DashboardCard, SeeAllLink } from "./primitives";
import { IconTable } from "./icons";
import type { RecentRow } from "@/lib/dashboardMetrics";

const STATUS_TONE: Record<string, string> = {
  ACTIVE: "text-[color:var(--color-success)]",
  PAUSED: "text-amber-600",
  FAILED: "text-red-500",
};

function statusLabel(status: string) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export function RecentPerformanceTable({ rows }: { rows: RecentRow[] }) {
  return (
    <DashboardCard
      icon={<IconTable />}
      title="Recent Pop-up Performance"
      action={<SeeAllLink href="/campaigns" />}
      bodyClassName="px-0 pb-2"
    >
      {rows.length === 0 ? (
        <CardEmpty>No pop-ups yet.</CardEmpty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead>
              <tr className="text-xs text-[color:var(--color-text-secondary)]">
                <th className="px-5 py-2 font-medium">Pop-up Name</th>
                <th className="px-5 py-2 font-medium">Impressions</th>
                <th className="px-5 py-2 font-medium">Conversions</th>
                <th className="px-5 py-2 font-medium">Conversion Rate</th>
                <th className="px-5 py-2 font-medium">Status</th>
                <th className="px-5 py-2 font-medium">Performance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-[color:var(--color-border)] transition-colors duration-200 hover:bg-[color:var(--color-surface-sunken)]"
                >
                  <td className="px-5 py-2.5">
                    <Link
                      href={`/campaigns/${row.id}`}
                      className="font-medium text-[color:var(--color-primary)] hover:underline"
                    >
                      {row.name}
                    </Link>
                  </td>
                  <td className="px-5 py-2.5 tabular-nums text-[color:var(--color-text-primary)]">
                    {row.impressions.toLocaleString()}
                  </td>
                  <td className="px-5 py-2.5 tabular-nums text-[color:var(--color-text-primary)]">
                    {row.conversions.toLocaleString()}
                  </td>
                  <td className="px-5 py-2.5 tabular-nums text-[color:var(--color-text-primary)]">
                    {row.impressions > 0 ? `${row.conversionRate.toFixed(1)}%` : "--"}
                  </td>
                  <td
                    className={`px-5 py-2.5 font-medium ${
                      STATUS_TONE[row.status] ?? "text-[color:var(--color-text-secondary)]"
                    }`}
                  >
                    {statusLabel(row.status)}
                  </td>
                  <td className="px-5 py-2.5">
                    {row.spark.some((value) => value > 0) ? (
                      <Sparkline data={row.spark} color="var(--color-primary)" width={96} height={22} />
                    ) : (
                      <span className="text-[color:var(--color-text-secondary)]">--</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardCard>
  );
}
