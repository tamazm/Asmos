// Basic frequentist two-proportion z-test — Phase 3 has no bandit yet, just a
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
