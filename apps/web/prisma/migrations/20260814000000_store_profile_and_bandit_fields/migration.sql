-- Store profile + bandit correctness fields.
--
-- 1. StoreProfile: what we actually understand about a merchant's store.
--    Until now the only brand columns anywhere were Account.industry and
--    Account.brandColor, two strings. Everything else /api/analyze produced —
--    palette, typefaces, imagery style, signature element, detected popup —
--    lived in sessionStorage through onboarding and was dropped at signup, and
--    evaluateKnockout explicitly discarded it from round two onward. That is
--    why generated popups got the store's name right and nothing else.
--
-- 2. Campaign.allocationComputedAt: an explicit stamp for the bandit's
--    recompute throttle. It used to infer this from max(variants.updatedAt),
--    so once the allocation stabilised no row was written, the clock stopped
--    advancing, and every widget event ran a full Monte Carlo over every arm.
--
-- 3. Campaign.lastEvaluatedAt: replaces an `impressions % 1000 === 0` check
--    that ran a full-table count on every impression and was racy at the
--    boundary in both directions (concurrent events could both miss it, or
--    both fire).
--
-- 4. Variant.eliminationStrikes: consecutive knockout evaluations in which an
--    arm's posterior probability of being best sat below the elimination
--    threshold. Requiring two in a row means one unlucky window cannot end a
--    variant on its own.
--
-- Every change is additive and nullable (or defaulted), so deploying the new
-- application code before this migration lands degrades rather than breaks:
-- allocation recompute and knockout evaluation fail and retry, while
-- impressions, submissions and lead capture are unaffected.

-- CreateTable
CREATE TABLE "StoreProfile" (
    "id" TEXT NOT NULL,
    "websiteId" TEXT NOT NULL,
    "category" TEXT,
    "subcategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "audience" TEXT,
    "priceBandMin" INTEGER,
    "priceBandMax" INTEGER,
    "priceBandMedian" INTEGER,
    "currency" TEXT,
    "productCount" INTEGER,
    "palette" JSONB,
    "typeDisplay" TEXT,
    "typeBody" TEXT,
    "buttonStyle" JSONB,
    "borderRadius" TEXT,
    "logoUrl" TEXT,
    "productImages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "brandVoice" TEXT,
    "valueProps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "signatureDetail" TEXT,
    "platform" TEXT,
    "detectedPopup" JSONB,
    "sources" JSONB,
    "confirmedByUser" BOOLEAN NOT NULL DEFAULT false,
    "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoreProfile_websiteId_key" ON "StoreProfile"("websiteId");

-- AddForeignKey
ALTER TABLE "StoreProfile" ADD CONSTRAINT "StoreProfile_websiteId_fkey"
    FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN "allocationComputedAt" TIMESTAMP(3);
ALTER TABLE "Campaign" ADD COLUMN "lastEvaluatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Variant" ADD COLUMN "eliminationStrikes" INTEGER NOT NULL DEFAULT 0;
