import { PlanTier } from ".prisma/client";

// Lifetime count of AI generation calls per account (Account.aiGenerationsCount
// — incremented once per call in generateCampaign.ts and evaluateKnockout.ts,
// regardless of how many variants that call produces). Checked at campaign
// creation (api/campaigns/route.ts) and before each knockout-driven round
// (evaluateKnockout.ts).
//
// Kept generous on FREE so the core loop (generate -> test -> let Asmos craft
// new variants from real analytics) is actually reachable without paying —
// that loop is the product's whole pitch, so gating it to near-zero on FREE
// defeats the point. Still capped on every tier so cost stays bounded.
export const AI_GENERATION_LIMITS: Record<PlanTier, number> = {
  FREE: 10,
  STARTER: 40,
  GROWTH: 150,
  SCALE: 500,
};

// Max variants allowed to compete within a single tournament round
// (evaluateKnockout.ts). generateCampaign.ts always creates 1 control + 2
// AI variants at campaign creation (see variantCount there), so this must be
// >= 3 on every tier or the "generate new variants from analytics" branch in
// evaluateKnockout.ts becomes unreachable from round 1 onward — that was the
// bug on FREE (previously capped at 1, below the 2 variants already created).
export const MAX_VARIANTS_PER_ROUND: Record<PlanTier, number> = {
  FREE: 3,
  STARTER: 8,
  GROWTH: 16,
  SCALE: 30,
};

// Reward/coupon-code generation limits (api/rewards/[id]/codes/route.ts).
//
// Previously the only backend guard was a flat "count must be 1-1000" /
// "import max 5000" check applied the same way to every account regardless
// of tier — and nothing at all stopped repeated calls from piling up an
// unbounded number of total codes. A FREE account could hit "generate 1000"
// in a loop indefinitely. These three limits close that: a per-tier ceiling
// on a single request (so one click can't burn through a whole tier's
// budget), and a per-tier ceiling on total codes ever outstanding across the
// account (so the liability — every code is a promise of a discount — stays
// bounded no matter how many separate requests someone makes).
export const MAX_COUPON_CODES_PER_ACCOUNT: Record<PlanTier, number> = {
  FREE: 100,
  STARTER: 1000,
  GROWTH: 5000,
  SCALE: 20000,
};

export const MAX_CODES_PER_GENERATE_REQUEST: Record<PlanTier, number> = {
  FREE: 25,
  STARTER: 100,
  GROWTH: 250,
  SCALE: 500,
};

export const MAX_CODES_PER_IMPORT_REQUEST: Record<PlanTier, number> = {
  FREE: 100,
  STARTER: 1000,
  GROWTH: 2500,
  SCALE: 5000,
};
