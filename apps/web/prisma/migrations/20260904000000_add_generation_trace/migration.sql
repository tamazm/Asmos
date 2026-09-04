-- Per-generation timing breakdown for the superadmin Tester Toolkit's
-- "generation analytics" tool. One row per generation (or knockout) run,
-- written best-effort at the end of the Inngest job.

-- CreateTable
CREATE TABLE "GenerationTrace" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "queueMs" INTEGER,
    "initializeMs" INTEGER,
    "aiThinkingMs" INTEGER,
    "structuringMs" INTEGER,
    "savingMs" INTEGER,
    "totalMs" INTEGER,
    "succeeded" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GenerationTrace_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GenerationTrace_campaignId_createdAt_idx" ON "GenerationTrace"("campaignId", "createdAt");

-- AddForeignKey
ALTER TABLE "GenerationTrace" ADD CONSTRAINT "GenerationTrace_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
