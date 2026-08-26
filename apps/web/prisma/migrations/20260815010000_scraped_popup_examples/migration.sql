-- Real popups scraped from high-traffic live sites, kept as design grounding
-- for generation (see popupGeneration.ts's getScrapedExamplesSection). No
-- review-gate enum/status here, unlike LearnedPattern - see model comment in
-- schema.prisma for why.

-- CreateTable
CREATE TABLE "ScrapedPopupExample" (
    "id" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "present" BOOLEAN NOT NULL DEFAULT false,
    "html" TEXT,
    "headline" TEXT,
    "subhead" TEXT,
    "ctaText" TEXT,
    "templateGuess" TEXT,
    "layoutGuess" TEXT,
    "palette" JSONB,
    "screenshot" TEXT,
    "scrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScrapedPopupExample_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScrapedPopupExample_industry_present_idx" ON "ScrapedPopupExample"("industry", "present");
