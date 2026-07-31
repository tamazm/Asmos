-- CreateTable
CREATE TABLE "AnalyzeLead" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "storeUrl" TEXT NOT NULL,
    "storeName" TEXT,
    "industry" TEXT,
    "score" INTEGER,
    "grade" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyzeLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnalyzeLead_email_idx" ON "AnalyzeLead"("email");

-- CreateIndex
CREATE INDEX "AnalyzeLead_createdAt_idx" ON "AnalyzeLead"("createdAt");
