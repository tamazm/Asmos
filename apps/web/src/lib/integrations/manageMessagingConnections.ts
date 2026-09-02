import { prisma } from "../prisma";
import { getAdapter } from "./registry";
import { decryptSecret, encryptSecret, type EncryptedSecret } from "../crypto";
import type { IntegrationProvider } from "./types";
import { parseRules } from "./messagingRules";

const MESSAGING_PROVIDERS: IntegrationProvider[] = ["mailgun", "twilio"];

export interface MessagingConnectionView {
  provider: IntegrationProvider;
  connected: boolean;
  maskedKey: string | null;
  authType: "apiKey" | "restrictedApiKey" | "authToken" | null;
  config: Record<string, unknown>;
  subscribedEvents: string[];
  rules: any[];
  templates: any[];
  lastDelivery: any | null;
}

function readSecrets(raw: unknown): Record<string, string> {
  if (!raw) return {};
  try {
    return JSON.parse(decryptSecret(raw as EncryptedSecret)) as Record<string, string>;
  } catch {
    return {};
  }
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

    const secrets = readSecrets(conn?.credentials);

    views.push({
      provider,
      connected: !!conn?.enabled,
      authType: provider === "twilio"
        ? secrets.apiKeySecret ? "restrictedApiKey" : secrets.authToken ? "authToken" : null
        : secrets.apiKey ? "apiKey" : null,
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

  if (provider === "twilio" && input.secrets?.authToken && !input.secrets.apiKeySecret) {
    throw new Error("Twilio connections must use a Restricted API Key, not an Auth Token.");
  }

  const existing = await prisma.integrationConnection.findUnique({
    where: { accountId_provider: { accountId, provider } }
  });

  const mergedConfig = { ...(existing?.config as any || {}), ...input.config };
  
  // We need to keep existing secrets if they aren't provided in the request
  const validationSecrets = input.secrets || {};
  const hasNewSecrets = Object.keys(validationSecrets).length > 0;
  if (existing && !hasNewSecrets) {
    // skip validation of secrets if unchanged
  } else {
    const val = await adapter.validate({ config: mergedConfig, secrets: validationSecrets });
    if (!val.ok) {
      throw new Error(`Validation failed: ${val.error}`);
    }
  }

  let credentialsJson = existing?.credentials || null;
  if (hasNewSecrets) {
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
