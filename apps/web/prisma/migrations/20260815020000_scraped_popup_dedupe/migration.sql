-- Dedupe key for scraped popups (see model comment in schema.prisma). Adds
-- normalizedUrl, backfills it for any rows already scraped (approximating
-- lib/popupScraping.ts's normalizeUrl in SQL: lowercase, strip protocol/www/
-- query/hash/trailing slash), removes any duplicates that already exist -
-- keeping the most recently scraped row per site - then enforces uniqueness
-- going forward so the same site is never scraped into two rows again.

-- AlterTable
ALTER TABLE "ScrapedPopupExample" ADD COLUMN "normalizedUrl" TEXT;

-- Backfill
UPDATE "ScrapedPopupExample"
SET "normalizedUrl" = regexp_replace(
  regexp_replace(
    regexp_replace(lower("sourceUrl"), '^https?://(www\.)?', ''),
    '[?#].*$', ''
  ),
  '/+$', ''
)
WHERE "normalizedUrl" IS NULL;

-- Collapse any duplicates already present, keeping the latest scrape per site
DELETE FROM "ScrapedPopupExample" a
USING "ScrapedPopupExample" b
WHERE a."normalizedUrl" = b."normalizedUrl"
  AND (a."scrapedAt", a."id") < (b."scrapedAt", b."id");

-- Enforce going forward
ALTER TABLE "ScrapedPopupExample" ALTER COLUMN "normalizedUrl" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ScrapedPopupExample_normalizedUrl_key" ON "ScrapedPopupExample"("normalizedUrl");
