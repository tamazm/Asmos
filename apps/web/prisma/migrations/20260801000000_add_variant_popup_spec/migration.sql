-- AlterTable: add schema-driven popup generation fields to Variant
ALTER TABLE "Variant" ADD COLUMN IF NOT EXISTS "testAxis" TEXT;
ALTER TABLE "Variant" ADD COLUMN IF NOT EXISTS "popupSpec" JSONB;
ALTER TABLE "Variant" ADD COLUMN IF NOT EXISTS "generatedCode" TEXT;
ALTER TABLE "Variant" ADD COLUMN IF NOT EXISTS "hypothesis" TEXT;
ALTER TABLE "Variant" ADD COLUMN IF NOT EXISTS "motivatingMetric" TEXT;
