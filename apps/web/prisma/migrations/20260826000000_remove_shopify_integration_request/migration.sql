-- DropForeignKey
ALTER TABLE "ShopifyIntegrationRequest" DROP CONSTRAINT IF EXISTS "ShopifyIntegrationRequest_accountId_fkey";

-- DropTable
DROP TABLE IF EXISTS "ShopifyIntegrationRequest";
