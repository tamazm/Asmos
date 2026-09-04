// @ts-expect-error
import { prisma } from "@/lib/prisma";

/**
 * lib/bandit.ts
 *
 * Thompson Sampling for automatic per-variant traffic allocation. Runs after
 * every widget event (see /api/widget/events) - no human or AI involvement
 * needed for this loop. The separate, slow AI review layer lives in
 * lib/insights.ts and reads the results this produces.
 *
 * WHAT CHANGED AND WHY
 * --------------------
 * 1. Arms are ACTIVE variants only. `campaign.variants` was passed unfiltered,
 *    so ELIMINATED arms were still allocated the exploration floor - the
 *    knockout layer set trafficPercent to 0 and the bandit handed 5% straight
 *    back on the next event. Elimination was not durable.
 *
 * 2. GENERATING placeholders are excluded. They have no design and no rendered
 *    code, and with zero impressions they made `hasEnoughData` false, which
 *    reset the WHOLE campaign to an even split and sent real traffic to a
 *    variant that could only render the generic legacy card.
 *
 * 3. The prior is empirical-Bayes, not Uniform. Popup capture rates live
 *    between roughly 1% and 8%; Beta(1,1) puts half its mass above 50%, so a
 *    single conversion at 20 impressions could hand an arm 70% of traffic.
 *
 * 4. Allocation ranks by expected VALUE, not by conversion rate. A 15% arm
 *    beats a 10% arm on capture rate essentially always, and nothing in a
 *    rate-only objective knows the 15% arm costs half again as much margin per
 *    order. Sampling stays Beta-Bernoulli (so it is still exact); the sampled
 *    rate is multiplied by the arm's own margin before the argmax.
 *
 * 5. Percentages are distributed by largest remainder with the floor enforced,
 *    instead of giving the final arm `100 - assigned` as a residual - which
 *    could drop it below the floor it was supposed to be guaranteed.
 *
 * 6. The recompute throttle reads an explicit `allocationComputedAt` instead of
 *    max(variants.updatedAt). Once allocation stabilised no row was written,
 *    updatedAt stopped advancing, and every subsequent event ran a full
 *    4,000-sample Monte Carlo over every arm.
 */

export type Arm = {
  id: string;
  impressions: number;
  submissions: number;
  /**
   * Percentage discount this arm gives away, if any. Used to convert a sampled
   * conversion rate into a sampled *value* - see `armMargin`.
   */
  discountPercent?: number | null;
  /**
   * Share of impressions dismissed within `FAST_DISMISS_MS`. A popup that
   * people bounce off instantly is buying its conversions with attention it is
   * also destroying, and rate alone cannot see that.
   */
  fastDismissRate?: number | null;
};

// Below this many *successes* pooled across arms we do not trust the data
// enough to deviate from an even split. The old guard counted impressions,
// which is the cheap quantity: at a 3% capture rate, 20 impressions is 0.6
// expected conversions and the posteriors are still essentially the prior.
const MIN_TOTAL_SUCCESSES = 12;
const MIN_IMPRESSIONS_PER_ARM = 100;

// Even once a leader is clear, keep sending every arm at least this much
// traffic so a temporarily-losing variant can still recover.
const MIN_FLOOR_PERCENT = 5;

const MONTE_CARLO_SAMPLES = 4000;

// Recomputing is a groupBy + a few row updates - cheap once, but a hot
// campaign can generate thousands of impressions a minute in production.
const RECOMPUTE_THROTTLE_MS = 30_000;

/**
 * How much of a discount's cost to charge against an arm's measured rate.
 *
 * 1.0 would mean "a 20% discount must convert 20% better to break even", which
 * is only right if margin equals price. 0.6 is a deliberately conservative
 * default for typical ecommerce gross margin: enough that the bandit stops
 * treating a deeper discount as free, not so much that it refuses to discount.
 * Overridable per account once merchants can tell us their margin.
 */
export const DEFAULT_DISCOUNT_COST_WEIGHT = 0.6;

/** Dismissals faster than this are reflex, not evaluation. */
export const FAST_DISMISS_MS = 2000;

/**
 * The value multiplier for an arm: what one conversion from it is worth
 * relative to a conversion from a no-discount, non-intrusive arm.
 */
export function armMargin(arm: Arm, discountCostWeight = DEFAULT_DISCOUNT_COST_WEIGHT): number {
  const discount = typeof arm.discountPercent === "number" && Number.isFinite(arm.discountPercent)
    ? Math.max(0, Math.min(100, arm.discountPercent))
    : 0;
  const discountFactor = Math.max(0.05, 1 - discountCostWeight * (discount / 100));

  // A popup that a third of visitors flick away inside two seconds is costing
  // session quality to buy its conversions. Capped so this can shade a decision
  // but never dominate it - it is a softer signal than the discount, which is a
  // known cash cost.
  const fast = typeof arm.fastDismissRate === "number" && Number.isFinite(arm.fastDismissRate)
    ? Math.max(0, Math.min(1, arm.fastDismissRate))
    : 0;
  const qualityFactor = 1 - 0.25 * fast;

  return discountFactor * qualityFactor;
}

// ─── Sampling ────────────────────────────────────────────────────────────────

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

// ─── Prior ───────────────────────────────────────────────────────────────────

export type Prior = { mean: number; concentration: number };

/**
 * The fallback prior when an account has no history: a 3% capture rate with the
 * weight of ~60 impressions. Weak enough that 200 real impressions dominate it,
 * strong enough that one conversion in twenty cannot claim a 50% rate.
 */
export const DEFAULT_PRIOR: Prior = { mean: 0.03, concentration: 60 };

const MIN_PRIOR_MEAN = 0.002;
const MAX_PRIOR_MEAN = 0.5;

/**
 * Fits a prior from whatever history is available.
 *
 * Deliberately just the pooled rate rather than a full method-of-moments fit of
 * the Beta: with the handful of variants a young account has, the variance
 * estimate is noise, and a wrong concentration is worse than a fixed
 * conservative one. Concentration grows with evidence and is capped so the
 * prior can never outweigh an arm's own data.
 */
export function fitPrior(history: { impressions: number; submissions: number }[]): Prior {
  const totals = history.reduce(
    (acc, h) => ({ i: acc.i + Math.max(0, h.impressions), s: acc.s + Math.max(0, h.submissions) }),
    { i: 0, s: 0 },
  );
  if (totals.i < 200) return DEFAULT_PRIOR;
  const mean = Math.min(MAX_PRIOR_MEAN, Math.max(MIN_PRIOR_MEAN, totals.s / totals.i));
  const concentration = Math.min(200, Math.max(40, Math.round(totals.i / 20)));
  return { mean, concentration };
}

function posteriorFor(arm: Arm, prior: Prior): { alpha: number; beta: number } {
  const impressions = Math.max(0, arm.impressions);
  const submissions = Math.max(0, Math.min(arm.submissions, impressions));
  return {
    alpha: prior.mean * prior.concentration + submissions,
    beta: (1 - prior.mean) * prior.concentration + (impressions - submissions),
  };
}

// ─── Win probabilities ───────────────────────────────────────────────────────

/**
 * P(this arm has the highest expected value), by Monte Carlo over the
 * posteriors. Exposed so the knockout evaluator can eliminate on a *sequential*
 * rule rather than a fixed-horizon z-test that is re-read every 1,000
 * impressions with no alpha spending.
 */
export function probabilityBest(
  arms: Arm[],
  prior: Prior = DEFAULT_PRIOR,
  discountCostWeight = DEFAULT_DISCOUNT_COST_WEIGHT,
  samples = MONTE_CARLO_SAMPLES,
): Record<string, number> {
  if (arms.length === 0) return {};
  if (arms.length === 1) return { [arms[0].id]: 1 };

  const posteriors = arms.map((arm) => posteriorFor(arm, prior));
  const margins = arms.map((arm) => armMargin(arm, discountCostWeight));
  const wins = new Map(arms.map((arm) => [arm.id, 0]));

  for (let i = 0; i < samples; i++) {
    let bestId = arms[0].id;
    let bestValue = -1;
    for (let a = 0; a < arms.length; a++) {
      const { alpha, beta } = posteriors[a];
      const value = sampleBeta(alpha, beta) * margins[a];
      if (value > bestValue) {
        bestValue = value;
        bestId = arms[a].id;
      }
    }
    wins.set(bestId, (wins.get(bestId) ?? 0) + 1);
  }

  const out: Record<string, number> = {};
  for (const arm of arms) out[arm.id] = (wins.get(arm.id) ?? 0) / samples;
  return out;
}

// ─── Allocation ──────────────────────────────────────────────────────────────

function evenSplitAllocation(arms: Arm[]): Record<string, number> {
  return largestRemainder(arms.map((a) => ({ id: a.id, weight: 1 })), 0);
}

/**
 * Distributes 100 integer points across weighted items, with a guaranteed
 * per-item floor.
 *
 * The previous implementation gave the last arm whatever was left after
 * rounding the others. With three arms at win probabilities 0.90 / 0.10 / 0.00
 * that produced 82 / 14 / 4 - the final arm below the 5% floor it was supposed
 * to be guaranteed, purely because of its position in the array.
 */
function largestRemainder(
  items: { id: string; weight: number }[],
  floor: number,
): Record<string, number> {
  const n = items.length;
  if (n === 0) return {};
  // With enough arms the floors alone exceed 100; degrade to an even split
  // rather than emitting negative shares.
  const effectiveFloor = floor * n > 100 ? Math.floor(100 / n) : floor;
  const pool = 100 - effectiveFloor * n;

  const totalWeight = items.reduce((s, i) => s + Math.max(0, i.weight), 0);
  const raw = items.map((i) => ({
    id: i.id,
    exact: effectiveFloor + (totalWeight > 0 ? (Math.max(0, i.weight) / totalWeight) * pool : pool / n),
  }));

  const out: Record<string, number> = {};
  let assigned = 0;
  for (const r of raw) {
    const floored = Math.floor(r.exact);
    out[r.id] = floored;
    assigned += floored;
  }

  // Hand the remaining points to the largest fractional parts.
  const remainders = raw
    .map((r) => ({ id: r.id, frac: r.exact - Math.floor(r.exact) }))
    .sort((a, b) => b.frac - a.frac);
  let left = 100 - assigned;
  for (let i = 0; i < remainders.length && left > 0; i++, left--) {
    out[remainders[i].id] += 1;
  }
  // Any residue from pathological inputs goes to the first arm so the total is
  // exactly 100 - the widget's weighted roll assumes it.
  if (left > 0) out[items[0].id] += left;

  return out;
}

/**
 * Thompson-Sampling win probabilities → integer traffic percentages summing
 * to 100, with an exploration floor and a minimum-evidence guardrail.
 */
export function allocateTraffic(
  arms: Arm[],
  prior: Prior = DEFAULT_PRIOR,
  discountCostWeight = DEFAULT_DISCOUNT_COST_WEIGHT,
): Record<string, number> {
  if (arms.length === 0) return {};
  if (arms.length === 1) return { [arms[0].id]: 100 };

  const totalSuccesses = arms.reduce((s, a) => s + Math.max(0, a.submissions), 0);
  const everyArmSeen = arms.every((a) => a.impressions >= MIN_IMPRESSIONS_PER_ARM);
  if (totalSuccesses < MIN_TOTAL_SUCCESSES || !everyArmSeen) {
    return evenSplitAllocation(arms);
  }

  const winProb = probabilityBest(arms, prior, discountCostWeight);
  return largestRemainder(
    arms.map((a) => ({ id: a.id, weight: winProb[a.id] ?? 0 })),
    MIN_FLOOR_PERCENT,
  );
}

// ─── Persistence ─────────────────────────────────────────────────────────────

type VariantStat = { impressions: number; submissions: number; fastDismissals: number; dismissals: number };

/**
 * Reads per-arm counts for a campaign. Exported so `evaluateKnockout` measures
 * exactly what the allocator measures rather than re-deriving it from a
 * different query with different filters.
 */
export async function fetchArms(campaignId: string): Promise<Arm[]> {
  const variants = await prisma.variant.findMany({
    // ACTIVE only. An ELIMINATED arm must not be re-allocated the floor, and a
    // GENERATING placeholder has nothing to render.
    where: { campaignId, status: "ACTIVE" },
    select: { id: true, popupSpec: true },
  });
  if (variants.length === 0) return [];

  const ids = variants.map((v: { id: string }) => v.id);

  const counts = await prisma.campaignEvent.groupBy({
    by: ["variantId", "type"],
    where: { variantId: { in: ids } },
    _count: { _all: true },
  });

  const stats = new Map<string, VariantStat>(
    ids.map((id: string) => [id, { impressions: 0, submissions: 0, fastDismissals: 0, dismissals: 0 }]),
  );
  for (const row of counts) {
    const entry = stats.get(row.variantId);
    if (!entry) continue;
    if (row.type === "IMPRESSION") entry.impressions = row._count._all;
    if (row.type === "SUBMISSION") entry.submissions = row._count._all;
    if (row.type === "DISMISSED") entry.dismissals = row._count._all;
  }

  // Fast dismissals need the payload, so they are a separate bounded read
  // rather than part of the groupBy.
  const dismissals = await prisma.campaignEvent.findMany({
    where: { variantId: { in: ids }, type: "DISMISSED" },
    orderBy: { createdAt: "desc" },
    take: 5000,
    select: { variantId: true, details: true },
  }).catch(() => [] as { variantId: string; details: unknown }[]);

  const fastByVariant = new Map<string, { fast: number; seen: number }>();
  for (const row of dismissals) {
    const ms = (row.details as { dismissAfterMs?: number } | null)?.dismissAfterMs;
    const entry = fastByVariant.get(row.variantId) ?? { fast: 0, seen: 0 };
    if (typeof ms === "number") {
      entry.seen += 1;
      if (ms < FAST_DISMISS_MS) entry.fast += 1;
    }
    fastByVariant.set(row.variantId, entry);
  }

  return variants.map((v: { id: string; popupSpec: unknown }) => {
    const stat = stats.get(v.id) ?? { impressions: 0, submissions: 0, fastDismissals: 0, dismissals: 0 };
    const spec = (v.popupSpec ?? null) as { discount_percent?: number | null } | null;
    const fast = fastByVariant.get(v.id);
    return {
      id: v.id,
      impressions: stat.impressions,
      submissions: stat.submissions,
      discountPercent: typeof spec?.discount_percent === "number" ? spec.discount_percent : null,
      // Share of *impressions* bounced instantly, not share of dismissals -
      // an arm nobody dismisses quickly because nobody sees it is not better.
      fastDismissRate:
        fast && fast.seen > 0 && stat.impressions > 0
          ? (fast.fast / fast.seen) * (stat.dismissals / stat.impressions)
          : 0,
    };
  });
}

/**
 * Fits the account's prior from every campaign it has run except this one.
 * Falls back to DEFAULT_PRIOR when the account is new.
 */
export async function fetchAccountPrior(accountId: string, excludeCampaignId?: string): Promise<Prior> {
  try {
    const rows = await prisma.campaignEvent.groupBy({
      by: ["type"],
      where: {
        type: { in: ["IMPRESSION", "SUBMISSION"] },
        variant: {
          campaign: {
            accountId,
            ...(excludeCampaignId ? { id: { not: excludeCampaignId } } : {}),
          },
        },
      },
      _count: { _all: true },
    });
    const impressions = rows.find((r: { type: string }) => r.type === "IMPRESSION")?._count._all ?? 0;
    const submissions = rows.find((r: { type: string }) => r.type === "SUBMISSION")?._count._all ?? 0;
    return fitPrior([{ impressions, submissions }]);
  } catch {
    return DEFAULT_PRIOR;
  }
}

/**
 * Recomputes and persists traffic allocation for the campaign a variant
 * belongs to. No-op if a winner has already been declared (human override
 * always wins) or the campaign only has one live variant.
 */
export async function recomputeCampaignAllocation(
  variantId: string,
  opts: { force?: boolean } = {},
) {
  const variant = await prisma.variant.findUnique({
    where: { id: variantId },
    select: { campaignId: true },
  });
  if (!variant) return;

  const campaign = await prisma.campaign.findUnique({
    where: { id: variant.campaignId },
    select: {
      id: true,
      accountId: true,
      winningVariantId: true,
      allocationComputedAt: true,
      variants: { where: { status: "ACTIVE" }, select: { id: true, trafficPercent: true } },
    },
  });
  if (!campaign || campaign.winningVariantId || campaign.variants.length < 2) return;

  // An explicit stamp. Reading max(variants.updatedAt) meant that once the
  // allocation stopped changing, no row was written, the clock stopped
  // advancing, and every single subsequent event ran the full Monte Carlo.
  // The traffic simulator (superadmin Tester Toolkit) runs many waves inside a
  // single sub-second request, so every wave after the first would be throttled
  // out. `force` bypasses the throttle for that path only; every production
  // caller leaves it at the default and keeps the 30s guard.
  const last = campaign.allocationComputedAt?.getTime() ?? 0;
  if (!opts.force && Date.now() - last < RECOMPUTE_THROTTLE_MS) return;

  const arms = await fetchArms(campaign.id);
  if (arms.length < 2) return;

  const prior = await fetchAccountPrior(campaign.accountId, campaign.id);
  const allocation = allocateTraffic(arms, prior);

  const changed = campaign.variants.filter(
    (v: { id: string; trafficPercent: number }) =>
      allocation[v.id] !== undefined && allocation[v.id] !== v.trafficPercent,
  );

  await prisma.$transaction([
    ...changed.map((v: { id: string }) =>
      prisma.variant.update({ where: { id: v.id }, data: { trafficPercent: allocation[v.id] } }),
    ),
    prisma.campaign.update({
      where: { id: campaign.id },
      data: { allocationComputedAt: new Date() },
    }),
  ]);
}

// ─── Sample-ratio mismatch ───────────────────────────────────────────────────

/**
 * Chi-square goodness-of-fit of observed impressions per arm against the
 * traffic split we asked for.
 *
 * This is the cheapest possible early warning that something in the assignment
 * path is broken, and it is the check that would have caught the widget
 * counting an impression for popups it then declined to show. A campaign whose
 * arms are not receiving the traffic they were allocated is a campaign whose
 * results mean nothing, however clean the statistics downstream are.
 *
 * Returns the statistic plus a flag at the conventional p < 0.001 threshold
 * (SRM checks are deliberately strict: a false alarm costs a look, a missed
 * one costs the whole experiment).
 */
export function detectSampleRatioMismatch(
  observed: { id: string; impressions: number; trafficPercent: number }[],
): { chiSquare: number; degreesOfFreedom: number; mismatch: boolean; total: number } {
  const live = observed.filter((o) => o.trafficPercent > 0);
  const total = live.reduce((s, o) => s + o.impressions, 0);
  const totalPercent = live.reduce((s, o) => s + o.trafficPercent, 0);

  // Too little traffic to say anything, or a degenerate split.
  if (live.length < 2 || total < 500 || totalPercent <= 0) {
    return { chiSquare: 0, degreesOfFreedom: Math.max(0, live.length - 1), mismatch: false, total };
  }

  let chiSquare = 0;
  for (const arm of live) {
    const expected = (arm.trafficPercent / totalPercent) * total;
    if (expected <= 0) continue;
    const diff = arm.impressions - expected;
    chiSquare += (diff * diff) / expected;
  }

  const df = live.length - 1;
  // Critical values at p = 0.001 for df 1..9; beyond that fall back to the
  // Wilson-Hilferty normal approximation.
  const CRITICAL_001 = [10.83, 13.82, 16.27, 18.47, 20.52, 22.46, 24.32, 26.12, 27.88];
  const critical =
    df <= CRITICAL_001.length
      ? CRITICAL_001[df - 1]
      : df * Math.pow(1 - 2 / (9 * df) + 3.09 * Math.sqrt(2 / (9 * df)), 3);

  return { chiSquare, degreesOfFreedom: df, mismatch: chiSquare > critical, total };
}
