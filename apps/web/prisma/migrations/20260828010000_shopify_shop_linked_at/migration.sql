-- Marks a ShopifyShop as linked to a merchant's existing (Clerk-backed) Asmos
-- account. Null = still on the auto-provisioned account created at install.
ALTER TABLE "ShopifyShop" ADD COLUMN "linkedAt" TIMESTAMP(3);
