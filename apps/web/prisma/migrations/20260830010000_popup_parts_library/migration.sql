-- Replaces the single-row-per-whole-popup ScrapedPopupExample with a
-- dissected-parts model: ScrapedSite (page-level facts) + PopupPart (one row
-- per role - CARD/TYPOGRAPHY/BUTTON/IMAGE), so generation can mix parts
-- across different source popups instead of copying one wholesale.
-- ScrapedPopupExample had zero rows at the time of this migration - no data
-- migration needed, this is a straight replacement.

-- DropTable
DROP TABLE "ScrapedPopupExample";

-- CreateEnum
CREATE TYPE "PopupPartRole" AS ENUM ('CARD', 'TYPOGRAPHY', 'BUTTON', 'IMAGE');

-- CreateTable
CREATE TABLE "ScrapedSite" (
    "id" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "normalizedUrl" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "present" BOOLEAN NOT NULL DEFAULT false,
    "html" TEXT,
    "headline" TEXT,
    "subhead" TEXT,
    "ctaText" TEXT,
    "screenshot" TEXT,
    "scrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScrapedSite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PopupPart" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "role" "PopupPartRole" NOT NULL,
    "industry" TEXT NOT NULL,
    "style" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PopupPart_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScrapedSite_normalizedUrl_key" ON "ScrapedSite"("normalizedUrl");

-- CreateIndex
CREATE INDEX "ScrapedSite_industry_present_idx" ON "ScrapedSite"("industry", "present");

-- CreateIndex
CREATE INDEX "PopupPart_industry_role_idx" ON "PopupPart"("industry", "role");

-- AddForeignKey
ALTER TABLE "PopupPart" ADD CONSTRAINT "PopupPart_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "ScrapedSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
