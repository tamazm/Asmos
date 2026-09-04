-- Durable log of a superadmin Tester Toolkit "time a fresh generation" run.
-- No FK to Campaign on purpose: the timing test deletes its throwaway campaign
-- after copying the result here, and this row must survive that deletion.

-- CreateTable
CREATE TABLE "TesterTimingRun" (
    "id" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "succeeded" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "queueMs" INTEGER,
    "initializeMs" INTEGER,
    "aiThinkingMs" INTEGER,
    "structuringMs" INTEGER,
    "savingMs" INTEGER,
    "totalMs" INTEGER,
    "headline" TEXT,
    "generatedCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TesterTimingRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TesterTimingRun_createdAt_idx" ON "TesterTimingRun"("createdAt");
