import { PlanTier } from "@prisma/client";

export type BillingInterval = "monthly" | "yearly";

interface PriceConfig {
  monthlyId: string;
  yearlyId: string;
}

export const STRIPE_PRICING: Record<Exclude<PlanTier, "FREE">, PriceConfig> = {
  STARTER: {
    monthlyId: process.env.STRIPE_PRICE_ID_STARTER_MONTHLY || "",
    yearlyId: process.env.STRIPE_PRICE_ID_STARTER_YEARLY || "",
  },
  GROWTH: {
    monthlyId: process.env.STRIPE_PRICE_ID_GROWTH_MONTHLY || "",
    yearlyId: process.env.STRIPE_PRICE_ID_GROWTH_YEARLY || "",
  },
  SCALE: {
    monthlyId: process.env.STRIPE_PRICE_ID_SCALE_MONTHLY || "",
    yearlyId: process.env.STRIPE_PRICE_ID_SCALE_YEARLY || "",
  },
};

/**
 * Returns the correct Price ID for the given tier and interval.
 */
export function getStripePriceId(tier: Exclude<PlanTier, "FREE">, interval: BillingInterval): string {
  const config = STRIPE_PRICING[tier];
  if (!config) throw new Error(`Invalid plan tier: ${tier}`);
  
  const priceId = interval === "yearly" ? config.yearlyId : config.monthlyId;
  if (!priceId) {
    throw new Error(`Missing Stripe price ID for tier ${tier} (${interval})`);
  }
  
  return priceId;
}

/**
 * Reverse lookup to find the PlanTier associated with a given Stripe Price ID.
 */
export function getTierByStripePriceId(priceId: string): PlanTier | null {
  for (const [tier, config] of Object.entries(STRIPE_PRICING)) {
    if (config.monthlyId === priceId || config.yearlyId === priceId) {
      return tier as PlanTier;
    }
  }
  return null;
}
