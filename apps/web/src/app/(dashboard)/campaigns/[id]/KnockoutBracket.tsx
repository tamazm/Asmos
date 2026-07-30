import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfidenceBar } from "@/components/ui/ConfidenceBar";
import { Sparkline } from "@/components/ui/Sparkline";
import { DonutChart } from "@/components/ui/DonutChart";
import { CalloutCard } from "@/components/ui/CalloutCard";
import { type VariantStat } from "./VariantManager";
import { colorForIndex } from "./mockBracketData";

// Shape used internally by the bracket rendering
type BracketVariant = {
  id: string;
  label: string;
  conversionRate: number;
  visitors: number;
  trend: number[];
  color: string;
  isWinner: boolean;
  trafficPercent: number;
  confidenceVsControl: number | null;
};

/** Deterministic sparkline from a string seed. */
function seededTrend(seed: string): number[] {
  // Turn the seed string into a numeric hash
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const points = 8;
  const trend: number[] = [];
  let value = 1 + (hash % 5);
  for (let i = 0; i < points; i++) {
    value += ((hash * (i + 1)) % 7) - 3;
    trend.push(Math.max(0.2, value));
  }
  return trend;
}

function variantInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return name.slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function buildBracketVariants(variants: VariantStat[]): BracketVariant[] {
  return variants.map((v, index) => ({
    id: v.id,
    label: variantInitials(v.name),
    conversionRate: v.conversionRate,
    visitors: v.impressions,
    trend: seededTrend(v.id),
    color: v.primaryColor !== "#165DFF" || index === 0 ? (index === 0 ? "var(--color-primary)" : colorForIndex(index)) : colorForIndex(index),
    isWinner: v.isWinner,
    trafficPercent: v.trafficPercent,
    confidenceVsControl: v.confidenceVsControl,
  }));
}

function VariantNode({ variant }: { variant: BracketVariant }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2">
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white"
        style={{ backgroundColor: typeof variant.color === "string" && variant.color.startsWith("var(") ? undefined : variant.color, background: typeof variant.color === "string" && variant.color.startsWith("var(") ? variant.color : undefined }}
      >
        {variant.label}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">
          {variant.conversionRate.toFixed(2)}%
        </p>
        <p className="text-[11px] text-[color:var(--color-text-secondary)]">
          {variant.visitors.toLocaleString()}
        </p>
      </div>
      <Sparkline data={variant.trend} color={typeof variant.color === "string" && variant.color.startsWith("var(") ? "#165DFF" : variant.color} width={48} height={20} />
    </div>
  );
}

export function KnockoutBracket({ variants }: { variants: VariantStat[] }) {
  const bracketVariants = buildBracketVariants(variants);

  // Rank by conversion rate descending
  const ranked = [...bracketVariants].sort((a, b) => b.conversionRate - a.conversionRate);

  // Current leader: the confirmed winner if set, otherwise top conversion rate
  const confirmedWinner = ranked.find((v) => v.isWinner);
  const leader = confirmedWinner ?? ranked[0];
  const isConfirmedWinner = Boolean(confirmedWinner);

  const totalVisitors = bracketVariants.reduce((sum, v) => sum + v.visitors, 0);
  const totalConversions = bracketVariants.reduce(
    (sum, v) => sum + Math.round(v.visitors * (v.conversionRate / 100)),
    0,
  );
  const avgConversionRate =
    bracketVariants.length > 0
      ? bracketVariants.reduce((sum, v) => sum + v.conversionRate, 0) / bracketVariants.length
      : 0;

  const trafficSegments = bracketVariants.map((v) => ({
    label: v.label,
    value: v.trafficPercent,
    color: typeof v.color === "string" && v.color.startsWith("var(") ? "#165DFF" : v.color,
  }));

  const leaderConfidence =
    leader.confidenceVsControl !== null
      ? leader.confidenceVsControl
      : isConfirmedWinner
        ? 99
        : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-[color:var(--color-text-primary)]">
          Knockout Bracket
        </h2>
        <span
          className="text-xs text-[color:var(--color-text-secondary)]"
          title="How this test narrows down variants each round"
        >
          ⓘ
        </span>
        <Badge variant="neutral">Multi-Armed Bandit + Bayesian Optimization</Badge>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="overflow-x-auto rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
          <div className="flex min-w-max gap-6">
            {/* Single "Active" column showing all real variants */}
            <div className="flex w-48 flex-col gap-2">
              <div>
                <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">
                  Active
                </p>
                <p className="text-xs text-[color:var(--color-text-secondary)]">
                  {bracketVariants.length} {bracketVariants.length === 1 ? "Variant" : "Variants"}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                {ranked.map((variant) => (
                  <VariantNode key={variant.id} variant={variant} />
                ))}
              </div>
            </div>

            {/* Leader / Winner column */}
            {leader && (
              <div className="flex w-64 flex-col gap-3">
                <div>
                  <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">
                    {isConfirmedWinner ? "Winner" : "Current Leader"}
                  </p>
                </div>
                <div className="flex flex-col gap-3 rounded-lg border border-[color:var(--color-primary)] bg-[color:var(--color-primary-light)] p-4">
                  <div className="flex items-center justify-between">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-[color:var(--color-success)]">
                      <path d="M12 2l2.4 6.9H22l-6.2 4.5 2.4 6.9L12 16l-6.2 4.3 2.4-6.9L2 9.1h7.6L12 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <Badge variant={isConfirmedWinner ? "success" : "neutral"}>
                      {isConfirmedWinner ? "Winner" : "Leading"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-md text-xs font-bold text-white"
                      style={{
                        backgroundColor: typeof leader.color === "string" && leader.color.startsWith("var(") ? undefined : leader.color,
                        background: typeof leader.color === "string" && leader.color.startsWith("var(") ? leader.color : undefined,
                      }}
                    >
                      {leader.label}
                    </span>
                    <div>
                      <p className="text-xl font-bold text-[color:var(--color-text-primary)]">
                        {leader.conversionRate.toFixed(2)}%
                      </p>
                      <p className="text-xs text-[color:var(--color-text-secondary)]">
                        Conversion Rate
                      </p>
                    </div>
                  </div>
                  {leaderConfidence !== null && (
                    <div>
                      <p className="mb-1 text-xs text-[color:var(--color-text-secondary)]">
                        Confidence to be best
                      </p>
                      <ConfidenceBar percent={leaderConfidence} />
                    </div>
                  )}
                  <div className="flex justify-between text-xs">
                    <div>
                      <p className="font-semibold text-[color:var(--color-text-primary)]">
                        {totalVisitors.toLocaleString()}
                      </p>
                      <p className="text-[color:var(--color-text-secondary)]">Total Visitors</p>
                    </div>
                    <div>
                      <p className="font-semibold text-[color:var(--color-text-primary)]">
                        {totalConversions.toLocaleString()}
                      </p>
                      <p className="text-[color:var(--color-text-secondary)]">Total Conversions</p>
                    </div>
                  </div>
                  {isConfirmedWinner && (
                    <Button variant="secondary" className="w-full justify-center">
                      View Winning Variant →
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
            <h3 className="mb-3 text-sm font-semibold text-[color:var(--color-text-primary)]">
              Test Summary
            </h3>
            <dl className="flex flex-col gap-2 text-sm">
              {[
                ["Total Variants", bracketVariants.length.toLocaleString()],
                ["Total Visitors", totalVisitors.toLocaleString()],
                ["Total Conversions", totalConversions.toLocaleString()],
                ["Average Conversion Rate", `${avgConversionRate.toFixed(2)}%`],
                ["Traffic Allocation Method", "Bandit"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between">
                  <dt className="text-[color:var(--color-text-secondary)]">{label}</dt>
                  <dd className="font-medium text-[color:var(--color-text-primary)]">{value}</dd>
                </div>
              ))}
              <div className="flex items-center justify-between">
                <dt className="text-[color:var(--color-text-secondary)]">Status</dt>
                <dd>
                  <Badge variant={isConfirmedWinner ? "success" : "neutral"}>
                    {isConfirmedWinner ? "Complete" : "Running"}
                  </Badge>
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
            <h3 className="mb-3 text-sm font-semibold text-[color:var(--color-text-primary)]">
              Traffic Allocation
            </h3>
            <DonutChart segments={trafficSegments} />
          </div>

          <CalloutCard
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" stroke="currentColor" strokeWidth="1.5" />
                <path d="M12 8v4m0 4h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            }
            title="Auto-optimizing"
            message="Asmos is automatically allocating more traffic to better performing variants and eliminating underperformers."
          />
        </div>
      </div>
    </div>
  );
}
