import { prisma } from "@/lib/prisma";
import { encryptSecret, decryptSecret } from "./crypto";
import { getAdapter } from "./registry";

const SYNC_PROVIDERS = ["klaviyo", "mailchimp", "hubspot"] as const;
export type SyncProvider = (typeof SYNC_PROVIDERS)[number];

export function isSyncProvider(p: unknown): p is SyncProvider {
  return typeof p === "string" && (SYNC_PROVIDERS as readonly string[]).includes(p);
}

export interface SyncConnectionView {
  provider: SyncProvider;
  connected: boolean;
  maskedKey: string | null;
  config: Record<string, string>;
  subscribedEvents: string[];
  lastDelivery: { status: string; at: string } | null;
}

const CANONICAL_EVENTS = ["lead.captured"]; // Sync providers generally only handle this

export async function listSyncConnectionViews(accountId: string): Promise<SyncConnectionView[]> {
  const rows = await prisma.integrationConnection.findMany({
    where: { accountId, provider: { in: [...SYNC_PROVIDERS] } },
    include: { deliveries: { orderBy: { createdAt: "desc" }, take: 1 } },
  });

  return SYNC_PROVIDERS.map((provider): SyncConnectionView => {
    const row = rows.find((r) => r.provider === provider);
    if (!row || !row.enabled) {
      return { provider, connected: false, maskedKey: null, config: {}, subscribedEvents: [], lastDelivery: null };
    }

    let maskedKey: string | null = null;
    const secrets = row.secrets as { apiKey?: any };
    if (secrets?.apiKey) {
      const apiKey = decryptSecret(secrets.apiKey);
      if (apiKey.length > 4) {
        maskedKey = "•".repeat(8) + apiKey.slice(-4);
      } else {
        maskedKey = "•".repeat(8);
      }
    }

    const config = (row.config as Record<string, string>) || {};
    const last = row.deliveries[0];

    return {
      provider,
      connected: true,
      maskedKey,
      config,
      subscribedEvents: row.subscribedEvents ?? [],
      lastDelivery: last ? { status: last.status, at: last.createdAt.toISOString() } : null,
    };
  });
}

export async function saveSyncConnection(
  accountId: string,
  provider: SyncProvider,
  input: { apiKey?: string; config?: Record<string, string>; subscribedEvents?: string[] },
): Promise<{ ok: boolean; error?: string }> {
  if (!isSyncProvider(provider)) throw new Error(`Unknown sync provider: ${String(provider)}`);

  const existing = await prisma.integrationConnection.findUnique({
    where: { accountId_provider: { accountId, provider } }
  });

  let apiKeyToStore = existing && existing.secrets ? decryptSecret((existing.secrets as any).apiKey) : "";
  if (input.apiKey !== undefined && input.apiKey !== "") {
    apiKeyToStore = input.apiKey;
  }
  
  if (!apiKeyToStore) {
    return { ok: false, error: "API key is required" };
  }

  const newConfig = { ...((existing?.config as Record<string, string>) || {}), ...(input.config || {}) };
  const events = input.subscribedEvents?.filter((e) => CANONICAL_EVENTS.includes(e)) ?? existing?.subscribedEvents ?? CANONICAL_EVENTS;

  // Validate via adapter
  const adapter = getAdapter(provider);
  if (!adapter) {
    return { ok: false, error: `No adapter found for provider: ${provider}` };
  }
  
  const validationResult = await adapter.validate({
    secrets: { apiKey: apiKeyToStore },
    config: newConfig
  });
  
  if (!validationResult.ok) {
    return { ok: false, error: validationResult.error || "Invalid credentials or configuration" };
  }

  const updateData = {
    enabled: true,
    config: newConfig,
    secrets: { apiKey: encryptSecret(apiKeyToStore) },
    subscribedEvents: events
  };

  await prisma.integrationConnection.upsert({
    where: { accountId_provider: { accountId, provider } },
    update: updateData,
    create: {
      accountId,
      provider,
      ...updateData
    }
  });

  return { ok: true };
}

export async function removeSyncConnection(accountId: string, provider: SyncProvider): Promise<void> {
  if (!isSyncProvider(provider)) throw new Error(`Unknown sync provider: ${String(provider)}`);
  await prisma.integrationConnection.deleteMany({ where: { accountId, provider } });
}
