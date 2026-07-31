-- Add lean-onboarding profile fields to Account
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "ownerRole" TEXT;
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "conversionGoal" TEXT;
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "monthlyTraffic" TEXT;
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "emailPlatform" TEXT;
