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
  return prisma.integrationConnection.findUnique({ where: { accountId_provider: { accountId, provider: "webhooks" } } });
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
  // If no URL is provided, we only want to update if it already exists (e.g. toggling enabled)
  if (!input.webhookUrl) {
    const existing = await findWebhook(accountId);
    if (!existing) return;

    const data: {
      enabled?: boolean;
      config?: { url: string } | Record<string, never>;
      credentials?: EncryptedSecret;
    } = {};
    if ("webhookEnabled" in input) data.enabled = Boolean(input.webhookEnabled);
    if ("webhookUrl" in input) data.config = input.webhookUrl ? { url: input.webhookUrl } : {};
    if ("webhookSecret" in input) {
      data.credentials = encryptBundle(input.webhookSecret ? { signingSecret: input.webhookSecret } : {});
    }
    await prisma.integrationConnection.update({ where: { id: existing.id }, data });
    return;
  }

  const updateData: {
    enabled?: boolean;
    config?: { url: string };
    credentials?: EncryptedSecret;
  } = {};
  if ("webhookEnabled" in input) updateData.enabled = Boolean(input.webhookEnabled);
  if ("webhookUrl" in input) updateData.config = { url: input.webhookUrl };
  if ("webhookSecret" in input) {
    updateData.credentials = encryptBundle(input.webhookSecret ? { signingSecret: input.webhookSecret } : {});
  }

  await prisma.integrationConnection.upsert({
    where: { accountId_provider: { accountId, provider: "webhooks" } },
    update: updateData,
    create: {
      accountId,
      provider: "webhooks",
      enabled: "webhookEnabled" in input ? Boolean(input.webhookEnabled) : true,
      config: { url: input.webhookUrl },
      credentials: input.webhookSecret ? encryptBundle({ signingSecret: input.webhookSecret }) : undefined,
      subscribedEvents: DEFAULT_EVENTS,
    },
  });
}
