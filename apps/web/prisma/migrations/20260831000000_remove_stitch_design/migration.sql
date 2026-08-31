-- Removes the Google Stitch "AI Design Preview" feature (StitchDesign) -
-- no longer wanted. This table only ever held reference-only design mockups
-- (never read by widget.js/renderPopupTemplate/generatePopupWithVariants -
-- see StitchDesign's own doc comment in the prior schema), so dropping it
-- has no effect on live-serving or generation.

-- DropForeignKey
ALTER TABLE "StitchDesign" DROP CONSTRAINT "StitchDesign_variantId_fkey";

-- DropTable
DROP TABLE "StitchDesign";

-- DropEnum
DROP TYPE "StitchDesignStatus";
