-- Shopify attribution + customer mapping on Lead: ties paid orders (matched by
-- the popup's discount code) and Shopify customers back to the popup Lead.
-- shopifyCustomerId also gives GDPR customers/redact a way to find the lead.
ALTER TABLE "Lead" ADD COLUMN "shopifyCustomerId" TEXT;
ALTER TABLE "Lead" ADD COLUMN "becameCustomerAt" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN "firstOrderId" TEXT;
ALTER TABLE "Lead" ADD COLUMN "firstOrderAmount" DECIMAL(12,2);
ALTER TABLE "Lead" ADD COLUMN "firstOrderCurrency" TEXT;
ALTER TABLE "Lead" ADD COLUMN "firstOrderAt" TIMESTAMP(3);

CREATE INDEX "Lead_shopifyCustomerId_idx" ON "Lead"("shopifyCustomerId");
CREATE INDEX "Lead_email_idx" ON "Lead"("email");
