-- Reward system overhaul (advanced reward controls):
-- 1. RewardType gains GIFT (fixed/physical prize with no code).
-- 2. RewardRule gains a generic redemption cap (maxRedemptions/redemptionsCount)
--    so non-coupon reward types (FREE_SHIPPING, GIFT, ...) can also be
--    "a fixed amount, not unlimited" — previously only CouponCode pools had
--    any notion of a finite supply.
-- 3. RewardRule gains `active` so a reward can be paused (excluded from
--    selection/eligibility) without losing its history, and so it can be
--    reassigned/edited from the rewards page.
-- 4. Lead gains rewardRuleId so redemptions can be attributed to a specific
--    RewardRule even for reward types that don't create a CouponCode row.

-- AlterEnum
ALTER TYPE "RewardType" ADD VALUE IF NOT EXISTS 'GIFT';

-- AlterTable
ALTER TABLE "RewardRule" ADD COLUMN "maxRedemptions" INTEGER;
ALTER TABLE "RewardRule" ADD COLUMN "redemptionsCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "RewardRule" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "rewardRuleId" TEXT;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_rewardRuleId_fkey" FOREIGN KEY ("rewardRuleId") REFERENCES "RewardRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Lead_rewardRuleId_idx" ON "Lead"("rewardRuleId");
