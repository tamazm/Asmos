-- AlterEnum
ALTER TYPE "CampaignStatus" ADD VALUE 'GENERATING';
ALTER TYPE "CampaignStatus" ADD VALUE 'FAILED';

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "aiGenerationsCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "billingCycleStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "generationContext" JSONB,
ADD COLUMN     "lastError" TEXT;

-- CreateTable
CREATE TABLE "RateLimit" (
    "id" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RateLimit_ip_key" ON "RateLimit"("ip");

-- CreateIndex
CREATE INDEX "RateLimit_ip_idx" ON "RateLimit"("ip");
