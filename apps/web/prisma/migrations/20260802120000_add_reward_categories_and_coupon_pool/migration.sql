-- AlterTable
ALTER TABLE "RewardRule" ADD COLUMN     "category" TEXT,
ADD COLUMN     "description" TEXT;

-- CreateTable
CREATE TABLE "CouponCode" (
    "id" TEXT NOT NULL,
    "rewardRuleId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "leadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CouponCode_rewardRuleId_usedAt_idx" ON "CouponCode"("rewardRuleId", "usedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CouponCode_rewardRuleId_code_key" ON "CouponCode"("rewardRuleId", "code");

-- AddForeignKey
ALTER TABLE "CouponCode" ADD CONSTRAINT "CouponCode_rewardRuleId_fkey" FOREIGN KEY ("rewardRuleId") REFERENCES "RewardRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponCode" ADD CONSTRAINT "CouponCode_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
