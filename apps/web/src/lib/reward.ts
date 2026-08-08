import type { RewardRule } from ".prisma/client";

// The shape callers need to pass in to check/pick availability. `couponCodes`
// is optional and, when present, MUST already be pre-filtered to unused
// codes only (`where: { usedAt: null }`) — callers control that via their
// Prisma `include`/`select` so this module never has to guess.
type RewardWithAvailability = Pick<
  RewardRule,
  "weight" | "active" | "type" | "couponCode" | "maxRedemptions" | "redemptionsCount"
> & {
  couponCodes?: { id: string }[];
};

// A reward is eligible to be handed out if it's turned on and hasn't hit its
// redemption cap. COUPON rewards additionally need something to actually
// give out (a legacy shared code, or at least one unused pool code) —
// non-coupon types (DISCOUNT_PERCENT, DISCOUNT_FIXED, FREE_SHIPPING, GIFT)
// don't require a "code": they can be purely informational/applied
// automatically at checkout, so they're eligible as long as they're active
// and under their cap.
export function isRewardAvailable(reward: RewardWithAvailability): boolean {
  if (!reward.active) return false;
  if (reward.maxRedemptions !== null && reward.redemptionsCount >= reward.maxRedemptions) {
    return false;
  }
  if (reward.type === "COUPON") {
    const hasPoolCode = (reward.couponCodes?.length ?? 0) > 0;
    return Boolean(reward.couponCode) || hasPoolCode;
  }
  return true;
}

// Used to gate whether a popup should even be shown at all (see
// api/widget/config/route.ts) — a campaign whose goal implies a reward but
// which has nothing currently redeemable to give out must not display.
export function campaignHasAvailableReward(rewards: RewardWithAvailability[]): boolean {
  return rewards.some(isRewardAvailable);
}

export function pickWeightedReward<T extends RewardWithAvailability>(rewards: T[]): T | null {
  const eligible = rewards.filter(isRewardAvailable);
  if (eligible.length === 0) return null;
  const total = eligible.reduce((sum, r) => sum + Math.max(r.weight, 0), 0);
  if (total <= 0) return eligible[0];

  let roll = Math.random() * total;
  for (const reward of eligible) {
    roll -= Math.max(reward.weight, 0);
    if (roll <= 0) return reward;
  }
  return eligible[eligible.length - 1];
}

export function generateCouponCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
