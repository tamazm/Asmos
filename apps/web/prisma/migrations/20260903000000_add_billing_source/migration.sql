-- CreateEnum
CREATE TYPE "BillingSource" AS ENUM ('NONE', 'STRIPE', 'SHOPIFY');

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "billingSource" "BillingSource" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "shopifySubscriptionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Account_shopifySubscriptionId_key" ON "Account"("shopifySubscriptionId");
