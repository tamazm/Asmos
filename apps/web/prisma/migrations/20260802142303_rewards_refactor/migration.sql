-- DropForeignKey
ALTER TABLE "RewardRule" DROP CONSTRAINT IF EXISTS "RewardRule_variantId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "RewardRule_variantId_idx";

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

-- CreateIndex
CREATE INDEX "RewardRule_campaignId_idx" ON "RewardRule"("campaignId");

-- AddForeignKey
ALTER TABLE "RewardRule" ADD CONSTRAINT "RewardRule_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
