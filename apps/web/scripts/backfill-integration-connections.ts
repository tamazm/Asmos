/**
 * One-time backfill: migrate legacy Account.webhook* columns and the
 * integrationCredentials JSON blob into IntegrationConnection rows.
 * Idempotent: skips an (account, provider) that already has a connection.
 * Run with: npx tsx scripts/backfill-integration-connections.ts
 */
import { prisma } from "../src/lib/prisma";
import { encryptBundle } from "../src/lib/integrations/connections";

const SYNC_PROVIDERS = ["klaviyo", "mailchimp", "hubspot"] as const;
const DEFAULT_EVENTS = ["lead.captured", "variant.winner_declared"];

async function main() {
  const accounts = await prisma.account.findMany({
    select: { id: true, webhookUrl: true, webhookSecret: true, webhookEnabled: true, integrationCredentials: true },
  });

  let created = 0;
  for (const acc of accounts) {
    const existing = await prisma.integrationConnection.findMany({
      where: { accountId: acc.id }, select: { provider: true },
    });
    const have = new Set(existing.map((e: { provider: string }) => e.provider));

    // Webhooks
    if (acc.webhookUrl && !have.has("webhooks")) {
      await prisma.integrationConnection.create({
        data: {
          accountId: acc.id, provider: "webhooks", enabled: Boolean(acc.webhookEnabled),
          config: { url: acc.webhookUrl },
          credentials: acc.webhookSecret ? encryptBundle({ signingSecret: acc.webhookSecret }) : undefined,
          subscribedEvents: DEFAULT_EVENTS,
        },
      });
      created++;
    }

    // Sync providers from integrationCredentials JSON: { [id]: { apiKey, connectedAt } }
    const creds = (acc.integrationCredentials as Record<string, { apiKey?: string }> | null) ?? {};
    for (const provider of SYNC_PROVIDERS) {
      const apiKey = creds[provider]?.apiKey;
      if (apiKey && !have.has(provider)) {
        await prisma.integrationConnection.create({
          data: {
            accountId: acc.id, provider, enabled: true, config: {},
            credentials: encryptBundle({ apiKey }),
            subscribedEvents: ["lead.captured"],
          },
        });
        created++;
      }
    }
    // NOTE: creds.zapier is intentionally skipped — the facade key has no target
    // in the URL-based Zapier adapter.
  }

  console.log(`Backfill complete. Created ${created} connections across ${accounts.length} accounts.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
