// Dummy data for the Knockout Bracket / Performance UI pass - no real bandit
// logic behind these numbers yet. Swap for live per-variant stats once the
// underlying calculation is built.

const PALETTE = [
  "#eb6834", // orange
  "#1baf7a", // aqua
  "#eda100", // yellow
  "#e87ba4", // magenta
  "#008300", // green
  "#4a3aa7", // violet
  "#e34948", // red
];

export function colorForIndex(index: number): string {
  return index === 0 ? "var(--color-primary)" : PALETTE[(index - 1) % PALETTE.length];
}

export type BracketVariant = {
  id: string;
  label: string;
  conversionRate: number;
  visitors: number;
  trend: number[];
  color: string;
};

function seededTrend(seed: number): number[] {
  const points = 8;
  const trend: number[] = [];
  let value = 1 + (seed % 5);
  for (let i = 0; i < points; i++) {
    value += ((seed * (i + 1)) % 7) - 3;
    trend.push(Math.max(0.2, value));
  }
  return trend;
}

const ROUND1_RATES = [
  3.42, 1.12, 1.88, 2.09, 0.93, 1.61, 1.35, 0.78, 1.04, 1.42, 0.65, 1.19, 0.88,
  1.53, 0.71, 2.01, 0.59, 1.21, 0.82, 0.45,
];

const round1: BracketVariant[] = ROUND1_RATES.map((rate, i) => ({
  id: `v${i + 1}`,
  label: `V${i + 1}`,
  conversionRate: rate,
  visitors: Math.round(20000 - i * 750 + (i % 3) * 400),
  trend: seededTrend(i + 1),
  color: colorForIndex(i),
}));

function topHalf(variants: BracketVariant[]): BracketVariant[] {
  return [...variants].sort((a, b) => b.conversionRate - a.conversionRate).slice(0, Math.ceil(variants.length / 2));
}

export const round2 = topHalf(round1).map((v) => ({ ...v, conversionRate: v.conversionRate + 0.3 }));
export const round3 = topHalf(round2).map((v) => ({ ...v, conversionRate: v.conversionRate + 0.25 }));
export const semifinal = topHalf(round3).map((v) => ({ ...v, conversionRate: v.conversionRate + 0.2 }));
export const winner = topHalf(semifinal)[0];

export const rounds = [
  { title: "Round 1", subtitle: `${round1.length} Variants`, variants: round1 },
  { title: "Round 2", subtitle: `${round2.length} Variants`, variants: round2 },
  { title: "Round 3", subtitle: `${round3.length} Variants`, variants: round3 },
  { title: "Semifinal", subtitle: `${semifinal.length} Variants`, variants: semifinal },
];

export const testSummary = {
  totalVariants: round1.length,
  totalVisitors: round1.reduce((sum, v) => sum + v.visitors, 0),
  totalConversions: Math.round(
    round1.reduce((sum, v) => sum + v.visitors * (v.conversionRate / 100), 0),
  ),
  avgConversionRate:
    round1.reduce((sum, v) => sum + v.conversionRate, 0) / round1.length,
  testDurationDays: 14,
  allocationMethod: "Bandit",
};

export const trafficAllocation = [
  { label: "V1 (Winner)", value: 78.2, color: "var(--color-primary)" },
  { label: "V3", value: 16.3, color: colorForIndex(2) },
  { label: "Others", value: 5.5, color: "var(--color-text-secondary)" },
];

export type PerformanceRow = BracketVariant & {
  createdAt: string;
  status: "Winner" | "Live" | "Eliminated";
  trafficPercent: number;
  confidenceToBeBest: number;
  last24h: number;
};

const rankedByRate = [...round1].sort((a, b) => b.conversionRate - a.conversionRate);
const trafficByVariantId = new Map(
  [
    { id: "v1", trafficPercent: 78.2 },
    { id: "v3", trafficPercent: 16.3 },
  ].map((entry) => [entry.id, entry.trafficPercent]),
);

export const performanceRows: PerformanceRow[] = round1.map((variant) => {
  const rank = rankedByRate.findIndex((v) => v.id === variant.id);
  const status: PerformanceRow["status"] =
    variant.id === winner.id ? "Winner" : rank < 3 ? "Live" : "Eliminated";
  return {
    ...variant,
    createdAt: "May 7, 2025",
    status,
    trafficPercent: trafficByVariantId.get(variant.id) ?? 0,
    confidenceToBeBest: status === "Eliminated" ? Math.max(0.1, 1 - rank * 0.03) : 98.7 - rank * 20,
    last24h:
      (variant.trend[variant.trend.length - 1] - variant.trend[variant.trend.length - 2]) / 10,
  };
});
