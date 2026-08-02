import type { RewardRule } from ".prisma/client";

export function pickWeightedReward<T extends Pick<RewardRule, "weight">>(
  rewards: T[],
): T | null {
  if (rewards.length === 0) return null;
  const total = rewards.reduce((sum, r) => sum + Math.max(r.weight, 0), 0);
  if (total <= 0) return rewards[0];

  let roll = Math.random() * total;
  for (const reward of rewards) {
    roll -= Math.max(reward.weight, 0);
    if (roll <= 0) return reward;
  }
  return rewards[rewards.length - 1];
}

export function generateCouponCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
