-- CreateEnum
CREATE TYPE "VariantStatus" AS ENUM ('GENERATING', 'ACTIVE', 'ELIMINATED', 'WINNER');

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "tournamentRound" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Variant" ADD COLUMN     "status" "VariantStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "tournamentRound" INTEGER NOT NULL DEFAULT 1;
