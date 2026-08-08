-- CreateEnum
CREATE TYPE "LearnedPatternStatus" AS ENUM ('DRAFT', 'APPROVED', 'REJECTED');

-- CreateTable
-- AI popup variation roadmap, Phase 4: candidate patterns mined across all
-- accounts. Human-gated — see model comment in schema.prisma.
CREATE TABLE "LearnedPattern" (
    "id" TEXT NOT NULL,
    "testAxis" TEXT NOT NULL,
    "failurePattern" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "status" "LearnedPatternStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,

    CONSTRAINT "LearnedPattern_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LearnedPattern_status_idx" ON "LearnedPattern"("status");
