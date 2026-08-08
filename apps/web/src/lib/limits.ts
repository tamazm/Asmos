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
