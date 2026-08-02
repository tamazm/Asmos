-- DropForeignKey
ALTER TABLE "RewardRule" DROP CONSTRAINT "RewardRule_variantId_fkey";

-- DropIndex
DROP INDEX "RewardRule_variantId_idx";

-- AlterTable
-- 1. Add the column as nullable first
ALTER TABLE "RewardRule" ADD COLUMN "campaignId" TEXT;

-- 2. Backfill existing reward rules with the campaignId from their variant
UPDATE "RewardRule"
SET "campaignId" = (
  SELECT "campaignId" FROM "Variant" WHERE "Variant"."id" = "RewardRule"."variantId"
);

-- 3. Delete any orphaned reward rules that couldn't be backfilled
DELETE FROM "RewardRule" WHERE "campaignId" IS NULL;

-- 4. Make the column required
ALTER TABLE "RewardRule" ALTER COLUMN "campaignId" SET NOT NULL;

-- 5. Drop the old column
ALTER TABLE "RewardRule" DROP COLUMN "variantId";

-- CreateTable
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "rewardRuleId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "usedAt" TIMESTAMP(3),
    "usedByEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Coupon_rewardRuleId_idx" ON "Coupon"("rewardRuleId");

-- CreateIndex
CREATE INDEX "RewardRule_campaignId_idx" ON "RewardRule"("campaignId");

-- AddForeignKey
ALTER TABLE "RewardRule" ADD CONSTRAINT "RewardRule_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_rewardRuleId_fkey" FOREIGN KEY ("rewardRuleId") REFERENCES "RewardRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
