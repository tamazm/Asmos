// Basic frequentist two-proportion z-test - Phase 3 has no bandit yet, just a
// significance check so a customer can "declare a winner" with some confidence.

function erf(x: number): number {
  // Abramowitz & Stegun 7.1.26 approximation.
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const t = 1 / (1 + p * ax);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return sign * y;
}

function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

export type ConversionSample = { impressions: number; conversions: number };

/**
 * Probability (0-100) that `variant`'s true conversion rate beats `control`'s,
 * via a normal approximation to the two-proportion z-test. Returns null when
 * there isn't enough data (either side has 0 impressions) to say anything.
 *
 * This is a ONE-SIDED quantity by construction: 97 means "97% confident the
 * variant is better", 3 means "97% confident it is worse". Read it as such -
 * see `twoSidedPValue` for the symmetric statement, and note that callers who
 * flag both `>= 95` and `<= 5` are working at a two-sided alpha of 0.10, not
 * 0.05.
 */
export function confidenceVsControl(
  control: ConversionSample,
  variant: ConversionSample,
): number | null {
  if (control.impressions === 0 || variant.impressions === 0) return null;

  const p1 = control.conversions / control.impressions;
  const p2 = variant.conversions / variant.impressions;
  const pooled =
    (control.conversions + variant.conversions) / (control.impressions + variant.impressions);
  const se = Math.sqrt(
    pooled * (1 - pooled) * (1 / control.impressions + 1 / variant.impressions),
  );
  if (se === 0) return p2 > p1 ? 100 : p2 < p1 ? 0 : 50;

  const z = (p2 - p1) / se;
  return normalCdf(z) * 100;
}

/**
 * The honest two-sided p-value for the same comparison.
 *
 * Added because `computeSignificanceFlag` was flagging both tails of the
 * one-sided statistic at 5%, which is a two-sided alpha of 0.10 while the
 * comment beside it said 95% confidence. Where a p-value is shown to a merchant
 * it should be this one.
 */
export function twoSidedPValue(
  control: ConversionSample,
  variant: ConversionSample,
): number | null {
  const oneSided = confidenceVsControl(control, variant);
  if (oneSided === null) return null;
  const tail = Math.min(oneSided, 100 - oneSided) / 100;
  return Math.min(1, 2 * tail);
}

/**
 * 95% credible interval on the absolute difference in conversion rate
 * (variant - control), as a normal approximation to the difference of two Beta
 * posteriors under a weak Jeffreys prior.
 *
 * A merchant asking "is this better" is better served by "between +0.4 and
 * +2.1 points" than by a p-value, and unlike a p-value an interval does not
 * invite the reader to treat a single threshold crossing as proof.
 */
export function differenceInterval(
  control: ConversionSample,
  variant: ConversionSample,
): { low: number; point: number; high: number } | null {
  if (control.impressions === 0 || variant.impressions === 0) return null;

  const a1 = control.conversions + 0.5;
  const b1 = control.impressions - control.conversions + 0.5;
  const a2 = variant.conversions + 0.5;
  const b2 = variant.impressions - variant.conversions + 0.5;

  const mean = (a: number, b: number) => a / (a + b);
  const variance = (a: number, b: number) => (a * b) / ((a + b) * (a + b) * (a + b + 1));

  const point = mean(a2, b2) - mean(a1, b1);
  const sd = Math.sqrt(variance(a1, b1) + variance(a2, b2));
  return { low: point - 1.96 * sd, point, high: point + 1.96 * sd };
}
