-- The messaging fields and MessageTemplate model were added to the Prisma
-- schema after the original IntegrationConnection migration was deployed.
-- Keep these guards because some environments may already have been repaired
-- manually or with `prisma db push`.

ALTER TABLE "IntegrationConnection"
  ADD COLUMN IF NOT EXISTS "rules" JSONB NOT NULL DEFAULT '[]';

-- The application uses accountId + provider as the upsert selector. The
-- original migration created only a non-unique index for this pair.
CREATE UNIQUE INDEX IF NOT EXISTS "IntegrationConnection_accountId_provider_key"
  ON "IntegrationConnection"("accountId", "provider");

DROP INDEX IF EXISTS "IntegrationConnection_accountId_provider_idx";

CREATE TABLE IF NOT EXISTS "MessageTemplate" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MessageTemplate_connectionId_idx"
  ON "MessageTemplate"("connectionId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'MessageTemplate_connectionId_fkey'
      AND conrelid = '"MessageTemplate"'::regclass
  ) THEN
    ALTER TABLE "MessageTemplate"
      ADD CONSTRAINT "MessageTemplate_connectionId_fkey"
      FOREIGN KEY ("connectionId")
      REFERENCES "IntegrationConnection"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END $$;
