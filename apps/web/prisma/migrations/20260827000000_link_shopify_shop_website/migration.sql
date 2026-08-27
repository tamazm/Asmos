-- Link a ShopifyShop to the Website that holds its popups/campaigns, so that
-- storefront config lookups can resolve by shop domain (/api/widget/config?shop=)
-- and the embedded admin knows which Website is "the shop's".
ALTER TABLE "ShopifyShop" ADD COLUMN "websiteId" TEXT;

CREATE UNIQUE INDEX "ShopifyShop_websiteId_key" ON "ShopifyShop"("websiteId");

ALTER TABLE "ShopifyShop"
  ADD CONSTRAINT "ShopifyShop_websiteId_fkey"
  FOREIGN KEY ("websiteId") REFERENCES "Website"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
