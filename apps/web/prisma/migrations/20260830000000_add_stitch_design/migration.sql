-- CreateEnum
CREATE TYPE "StitchDesignStatus" AS ENUM ('QUEUED', 'GENERATING', 'COMPLETE', 'FAILED');

-- CreateTable
-- AI design mockups (Google Stitch) - reference-only previews a merchant can
-- look at for inspiration. Deliberately never read by widget.js or
-- renderPopupTemplate; see StitchDesign's model comment in schema.prisma.
CREATE TABLE "StitchDesign" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "deviceType" TEXT NOT NULL DEFAULT 'DESKTOP',
    "status" "StitchDesignStatus" NOT NULL DEFAULT 'QUEUED',
    "stitchProjectId" TEXT,
    "stitchScreenId" TEXT,
    "htmlContent" TEXT,
    "imageData" BYTEA,
    "imageContentType" TEXT,
    "stitchHtmlUrl" TEXT,
    "stitchImageUrl" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StitchDesign_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StitchDesign_variantId_idx" ON "StitchDesign"("variantId");

-- AddForeignKey
ALTER TABLE "StitchDesign" ADD CONSTRAINT "StitchDesign_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
