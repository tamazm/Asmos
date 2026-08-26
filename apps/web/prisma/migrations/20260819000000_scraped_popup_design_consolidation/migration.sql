-- Consolidates ScrapedPopupExample's six scattered flat columns (headline,
-- subhead, ctaText, templateGuess, layoutGuess, palette) into one connected
-- "design" JSONB object - see model comment in schema.prisma and
-- ScrapedPopupDesign in lib/popupScraping.ts. Any existing rows are
-- backfilled from their old columns first so nothing already scraped is lost.

-- AlterTable
ALTER TABLE "ScrapedPopupExample" ADD COLUMN "design" JSONB;

-- Backfill existing rows from the columns being dropped
UPDATE "ScrapedPopupExample"
SET "design" = jsonb_build_object(
  'template', "templateGuess",
  'layout', "layoutGuess",
  'headline', "headline",
  'subhead', "subhead",
  'ctaText', "ctaText",
  'palette', COALESCE("palette", '[]'::jsonb),
  'backgroundColor', NULL,
  'accentColor', NULL,
  'textColor', NULL,
  'headlineFont', NULL,
  'bodyFont', NULL,
  'headlineFontSize', NULL,
  'fontWeight', NULL,
  'cornerRadius', NULL,
  'buttonRadius', NULL,
  'buttonShape', NULL,
  'buttonFill', NULL,
  'padding', NULL,
  'density', NULL,
  'hasImage', false,
  'imagePosition', 'none',
  'hasShadow', false
)
WHERE "design" IS NULL;

-- AlterTable
ALTER TABLE "ScrapedPopupExample" DROP COLUMN "headline";
ALTER TABLE "ScrapedPopupExample" DROP COLUMN "subhead";
ALTER TABLE "ScrapedPopupExample" DROP COLUMN "ctaText";
ALTER TABLE "ScrapedPopupExample" DROP COLUMN "templateGuess";
ALTER TABLE "ScrapedPopupExample" DROP COLUMN "layoutGuess";
ALTER TABLE "ScrapedPopupExample" DROP COLUMN "palette";
