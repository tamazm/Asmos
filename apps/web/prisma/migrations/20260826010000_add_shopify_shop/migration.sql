-- CreateTable
CREATE TABLE "ShopifyShop" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uninstalledAt" TIMESTAMP(3),

    CONSTRAINT "ShopifyShop_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyShop_accountId_key" ON "ShopifyShop"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopifyShop_shopDomain_key" ON "ShopifyShop"("shopDomain");

-- CreateIndex
CREATE INDEX "ShopifyShop_shopDomain_idx" ON "ShopifyShop"("shopDomain");

-- AddForeignKey
ALTER TABLE "ShopifyShop" ADD CONSTRAINT "ShopifyShop_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
