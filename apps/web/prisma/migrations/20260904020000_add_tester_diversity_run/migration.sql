-- Durable log of a superadmin Tester Toolkit diversity analysis run.

-- CreateTable
CREATE TABLE "TesterDiversityRun" (
    "id" TEXT NOT NULL,
    "n" INTEGER NOT NULL,
    "aiCallsRequested" INTEGER NOT NULL,
    "goal" TEXT NOT NULL,
    "uniqueRate" DOUBLE PRECISION NOT NULL,
    "meanNearestNeighbor" DOUBLE PRECISION NOT NULL,
    "minNearestNeighbor" DOUBLE PRECISION NOT NULL,
    "tooClosePairRate" DOUBLE PRECISION NOT NULL,
    "exactCollisions" INTEGER NOT NULL,
    "knobs" JSONB NOT NULL,
    "copy" JSONB,
    "popups" JSONB NOT NULL,
    "succeeded" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TesterDiversityRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TesterDiversityRun_createdAt_idx" ON "TesterDiversityRun"("createdAt");
