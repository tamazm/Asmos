-- Free-text integration requests from merchants, reviewed by superadmins.
CREATE TABLE "IntegrationRequest" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IntegrationRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "IntegrationRequest_accountId_idx" ON "IntegrationRequest"("accountId");
CREATE INDEX "IntegrationRequest_createdAt_idx" ON "IntegrationRequest"("createdAt");

ALTER TABLE "IntegrationRequest" ADD CONSTRAINT "IntegrationRequest_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
