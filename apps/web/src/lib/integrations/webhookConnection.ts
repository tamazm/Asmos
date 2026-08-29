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

  if (input.webhookEnabled === false) {
    if (existing) {
      await prisma.integrationConnection.upsert({
        where: { id: existing.id },
        update: { enabled: false },
        create: { accountId, provider: "webhooks", enabled: false, config: {}, subscribedEvents: DEFAULT_EVENTS },
      });
    }
    return;
  }

  const credentials = input.webhookSecret ? encryptBundle({ signingSecret: input.webhookSecret }) : existing?.credentials ?? undefined;

  await prisma.integrationConnection.upsert({
    where: { id: existing?.id ?? "__none__" },
    update: {
      enabled: true,
      config: { url: input.webhookUrl },
      ...(input.webhookSecret ? { credentials } : {}),
    },
    create: {
      accountId,
      provider: "webhooks",
      enabled: true,
      config: { url: input.webhookUrl },
      credentials,
      subscribedEvents: DEFAULT_EVENTS,
    },
  });
}
