-- Numeric discount value for native Shopify discount-code creation.
-- DISCOUNT_PERCENT: whole percent (10 = 10%). DISCOUNT_FIXED: whole units of the
-- shop currency (5 = $5). Null for COUPON/FREE_SHIPPING/GIFT.
ALTER TABLE "RewardRule" ADD COLUMN "discountValue" INTEGER;
