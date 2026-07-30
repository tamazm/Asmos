"use client";

import { ConfidenceBar } from "@/components/ui/ConfidenceBar";
import { DonutChart } from "@/components/ui/DonutChart";
import { Sparkline } from "@/components/ui/Sparkline";
import { type VariantStat } from "./VariantManager";
import { colorForIndex } from "./mockBracketData";

// ─── Types ────────────────────────────────────────────────────────────────────

type BracketVariant = {
  id: string;
  name: string;
  initials: string;
  conversionRate: number;
  impressions: number;
  submissions: number;
  trafficPercent: number;
  confidenceVsControl: number | null;
  isWinner: boolean;
  isControl: boolean;
  trend: number[];
  color: string;
  eliminated: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return name.slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function seededTrend(seed: string): number[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = ((hash * 31) + seed.charCodeAt(i)) >>> 0;
  const points: number[] = [];
  let value = 1 + (hash % 5);
  for (let i = 0; i < 8; i++) {
    value += ((hash * (i + 1)) % 7) - 3;
    points.push(Math.max(0.2, value));
  }
  return points;
}

function resolveColor(color: string, index: number): string {
  if (color && !color.startsWith("#165DFF")) return color;
  return index === 0 ? "#165DFF" : colorForIndex(index);
}

// ─── Variant pill ─────────────────────────────────────────────────────────────

function VariantPill({
  variant,
  highlight = false,
  rank,
}: {
  variant: BracketVariant;
  highlight?: boolean;
  rank: number;
}) {
  const opacity = variant.eliminated ? "opacity-40" : "";
  const ring = highlight
    ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary-light)]"
    : "border-[color:var(--color-border)] bg-[color:var(--color-surface)]";

  return (
    <div
      className={`relative flex items-center gap-3 rounded-xl border p-3 transition-all duration-200 ${ring} ${opacity}`}
    >
      {/* Rank badge */}
      <span
        className="absolute -top-2 -left-2 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white"
        style={{ backgroundColor: variant.eliminated ? "#9CA3AF" : variant.color }}
      >
        {rank}
      </span>

      {/* Color dot + initials */}
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white"
        style={{ backgroundColor: variant.color }}
      >
        {variant.initials}
      </span>

      {/* Stats */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="text-base font-bold tabular-nums text-[color:var(--color-text-primary)]">
            {variant.conversionRate.toFixed(2)}%
          </span>
          {variant.eliminated && (
            <span className="text-[10px] font-medium text-[color:var(--color-text-secondary)]">
              eliminated
            </span>
          )}
          {variant.isWinner && (
            <span className="text-[10px] font-semibold text-emerald-600">winner</span>
          )}
        </div>
        <p className="truncate text-[11px] text-[color:var(--color-text-secondary)]">
          {variant.impressions.toLocaleString()} visitors
        </p>
      </div>

      {/* Sparkline */}
      <Sparkline
        data={variant.trend}
        color={variant.eliminated ? "#9CA3AF" : variant.color}
        width={44}
        height={20}
      />
    </div>
  );
}

// ─── Connector SVG between rounds ─────────────────────────────────────────────

function RoundConnector({ count }: { count: number }) {
  // Draw bracket lines: N items on left → ceil(N/2) on right
  const outCount = Math.ceil(count / 2);
  const rowH = 84; // px per variant row (pill height + gap)
  const totalH = count * rowH;
  const outTotalH = outCount * rowH;

  const paths: string[] = [];
  for (let i = 0; i < outCount; i++) {
    const top = i * 2;
    const bottom = i * 2 + 1;
    const yTop = top * rowH + rowH / 2;
    const yBot = bottom < count ? bottom * rowH + rowH / 2 : yTop;
    const yMid = (yTop + yBot) / 2;
    const yOut = i * rowH + rowH / 2 + (totalH - outTotalH) / 2;

    // Line from top variant → midpoint
    paths.push(`M 0 ${yTop} H 16 V ${yMid}`);
    // Line from bottom variant → midpoint (only if it exists)
    if (bottom < count) paths.push(`M 0 ${yBot} H 16 V ${yMid}`);
    // Line from midpoint → right
    paths.push(`M 16 ${yMid} H 0`); // placeholder, will draw via right side
    paths.push(`M 16 ${yMid} L 40 ${yOut}`);
  }

  return (
    <svg
      width={40}
      height={totalH}
      className="shrink-0 self-start"
      aria-hidden="true"
      style={{ marginTop: (totalH - outTotalH) / 4 }}
    >
      {paths.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

// ─── Round column ─────────────────────────────────────────────────────────────

function RoundColumn({
  title,
  subtitle,
  variants,
  leaderId,
}: {
  title: string;
  subtitle: string;
  variants: BracketVariant[];
  leaderId: string;
}) {
  return (
    <div className="flex min-w-[200px] flex-col gap-3">
      <div>
        <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">{title}</p>
        <p className="text-xs text-[color:var(--color-text-secondary)]">{subtitle}</p>
      </div>
      <div className="flex flex-col gap-2">
        {variants.map((v, i) => (
          <VariantPill key={v.id} variant={v} highlight={v.id === leaderId} rank={i + 1} />
        ))}
      </div>
    </div>
  );
}

// ─── Winner card ──────────────────────────────────────────────────────────────

function WinnerCard({ variant, confidence }: { variant: BracketVariant; confidence: number | null }) {
  return (
    <div className="flex min-w-[200px] flex-col gap-3">
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">
          {variant.isWinner ? "Winner" : "Current Leader"}
        </p>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${
            variant.isWinner
              ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
              : "bg-blue-50 text-blue-700 ring-blue-200"
          }`}
        >
          {variant.isWinner ? "Confirmed" : "Leading"}
        </span>
      </div>

      <div
        className="flex flex-col gap-4 rounded-xl border p-4"
        style={{
          borderColor: variant.color,
          background: `color-mix(in srgb, ${variant.color} 6%, white)`,
        }}
      >
        {/* Trophy */}
        <div className="flex items-center justify-between">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/80 shadow-sm ring-1 ring-black/5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M6 3H18V14C18 17.3137 15.3137 20 12 20C8.68629 20 6 17.3137 6 14V3Z"
                stroke={variant.color}
                strokeWidth="1.5"
              />
              <path d="M6 7H3C3 9.76142 4.68629 12 6 12" stroke={variant.color} strokeWidth="1.5" strokeLinecap="round" />
              <path d="M18 7H21C21 9.76142 19.3137 12 18 12" stroke={variant.color} strokeWidth="1.5" strokeLinecap="round" />
              <path d="M9 24H15" stroke={variant.color} strokeWidth="1.5" strokeLinecap="round" />
              <path d="M12 20V24" stroke={variant.color} strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <span
            className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white shadow-sm"
            style={{ backgroundColor: variant.color }}
          >
            {variant.initials}
          </span>
        </div>

        {/* Rate */}
        <div>
          <p
            className="text-3xl font-bold tabular-nums"
            style={{ color: variant.color }}
          >
            {variant.conversionRate.toFixed(2)}%
          </p>
          <p className="text-xs text-[color:var(--color-text-secondary)]">Conversion rate</p>
        </div>

        {/* Confidence */}
        {confidence !== null && (
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-xs text-[color:var(--color-text-secondary)]">Confidence to win</p>
              <span className="text-xs font-semibold tabular-nums text-[color:var(--color-text-primary)]">
                {confidence.toFixed(0)}%
              </span>
            </div>
            <ConfidenceBar percent={confidence} />
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3 border-t border-black/5 pt-3">
          <div>
            <p className="text-sm font-semibold tabular-nums text-[color:var(--color-text-primary)]">
              {variant.impressions.toLocaleString()}
            </p>
            <p className="text-[11px] text-[color:var(--color-text-secondary)]">Visitors</p>
          </div>
          <div>
            <p className="text-sm font-semibold tabular-nums text-[color:var(--color-text-primary)]">
              {variant.submissions.toLocaleString()}
            </p>
            <p className="text-[11px] text-[color:var(--color-text-secondary)]">Conversions</p>
          </div>
          <div>
            <p className="text-sm font-semibold tabular-nums text-[color:var(--color-text-primary)]">
              {variant.trafficPercent}%
            </p>
            <p className="text-[11px] text-[color:var(--color-text-secondary)]">Traffic share</p>
          </div>
          <div>
            <p className="text-sm font-semibold tabular-nums text-[color:var(--color-text-primary)]">
              {variant.isControl ? "Control" : "Challenger"}
            </p>
            <p className="text-[11px] text-[color:var(--color-text-secondary)]">Role</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function KnockoutBracket({ variants }: { variants: VariantStat[] }) {
  if (variants.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-dashed border-[color:var(--color-border)] py-20 text-sm text-[color:var(--color-text-secondary)]">
        No variants to display.
      </div>
    );
  }

  // Build enriched variants
  const bracketVariants: BracketVariant[] = variants
    .map((v, i) => ({
      id: v.id,
      name: v.name,
      initials: initials(v.name),
      conversionRate: v.conversionRate,
      impressions: v.impressions,
      submissions: v.submissions,
      trafficPercent: v.trafficPercent,
      confidenceVsControl: v.confidenceVsControl,
      isWinner: v.isWinner,
      isControl: v.isControl,
      trend: seededTrend(v.id),
      color: resolveColor(v.primaryColor, i),
      eliminated: false,
    }))
    .sort((a, b) => b.conversionRate - a.conversionRate);

  // Mark bottom half as eliminated when we have enough variants for it to be meaningful
  if (bracketVariants.length >= 3) {
    const elimCount = Math.floor(bracketVariants.length / 2);
    for (let i = bracketVariants.length - elimCount; i < bracketVariants.length; i++) {
      bracketVariants[i].eliminated = true;
    }
  }

  const confirmedWinner = bracketVariants.find((v) => v.isWinner);
  const leader = confirmedWinner ?? bracketVariants[0];
  const leaderConfidence =
    leader.confidenceVsControl !== null
      ? leader.confidenceVsControl
      : confirmedWinner
        ? 99
        : null;

  // Build rounds: only meaningful if > 2 variants
  // With 2 variants: just show R1 → Winner
  // With 4+: show R1 → R2 → Winner (simulate bracket with available data)
  const showRound2 = bracketVariants.length >= 4;
  const round2 = showRound2
    ? bracketVariants.filter((v) => !v.eliminated).slice(0, Math.ceil(bracketVariants.length / 2))
    : [];

  const totalVisitors = bracketVariants.reduce((s, v) => s + v.impressions, 0);
  const totalConversions = bracketVariants.reduce((s, v) => s + v.submissions, 0);
  const avgRate = bracketVariants.reduce((s, v) => s + v.conversionRate, 0) / bracketVariants.length;

  const trafficSegments = bracketVariants.map((v) => ({
    label: v.initials,
    value: v.trafficPercent,
    color: v.color,
  }));

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-[color:var(--color-text-primary)]">
            Knockout Bracket
          </h2>
          <p className="mt-0.5 text-sm text-[color:var(--color-text-secondary)]">
            Multi-armed bandit with Bayesian optimization. Traffic routes to the best variant automatically.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] px-3 py-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span className="text-xs font-medium text-[color:var(--color-text-secondary)]">
            {confirmedWinner ? "Test complete" : "Running"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_280px]">
        {/* Bracket area */}
        <div className="overflow-x-auto rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
          <div className="flex min-w-max items-start gap-0">
            {/* Round 1 */}
            <RoundColumn
              title="Round 1"
              subtitle={`${bracketVariants.length} ${bracketVariants.length === 1 ? "variant" : "variants"}`}
              variants={bracketVariants}
              leaderId={leader.id}
            />

            {/* Connector R1 → R2 or Winner */}
            <div className="flex shrink-0 items-center self-center px-2">
              <RoundConnector count={bracketVariants.length} />
            </div>

            {/* Round 2 (only when 4+ variants) */}
            {showRound2 && (
              <>
                <RoundColumn
                  title="Round 2"
                  subtitle={`${round2.length} advancing`}
                  variants={round2}
                  leaderId={leader.id}
                />
                <div className="flex shrink-0 items-center self-center px-2">
                  <RoundConnector count={round2.length} />
                </div>
              </>
            )}

            {/* Winner */}
            <WinnerCard variant={leader} confidence={leaderConfidence} />
          </div>
        </div>

        {/* Side panel */}
        <div className="flex flex-col gap-4">
          {/* Summary */}
          <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
            <p className="mb-3 text-sm font-semibold text-[color:var(--color-text-primary)]">
              Test summary
            </p>
            <dl className="flex flex-col gap-2.5">
              {[
                ["Variants", bracketVariants.length.toString()],
                ["Total visitors", totalVisitors.toLocaleString()],
                ["Total conversions", totalConversions.toLocaleString()],
                ["Avg. conversion", `${avgRate.toFixed(2)}%`],
                ["Allocation", "Bandit (Thompson)"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between">
                  <dt className="text-xs text-[color:var(--color-text-secondary)]">{label}</dt>
                  <dd className="text-xs font-semibold text-[color:var(--color-text-primary)]">
                    {value}
                  </dd>
                </div>
              ))}
              <div className="flex items-center justify-between">
                <dt className="text-xs text-[color:var(--color-text-secondary)]">Status</dt>
                <dd>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${
                      confirmedWinner
                        ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                        : "bg-blue-50 text-blue-700 ring-blue-200"
                    }`}
                  >
                    {confirmedWinner ? "Complete" : "Running"}
                  </span>
                </dd>
              </div>
            </dl>
          </div>

          {/* Traffic donut */}
          <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
            <p className="mb-3 text-sm font-semibold text-[color:var(--color-text-primary)]">
              Traffic allocation
            </p>
            <DonutChart segments={trafficSegments} />
            <div className="mt-3 flex flex-col gap-1.5">
              {trafficSegments.map((seg) => (
                <div key={seg.label} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: seg.color }}
                    />
                    <span className="text-[color:var(--color-text-secondary)]">{seg.label}</span>
                  </div>
                  <span className="font-semibold tabular-nums text-[color:var(--color-text-primary)]">
                    {seg.value}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Bandit status note */}
          <div className="flex gap-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] px-4 py-3">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0 text-[color:var(--color-primary)]" aria-hidden="true">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
              <path d="M12 8v4m0 4h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <p className="text-xs text-[color:var(--color-text-secondary)]">
              Traffic shifts every 30 seconds based on live performance. Underperformers lose share automatically.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
