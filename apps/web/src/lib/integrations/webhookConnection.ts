import { prisma } from "@/lib/prisma";
import { encryptBundle, maskSecret } from "./connections";
import { decryptSecret, type EncryptedSecret } from "./crypto";

const DEFAULT_EVENTS = ["lead.captured", "variant.winner_declared"];

export interface WebhookView {
  webhookUrl: string | null;
  webhookSecret: string | null; // masked
  webhookEnabled: boolean;
}

async function findWebhook(accountId: string) {
  return prisma.integrationConnection.findFirst({ where: { accountId, provider: "webhooks" } });
}

export async function getWebhookView(accountId: string): Promise<WebhookView> {
  const row = await findWebhook(accountId);
  if (!row || !row.enabled) {
    return { webhookUrl: null, webhookSecret: null, webhookEnabled: false };
  }
  const config = (row.config as { url?: string }) ?? {};
  let masked: string | null = null;
  if (row.credentials) {
    try {
      const bundle = JSON.parse(decryptSecret(row.credentials as EncryptedSecret)) as { signingSecret?: string };
      masked = bundle.signingSecret ? maskSecret(bundle.signingSecret) : null;
    } catch {
      masked = null;
    }
  }
  return { webhookUrl: config.url ?? null, webhookSecret: masked, webhookEnabled: true };
}

export async function saveWebhook(
  accountId: string,
  input: { webhookUrl?: string | null; webhookSecret?: string | null; webhookEnabled?: boolean },
): Promise<void> {
  const existing = await findWebhook(accountId);

  if (existing) {
    // Field-conditional update: only touch a column when the caller actually
    // provided that key, so a partial PATCH (e.g. a bare enable/disable, or a
    // secret-only change) never wipes the stored URL or secret.
    const data: {
      enabled?: boolean;
      config?: { url: string } | Record<string, never>;
      credentials?: EncryptedSecret;
    } = {};
    if ("webhookEnabled" in input) data.enabled = Boolean(input.webhookEnabled);
    if ("webhookUrl" in input) data.config = input.webhookUrl ? { url: input.webhookUrl } : {};
    if ("webhookSecret" in input) {
      // A provided-but-empty secret clears it, stored as an empty (still
      // encrypted) bundle so the column stays a valid EncryptedSecret.
      data.credentials = encryptBundle(input.webhookSecret ? { signingSecret: input.webhookSecret } : {});
    }
    await prisma.integrationConnection.update({ where: { id: existing.id }, data });
    return;
  }

  // No existing connection. Only create one when there's a URL to store — a bare
  // disable or secret change against a nonexistent connection is a no-op.
  if (!input.webhookUrl) return;

  await prisma.integrationConnection.create({
    data: {
      accountId,
      provider: "webhooks",
      enabled: "webhookEnabled" in input ? Boolean(input.webhookEnabled) : true,
      config: { url: input.webhookUrl },
      credentials: input.webhookSecret ? encryptBundle({ signingSecret: input.webhookSecret }) : undefined,
      subscribedEvents: DEFAULT_EVENTS,
    },
  });
}
