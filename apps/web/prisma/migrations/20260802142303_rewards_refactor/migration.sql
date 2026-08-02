/*
  Warnings:

  - You are about to drop the column `variantId` on the `RewardRule` table. All the data in the column will be lost.
  - Added the required column `campaignId` to the `RewardRule` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "RewardRule" DROP CONSTRAINT "RewardRule_variantId_fkey";

-- DropIndex
DROP INDEX "RewardRule_variantId_idx";

-- AlterTable
ALTER TABLE "RewardRule" DROP COLUMN "variantId",
ADD COLUMN     "campaignId" TEXT NOT NULL;

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
