import { prisma } from "../prisma";
import { getAdapter } from "./registry";
import { encryptSecret } from "../crypto";
import type { IntegrationProvider } from "./types";
import { parseRules } from "./messagingRules";

const MESSAGING_PROVIDERS: IntegrationProvider[] = ["mailgun", "twilio"];

export interface MessagingConnectionView {
  provider: IntegrationProvider;
  connected: boolean;
  maskedKey: string | null;
  config: Record<string, unknown>;
  subscribedEvents: string[];
  rules: any[];
  templates: any[];
  lastDelivery: any | null;
}

export async function listMessagingConnectionViews(accountId: string): Promise<MessagingConnectionView[]> {
  const views: MessagingConnectionView[] = [];

  for (const provider of MESSAGING_PROVIDERS) {
    const conn = await prisma.integrationConnection.findUnique({
      where: { accountId_provider: { accountId, provider } },
      include: {
        templates: true,
        deliveries: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        }
      }
    });

    views.push({
      provider,
      connected: !!conn?.enabled,
      maskedKey: conn?.credentials ? "••••••••" : null,
      config: (conn?.config as any) || {},
      subscribedEvents: conn?.subscribedEvents || [],
      rules: conn ? parseRules(conn.rules) : [],
      templates: conn?.templates || [],
      lastDelivery: conn?.deliveries[0] || null,
    });
  }

  return views;
}

export async function saveMessagingConnection(
  accountId: string,
  provider: IntegrationProvider,
  input: { secrets?: Record<string, string>; config?: Record<string, string>; subscribedEvents?: string[] }
): Promise<void> {
  const adapter = getAdapter(provider);
  if (!adapter || adapter.kind !== "messaging") {
    throw new Error("Invalid messaging provider");
  }

  let existing = await prisma.integrationConnection.findUnique({
    where: { accountId_provider: { accountId, provider } }
  });

  const mergedConfig = { ...(existing?.config as any || {}), ...input.config };
  
  // We need to keep existing secrets if they aren't provided in the request
  let validationSecrets = input.secrets || {};
  if (existing && !input.secrets) {
    // skip validation of secrets if unchanged
  } else {
    const val = await adapter.validate({ config: mergedConfig, secrets: validationSecrets });
    if (!val.ok) {
      throw new Error(`Validation failed: ${val.error}`);
    }
  }

  let credentialsJson = existing?.credentials || null;
  if (input.secrets) {
    const encrypted = await encryptSecret(JSON.stringify(input.secrets));
    credentialsJson = encrypted as any;
  }

  if (existing) {
    await prisma.integrationConnection.update({
      where: { id: existing.id },
      data: {
        enabled: true,
        config: mergedConfig,
        credentials: credentialsJson as any,
        subscribedEvents: input.subscribedEvents ?? existing.subscribedEvents,
      }
    });
  } else {
    await prisma.integrationConnection.create({
      data: {
        accountId,
        provider,
        enabled: true,
        config: mergedConfig,
        credentials: credentialsJson as any,
        subscribedEvents: input.subscribedEvents ?? [],
        rules: "[]",
      }
    });
  }
}

export async function removeMessagingConnection(accountId: string, provider: IntegrationProvider): Promise<void> {
  await prisma.integrationConnection.deleteMany({
    where: { accountId, provider }
  });
}
