-- Adds the new integration providers wired up in lib/integrations: the
-- merchant-API-key marketing sync providers (Omnisend, Brevo, MailerLite, Drip)
-- and the Google Sheets webhook (Apps Script Web App) automation provider.
-- See registry.ts, manageSyncConnections.ts, manageConnections.ts and the
-- Integrations page meta.

-- AlterEnum
ALTER TYPE "IntegrationProvider" ADD VALUE 'omnisend';
ALTER TYPE "IntegrationProvider" ADD VALUE 'brevo';
ALTER TYPE "IntegrationProvider" ADD VALUE 'mailerlite';
ALTER TYPE "IntegrationProvider" ADD VALUE 'drip';
ALTER TYPE "IntegrationProvider" ADD VALUE 'googlesheets';
