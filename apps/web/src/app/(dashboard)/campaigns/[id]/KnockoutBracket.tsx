import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfidenceBar } from "@/components/ui/ConfidenceBar";
import { Sparkline } from "@/components/ui/Sparkline";
import { DonutChart } from "@/components/ui/DonutChart";
import { CalloutCard } from "@/components/ui/CalloutCard";
import {
  rounds,
  winner,
  testSummary,
  trafficAllocation,
  type BracketVariant,
} from "./mockBracketData";

function VariantNode({ variant }: { variant: BracketVariant }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2">
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white"
        style={{ backgroundColor: variant.color }}
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
      <Sparkline data={variant.trend} color={variant.color} width={48} height={20} />
    </div>
  );
}

export function KnockoutBracket() {
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
            {rounds.map((round) => (
              <div key={round.title} className="flex w-48 flex-col gap-2">
                <div>
                  <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">
                    {round.title}
                  </p>
                  <p className="text-xs text-[color:var(--color-text-secondary)]">
                    {round.subtitle}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  {round.variants.map((variant) => (
                    <VariantNode key={variant.id} variant={variant} />
                  ))}
                </div>
              </div>
            ))}

            <div className="flex w-64 flex-col gap-3">
              <div>
                <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">
                  Winner
                </p>
              </div>
              <div className="flex flex-col gap-3 rounded-lg border border-[color:var(--color-primary)] bg-[color:var(--color-primary-light)] p-4">
                <div className="flex items-center justify-between">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-[color:var(--color-success)]">
                    <path d="M12 2l2.4 6.9H22l-6.2 4.5 2.4 6.9L12 16l-6.2 4.3 2.4-6.9L2 9.1h7.6L12 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <Badge variant="success">Live</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-md text-xs font-bold text-white"
                    style={{ backgroundColor: winner.color }}
                  >
                    {winner.label}
                  </span>
                  <div>
                    <p className="text-xl font-bold text-[color:var(--color-text-primary)]">
                      {winner.conversionRate.toFixed(2)}%
                    </p>
                    <p className="text-xs text-[color:var(--color-text-secondary)]">
                      Conversion Rate
                    </p>
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-xs text-[color:var(--color-text-secondary)]">
                    Confidence to be best
                  </p>
                  <ConfidenceBar percent={98.7} />
                </div>
                <div className="flex justify-between text-xs">
                  <div>
                    <p className="font-semibold text-[color:var(--color-text-primary)]">
                      {testSummary.totalVisitors.toLocaleString()}
                    </p>
                    <p className="text-[color:var(--color-text-secondary)]">Total Visitors</p>
                  </div>
                  <div>
                    <p className="font-semibold text-[color:var(--color-text-primary)]">
                      {testSummary.totalConversions.toLocaleString()}
                    </p>
                    <p className="text-[color:var(--color-text-secondary)]">Total Conversions</p>
                  </div>
                </div>
                <Button variant="secondary" className="w-full justify-center">
                  View Winning Variant →
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
            <h3 className="mb-3 text-sm font-semibold text-[color:var(--color-text-primary)]">
              Test Summary
            </h3>
            <dl className="flex flex-col gap-2 text-sm">
              {[
                ["Total Variants", testSummary.totalVariants.toLocaleString()],
                ["Total Visitors", testSummary.totalVisitors.toLocaleString()],
                ["Total Conversions", testSummary.totalConversions.toLocaleString()],
                ["Average Conversion Rate", `${testSummary.avgConversionRate.toFixed(2)}%`],
                ["Test Duration", `${testSummary.testDurationDays} days`],
                ["Traffic Allocation Method", testSummary.allocationMethod],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between">
                  <dt className="text-[color:var(--color-text-secondary)]">{label}</dt>
                  <dd className="font-medium text-[color:var(--color-text-primary)]">{value}</dd>
                </div>
              ))}
              <div className="flex items-center justify-between">
                <dt className="text-[color:var(--color-text-secondary)]">Status</dt>
                <dd>
                  <Badge variant="success">Running</Badge>
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
            <h3 className="mb-3 text-sm font-semibold text-[color:var(--color-text-primary)]">
              Traffic Allocation
            </h3>
            <DonutChart segments={trafficAllocation} />
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
