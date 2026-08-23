import { CardEmpty, DashboardCard, SeeAllLink, TrendPill, formatCompact } from "./primitives";
import { IconLeadCapture } from "./icons";
import type { DashboardMetrics } from "@/lib/dashboardMetrics";

const VIEW_W = 320;
const VIEW_H = 96;

/** Rounds an axis maximum up to something a person would actually label:
 *  1, 2, 5, 10, 20, 50, 100 ... rather than "the tallest bar plus a bit". */
function niceMax(value: number) {
  if (value <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    const candidate = step * magnitude;
    if (candidate >= value) return candidate;
  }
  return 10 * magnitude;
}

function axisLabel(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}K`;
  return `${value}`;
}

function tickLabel(iso: string) {
  const date = new Date(`${iso}T00:00:00Z`);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

export function LeadCaptureCard({
  series,
  totals,
  windowDays,
}: {
  series: DashboardMetrics["leadSeries"];
  totals: DashboardMetrics["totals"];
  windowDays: number;
}) {
  const values = series.map((point) => point.count);
  const max = niceMax(Math.max(...values, 0));
  const step = VIEW_W / Math.max(1, series.length - 1);

  const points = values.map((value, index) => {
    const x = index * step;
    const y = VIEW_H - (value / max) * VIEW_H;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const line = `M${points.join(" L")}`;
  const area = `${line} L${VIEW_W},${VIEW_H} L0,${VIEW_H} Z`;

  const tickIndexes = [0, 7, 14, 21, series.length - 1].filter(
    (index, position, all) => index >= 0 && index < series.length && all.indexOf(index) === position,
  );

  return (
    <DashboardCard icon={<IconLeadCapture />} title="Lead Capture" action={<SeeAllLink href="/leads" />}>
      <p className="text-[30px] font-bold leading-none tabular-nums tracking-tight text-[color:var(--color-text-primary)]">
        {formatCompact(totals.leads)}
      </p>
      <p className="mt-1 text-xs text-[color:var(--color-text-secondary)]">Total Leads</p>
      <div className="mt-1 h-4">
        {totals.leadsTrend ? (
          <TrendPill trend={totals.leadsTrend} suffix={`vs last ${windowDays} days`} />
        ) : (
          <span className="text-[11px] text-[color:var(--color-text-secondary)]">
            Last {windowDays} days
          </span>
        )}
      </div>

      {totals.leads === 0 ? (
        <CardEmpty>No leads captured in the last {windowDays} days.</CardEmpty>
      ) : (
        <div className="mt-3 flex flex-1 flex-col justify-end">
          <div className="flex gap-2">
            <div className="flex h-24 w-7 shrink-0 flex-col justify-between text-right text-[10px] tabular-nums text-[color:var(--color-text-secondary)]">
              <span>{axisLabel(max)}</span>
              <span>{axisLabel(max / 2)}</span>
              <span>0</span>
            </div>
            <svg
              viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
              preserveAspectRatio="none"
              className="h-24 w-full"
              aria-label={`Leads per day over the last ${windowDays} days`}
            >
              <defs>
                <linearGradient id="leadCaptureFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={area} fill="url(#leadCaptureFill)" />
              <path
                d={line}
                fill="none"
                stroke="var(--color-primary)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>
          <div className="mt-1.5 flex justify-between pl-9 text-[10px] text-[color:var(--color-text-secondary)]">
            {tickIndexes.map((index) => (
              <span key={index}>{tickLabel(series[index].date)}</span>
            ))}
          </div>
        </div>
      )}
    </DashboardCard>
  );
}
