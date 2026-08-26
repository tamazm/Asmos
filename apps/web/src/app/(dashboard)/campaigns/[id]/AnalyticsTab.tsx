import type { VariantStat } from "./VariantManager";
import type { FrictionFinding, VariantDiagnostics } from "@/lib/campaignDiagnostics";
import { Badge } from "@/components/ui/Badge";

const VARIANT_COLORS = ["#3B82F6", "#10B981", "#F97316", "#EC4899", "#8B5CF6", "#06B6D4"];

const INTENT_STYLES = {
  high: { color: "#10B981", label: "High intent", note: "reached the form or acted on the offer" },
  medium: { color: "#F59E0B", label: "Medium intent", note: "engaged with the page and the popup" },
  low: { color: "#94A3B8", label: "Low intent", note: "saw it, did little else" },
} as const;

const VERDICT_STYLES = {
  healthy: { ring: "border-emerald-200", bg: "bg-emerald-50", text: "text-emerald-900", chip: "bg-emerald-100 text-emerald-700", label: "Healthy" },
  friction: { ring: "border-amber-200", bg: "bg-amber-50", text: "text-amber-900", chip: "bg-amber-100 text-amber-700", label: "Friction" },
  reach: { ring: "border-blue-200", bg: "bg-blue-50", text: "text-blue-900", chip: "bg-blue-100 text-blue-700", label: "Reach" },
  unknown: { ring: "border-[color:var(--color-border)]", bg: "bg-[color:var(--color-surface-sunken)]", text: "text-[color:var(--color-text-primary)]", chip: "bg-slate-100 text-slate-600", label: "Not enough data" },
} as const;

const SEVERITY_CHIP = {
  high: "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-slate-100 text-slate-600",
} as const;

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

function FindingCard({ finding }: { finding: FrictionFinding }) {
  return (
    <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${SEVERITY_CHIP[finding.severity]}`}>
          {finding.severity === "low" ? "Early signal" : `${finding.severity} impact`}
        </span>
        <span className="text-xs tabular-nums text-[color:var(--color-text-secondary)]">
          {finding.sessions.toLocaleString()} of {Math.round(finding.sessions / (finding.rate || 1)).toLocaleString()}{" "}
          {finding.denominator} &middot; {(finding.rate * 100).toFixed(0)}%
        </span>
      </div>
      <p className="mt-2 text-sm font-semibold text-[color:var(--color-text-primary)]">{finding.headline}</p>
      <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">{finding.meaning}</p>
      <p className="mt-2 text-sm text-[color:var(--color-text-primary)]">
        <span className="font-semibold">Try this: </span>
        {finding.fix}
      </p>
    </div>
  );
}

function IntentBreakdown({ diagnostics }: { diagnostics: VariantDiagnostics }) {
  const { intent } = diagnostics;

  if (intent.trackedVisitors === 0) {
    return (
      <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
        <p className="mb-2 text-sm font-semibold text-[color:var(--color-text-primary)]">Visitor intent</p>
        <p className="text-sm text-[color:var(--color-text-secondary)]">
          No visitors could be scored yet.{" "}
          {intent.unattributedEvents > 0
            ? `${intent.unattributedEvents.toLocaleString()} events were recorded without a visitor id, which happens when the widget script on the site predates per-visitor tracking. Reinstall it to start attributing intent.`
            : "Intent appears once the popup has been shown to real visitors."}
        </p>
      </div>
    );
  }

  const segments = (["high", "medium", "low"] as const).map((level) => ({
    level,
    count: intent[level],
    pct: (intent[level] / intent.trackedVisitors) * 100,
    ...INTENT_STYLES[level],
  }));

  return (
    <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">Visitor intent</p>
        <p className="text-xs text-[color:var(--color-text-secondary)]">
          {intent.trackedVisitors.toLocaleString()} scored visitors
          {intent.averageScore !== null && (
            <> &middot; avg score <span className="tabular-nums font-medium">{intent.averageScore}</span>/100</>
          )}
        </p>
      </div>
      <p className="mb-4 text-xs text-[color:var(--color-text-secondary)]">
        How far each visitor got before leaving, scored on what they actually did &mdash; time on page, scroll depth,
        whether they opened the form, and whether they started typing.
      </p>

      <div className="mb-3 flex h-4 overflow-hidden rounded-full bg-[color:var(--color-surface-sunken)]">
        {segments.map((segment) =>
          segment.count > 0 ? (
            <div
              key={segment.level}
              className="h-full transition-[width] duration-500"
              style={{ width: `${segment.pct}%`, backgroundColor: segment.color }}
              title={`${segment.label}: ${segment.count.toLocaleString()}`}
            />
          ) : null,
        )}
      </div>

      <div className="flex flex-col gap-2">
        {segments.map((segment) => (
          <div key={segment.level} className="flex items-baseline justify-between gap-3">
            <div className="flex min-w-0 items-baseline gap-2">
              <span className="h-2 w-2 shrink-0 translate-y-[-1px] rounded-full" style={{ backgroundColor: segment.color }} />
              <span className="text-sm font-medium text-[color:var(--color-text-primary)]">{segment.label}</span>
              <span className="truncate text-xs text-[color:var(--color-text-secondary)]">{segment.note}</span>
            </div>
            <span className="shrink-0 text-sm tabular-nums text-[color:var(--color-text-primary)]">
              {segment.count.toLocaleString()}{" "}
              <span className="text-xs text-[color:var(--color-text-secondary)]">({segment.pct.toFixed(0)}%)</span>
            </span>
          </div>
        ))}
      </div>

      {intent.unattributedEvents > 0 && (
        <p className="mt-3 text-xs text-[color:var(--color-text-secondary)]">
          {intent.unattributedEvents.toLocaleString()} older events had no visitor id and are excluded rather than
          counted as separate people.
        </p>
      )}
    </div>
  );
}

export function AnalyticsTab({
  variants,
  diagnostics,
}: {
  variants: VariantStat[];
  diagnostics: VariantDiagnostics;
}) {
  const maxRate = Math.max(...variants.map((v) => v.conversionRate), 1);
  const maxImpressions = Math.max(...variants.map((v) => v.impressions), 1);
  const bestRate = Math.max(...variants.map((v) => v.conversionRate), 0);
  const verdict = VERDICT_STYLES[diagnostics.verdict.tone];

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
          { label: "Best conversion rate", value: `${bestRate.toFixed(1)}%` },
          { label: "Variants running", value: variants.length.toString() },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
            <p className="text-xs text-[color:var(--color-text-secondary)]">{s.label}</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-[color:var(--color-text-primary)]">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Diagnosis - what the numbers above actually mean */}
      <div className={`rounded-2xl border p-5 ${verdict.ring} ${verdict.bg}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${verdict.chip}`}>
            {verdict.label}
          </span>
          {diagnostics.medianSecondsToFirstKeystroke !== null && (
            <span className="text-xs tabular-nums text-[color:var(--color-text-secondary)]">
              median {diagnostics.medianSecondsToFirstKeystroke}s before first keystroke
            </span>
          )}
        </div>
        <p className={`mt-2 text-base font-bold ${verdict.text}`}>{diagnostics.verdict.headline}</p>
        <p className={`mt-1 text-sm ${verdict.text} opacity-90`}>{diagnostics.verdict.detail}</p>
      </div>

      <IntentBreakdown diagnostics={diagnostics} />

      {/* Where visitors drop off */}
      <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">Where visitors drop off</p>
          <p className="text-xs text-[color:var(--color-text-secondary)]">
            {diagnostics.measuredSessions.toLocaleString()} measured sessions
          </p>
        </div>
        {diagnostics.findings.length === 0 ? (
          <p className="text-sm text-[color:var(--color-text-secondary)]">
            {diagnostics.measuredSessions === 0
              ? "No interaction telemetry recorded yet. This fills in once visitors start opening the popup."
              : "No friction pattern is common enough to flag. Visitors who don't convert are leaving without a shared, fixable reason - which usually points at the offer rather than the popup."}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {diagnostics.findings.map((f) => (
              <FindingCard key={f.key} finding={f} />
            ))}
          </div>
        )}
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
