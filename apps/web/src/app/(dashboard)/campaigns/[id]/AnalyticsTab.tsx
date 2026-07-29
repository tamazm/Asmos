import type { VariantStat } from "./VariantManager";
import { Badge } from "@/components/ui/Badge";

const VARIANT_COLORS = ["#3B82F6", "#10B981", "#F97316", "#EC4899", "#8B5CF6", "#06B6D4"];

function ConversionBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--color-surface-sunken)]">
      <div
        className="h-full rounded-full bg-[color:var(--color-primary)] transition-[width] duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function AnalyticsTab({ variants }: { variants: VariantStat[] }) {
  const maxRate = Math.max(...variants.map((v) => v.conversionRate), 1);
  const maxImpressions = Math.max(...variants.map((v) => v.impressions), 1);

  return (
    <div className="flex flex-col gap-6">
      {/* Summary header */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: "Total impressions",
            value: variants.reduce((a, v) => a + v.impressions, 0).toLocaleString(),
          },
          {
            label: "Total submissions",
            value: variants.reduce((a, v) => a + v.submissions, 0).toLocaleString(),
          },
          {
            label: "Best conversion rate",
            value: `${Math.max(...variants.map((v) => v.conversionRate)).toFixed(1)}%`,
          },
          { label: "Variants running", value: variants.length.toString() },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
            <p className="text-xs text-[color:var(--color-text-secondary)]">{s.label}</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-[color:var(--color-text-primary)]">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Conversion rate comparison */}
      <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
        <p className="mb-4 text-sm font-semibold text-[color:var(--color-text-primary)]">Conversion rate by variant</p>
        <div className="flex flex-col gap-4">
          {variants.map((v, i) => (
            <div key={v.id}>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: VARIANT_COLORS[i % VARIANT_COLORS.length] }}
                  />
                  <span className="truncate text-sm font-medium text-[color:var(--color-text-primary)]">{v.name}</span>
                  {v.isControl && <Badge variant="neutral" className="shrink-0">Control</Badge>}
                  {v.isWinner && <Badge variant="success" className="shrink-0">Winner</Badge>}
                </div>
                <span className="shrink-0 tabular-nums text-sm font-semibold text-[color:var(--color-text-primary)]">
                  {v.conversionRate.toFixed(1)}%
                </span>
              </div>
              <ConversionBar value={v.conversionRate} max={maxRate} />
              <p className="mt-1 text-xs text-[color:var(--color-text-secondary)] tabular-nums">
                {v.impressions.toLocaleString()} impressions &middot; {v.submissions.toLocaleString()} submissions
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Traffic allocation */}
      <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
        <p className="mb-4 text-sm font-semibold text-[color:var(--color-text-primary)]">Traffic allocation</p>
        <div className="mb-3 flex h-4 overflow-hidden rounded-full">
          {variants.map((v, i) => (
            <div
              key={v.id}
              className="h-full transition-[width] duration-500"
              style={{
                width: `${v.trafficPercent}%`,
                backgroundColor: VARIANT_COLORS[i % VARIANT_COLORS.length],
              }}
              title={`${v.name}: ${v.trafficPercent.toFixed(1)}%`}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          {variants.map((v, i) => (
            <div key={v.id} className="flex items-center gap-1.5 text-xs text-[color:var(--color-text-secondary)]">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: VARIANT_COLORS[i % VARIANT_COLORS.length] }} />
              {v.name}: <span className="tabular-nums font-medium">{v.trafficPercent.toFixed(1)}%</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-[color:var(--color-text-secondary)]">
          Traffic is automatically reallocated by the bandit algorithm as results accumulate.
        </p>
      </div>

      {/* Impressions comparison */}
      <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
        <p className="mb-4 text-sm font-semibold text-[color:var(--color-text-primary)]">Impressions by variant</p>
        <div className="flex flex-col gap-4">
          {variants.map((v, i) => (
            <div key={v.id}>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-sm text-[color:var(--color-text-secondary)] truncate">{v.name}</span>
                <span className="shrink-0 tabular-nums text-sm font-medium text-[color:var(--color-text-primary)]">
                  {v.impressions.toLocaleString()}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--color-surface-sunken)]">
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{
                    width: `${maxImpressions > 0 ? (v.impressions / maxImpressions) * 100 : 0}%`,
                    backgroundColor: VARIANT_COLORS[i % VARIANT_COLORS.length],
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
