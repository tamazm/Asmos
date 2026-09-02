import { PageHeader } from "@/components/ui/PageHeader";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { RewardsBoard, type RewardRow } from "./RewardsBoard";
import {
  MAX_CODES_PER_GENERATE_REQUEST,
  MAX_CODES_PER_IMPORT_REQUEST,
  MAX_COUPON_CODES_PER_ACCOUNT,
} from "@/lib/limits";

export default async function RewardsPage() {
  const account = await getOrCreateAccount();

  const [rewards, campaigns] = await Promise.all([
    prisma.rewardRule.findMany({
      where: { campaign: { accountId: account.id } },
      include: {
        campaign: { select: { id: true, name: true } },
        couponCodes: { select: { usedAt: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    // Powers the "assign to campaign" / reassign dropdowns - every campaign
    // is a valid target, not just ones that already have a reward.
    prisma.campaign.findMany({
      where: { accountId: account.id },
      select: { id: true, name: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const rows: RewardRow[] = rewards.map((r) => ({
    id: r.id,
    label: r.label,
    category: r.category,
    description: r.description,
    type: r.type,
    couponCode: r.couponCode,
    discountValue: r.discountValue,
    weight: r.weight,
    active: r.active,
    maxRedemptions: r.maxRedemptions,
    redemptionsCount: r.redemptionsCount,
    campaignId: r.campaign.id,
    campaignName: r.campaign.name,
    totalCodes: r.couponCodes.length,
    usedCodes: r.couponCodes.filter((c) => c.usedAt !== null).length,
  }));

  // Mirrors the backend limits in api/rewards/[id]/codes/route.ts (see
  // lib/limits.ts) so the UI shows/enforces the real per-tier caps instead
  // of a stale flat "max 1000" that doesn't match what the server actually
  // accepts, and so the "generate" button reflects remaining account-wide
  // budget rather than letting someone fill in an obviously-too-large number.
  const totalCodesExisting = rows.reduce((sum, r) => sum + r.totalCodes, 0);
  const codeLimits = {
    planTier: account.planTier,
    generateCap: MAX_CODES_PER_GENERATE_REQUEST[account.planTier] ?? 25,
    importCap: MAX_CODES_PER_IMPORT_REQUEST[account.planTier] ?? 100,
    totalCap: MAX_COUPON_CODES_PER_ACCOUNT[account.planTier] ?? 100,
    totalExisting: totalCodesExisting,
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Rewards" />
      <RewardsBoard rows={rows} codeLimits={codeLimits} campaigns={campaigns} />
    </div>
  );
}
