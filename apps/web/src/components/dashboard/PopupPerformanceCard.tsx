import { DashboardCard, SeeAllLink, TrendPill, formatCompact } from "./primitives";
import { IconPopup } from "./icons";
import type { DashboardMetrics } from "@/lib/dashboardMetrics";

/** Open-bottom gauge. The track spans 270 degrees starting at the lower left,
 *  so the value reads left-to-right the way the number below it does. The
 *  scale is a plain 0-100% conversion rate: no rebasing to the target, which
 *  would make the same rate look different from one week to the next. */
function Gauge({ percent }: { percent: number }) {
  const radius = 74;
  const circumference = 2 * Math.PI * radius;
  const sweep = 0.75;
  const clamped = Math.max(0, Math.min(100, percent));
  const filled = (clamped / 100) * sweep * circumference;

  return (
    <svg viewBox="0 0 184 184" className="h-[180px] w-[180px]" aria-hidden="true">
      <g transform="rotate(135 92 92)">
        <circle
          cx="92"
          cy="92"
          r={radius}
          fill="none"
          stroke="var(--color-surface-sunken)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${sweep * circumference} ${circumference}`}
        />
        {/* Omitted at zero: a rounded cap on a zero-length dash would draw a
            dot, reading as "a little" when the real answer is "none". */}
        {filled > 0 && (
          <circle
            cx="92"
            cy="92"
            r={radius}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference}`}
          />
        )}
      </g>
    </svg>
  );
}

function MiniStat({
  label,
  value,
  trend,
}: {
  label: string;
  value: string;
  trend: DashboardMetrics["totals"]["impressionsTrend"];
}) {
  return (
    <div className="flex flex-col gap-1 px-1 first:pl-0 last:pr-0">
      <p className="text-xs text-[color:var(--color-text-secondary)]">{label}</p>
      <p className="text-xl font-bold tabular-nums tracking-tight text-[color:var(--color-text-primary)]">
        {value}
      </p>
      <TrendPill trend={trend} />
    </div>
  );
}

export function PopupPerformanceCard({
  totals,
  windowDays,
}: {
  totals: DashboardMetrics["totals"];
  windowDays: number;
}) {
  const hasTraffic = totals.impressions > 0;

  return (
    <DashboardCard
      icon={<IconPopup />}
      title="Pop-up Performance"
      action={<SeeAllLink href="/analytics" />}
    >
      <div className="flex flex-1 flex-col items-center justify-center py-2">
        <div className="relative">
          <Gauge percent={totals.conversionRate} />
          {/* Value and label sit above the ring's centre; the trend line is
              pulled up into the gap the ring leaves open at the bottom, where
              it can run wider than the ring's inner diameter. */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 pb-8">
            <p className="text-[30px] font-bold leading-none tabular-nums tracking-tight text-[color:var(--color-text-primary)]">
              {hasTraffic ? `${totals.conversionRate.toFixed(1)}%` : "--"}
            </p>
            <p className="text-[10.5px] tracking-tight text-[color:var(--color-text-secondary)]">
              Avg. Conversion Rate
            </p>
          </div>
        </div>
        <div className="-mt-9 whitespace-nowrap">
          {totals.conversionRateTrend ? (
            <TrendPill trend={totals.conversionRateTrend} suffix={`vs last ${windowDays} days`} />
          ) : (
            <span className="text-[11px] text-[color:var(--color-text-secondary)]">
              {hasTraffic ? `Last ${windowDays} days` : "No impressions yet"}
            </span>
          )}
        </div>
      </div>

      <div className="mt-auto grid grid-cols-3 divide-x divide-[color:var(--color-border)] border-t border-[color:var(--color-border)] pt-4">
        <MiniStat
          label="Impressions"
          value={formatCompact(totals.impressions)}
          trend={totals.impressionsTrend}
        />
        <MiniStat
          label="Conversions"
          value={formatCompact(totals.conversions)}
          trend={totals.conversionsTrend}
        />
        <MiniStat label="Leads" value={formatCompact(totals.leads)} trend={totals.leadsTrend} />
      </div>
    </DashboardCard>
  );
}
