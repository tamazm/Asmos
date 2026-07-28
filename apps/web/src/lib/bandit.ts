import { prisma } from "@/lib/prisma";

// Thompson Sampling for automatic per-variant traffic allocation. Runs after
// every widget event (see /api/widget/events) — no human or AI involvement
// needed for this loop. The separate, slow AI review layer lives in
// lib/insights.ts and reads the results this produces.

export type Arm = { id: string; impressions: number; submissions: number };

// Below this many impressions for *any* arm, we don't trust the data enough
// to deviate from an even split (roadmap: "minimum sample size before
// trusting results").
const MIN_SAMPLE_SIZE = 20;

// Even once a leader is clear, keep sending every arm at least this much
// traffic so a temporarily-losing variant can still recover (roadmap:
// "minimum exploration rate").
const MIN_FLOOR_PERCENT = 5;

const MONTE_CARLO_SAMPLES = 4000;

// Marsaglia & Tsang's method (shape >= 1), boosted via Gamma(a) =
// Gamma(a+1) * U^(1/a) for shape < 1.
function sampleGamma(shape: number): number {
  if (shape < 1) {
    return sampleGamma(shape + 1) * Math.pow(Math.random(), 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number;
    let v: number;
    do {
      x = sampleGaussian();
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = Math.random();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

function sampleGaussian(): number {
  const u1 = Math.random() || Number.EPSILON;
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function sampleBeta(alpha: number, beta: number): number {
  const x = sampleGamma(alpha);
  const y = sampleGamma(beta);
  return x / (x + y);
}

function evenSplitAllocation(arms: Arm[]): Record<string, number> {
  const base = Math.floor(100 / arms.length);
  const allocation: Record<string, number> = {};
  let assigned = 0;
  arms.forEach((arm, index) => {
    const percent = index === arms.length - 1 ? 100 - assigned : base;
    allocation[arm.id] = percent;
    assigned += percent;
  });
  return allocation;
}

/**
 * Thompson-Sampling win probabilities → integer traffic percentages summing
 * to 100, with an exploration floor and a minimum-sample-size guardrail.
 */
export function allocateTraffic(arms: Arm[]): Record<string, number> {
  if (arms.length === 0) return {};
  if (arms.length === 1) return { [arms[0].id]: 100 };

  const hasEnoughData = arms.every((arm) => arm.impressions >= MIN_SAMPLE_SIZE);
  if (!hasEnoughData) return evenSplitAllocation(arms);

  const wins = new Map(arms.map((arm) => [arm.id, 0]));
  for (let i = 0; i < MONTE_CARLO_SAMPLES; i++) {
    let bestId = arms[0].id;
    let bestSample = -1;
    for (const arm of arms) {
      const failures = Math.max(0, arm.impressions - arm.submissions);
      const sample = sampleBeta(arm.submissions + 1, failures + 1);
      if (sample > bestSample) {
        bestSample = sample;
        bestId = arm.id;
      }
    }
    wins.set(bestId, (wins.get(bestId) ?? 0) + 1);
  }

  const remaining = 100 - MIN_FLOOR_PERCENT * arms.length;
  const allocation: Record<string, number> = {};
  let assigned = 0;
  arms.forEach((arm, index) => {
    const winProb = (wins.get(arm.id) ?? 0) / MONTE_CARLO_SAMPLES;
    const percent =
      index === arms.length - 1
        ? 100 - assigned
        : Math.round(MIN_FLOOR_PERCENT + winProb * remaining);
    allocation[arm.id] = percent;
    assigned += percent;
  });
  return allocation;
}

/**
 * Recomputes and persists traffic allocation for the campaign a variant
 * belongs to. No-op if a winner has already been declared (human override
 * always wins) or the campaign only has one variant (nothing to allocate).
 */
export async function recomputeCampaignAllocation(variantId: string) {
  const variant = await prisma.variant.findUnique({
    where: { id: variantId },
    select: { campaignId: true },
  });
  if (!variant) return;

  const campaign = await prisma.campaign.findUnique({
    where: { id: variant.campaignId },
    select: {
      winningVariantId: true,
      variants: { select: { id: true, trafficPercent: true } },
    },
  });
  if (!campaign || campaign.winningVariantId || campaign.variants.length < 2) return;

  const counts = await prisma.campaignEvent.groupBy({
    by: ["variantId", "type"],
    where: { variantId: { in: campaign.variants.map((v) => v.id) } },
    _count: { _all: true },
  });

  const stats = new Map(campaign.variants.map((v) => [v.id, { impressions: 0, submissions: 0 }]));
  for (const row of counts) {
    const entry = stats.get(row.variantId);
    if (!entry) continue;
    if (row.type === "IMPRESSION") entry.impressions = row._count._all;
    if (row.type === "SUBMISSION") entry.submissions = row._count._all;
  }

  const arms: Arm[] = campaign.variants.map((v) => ({
    id: v.id,
    impressions: stats.get(v.id)?.impressions ?? 0,
    submissions: stats.get(v.id)?.submissions ?? 0,
  }));

  const allocation = allocateTraffic(arms);
  const changed = campaign.variants.filter((v) => allocation[v.id] !== v.trafficPercent);
  if (changed.length === 0) return;

  await prisma.$transaction(
    changed.map((v) =>
      prisma.variant.update({ where: { id: v.id }, data: { trafficPercent: allocation[v.id] } }),
    ),
  );
}
