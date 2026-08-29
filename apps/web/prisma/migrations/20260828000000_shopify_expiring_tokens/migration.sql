-- Expiring offline access tokens: store the access-token expiry plus an
-- (encrypted) refresh token and its expiry so background/admin calls can renew
-- the ~1h offline token without a merchant present. Nullable so existing rows
-- (legacy permanent tokens) keep working until their next embedded session load
-- re-exchanges them for expiring tokens.
ALTER TABLE "ShopifyShop"
  ADD COLUMN "tokenExpiresAt" TIMESTAMP(3),
  ADD COLUMN "refreshToken" TEXT,
  ADD COLUMN "refreshTokenExpiresAt" TIMESTAMP(3);
