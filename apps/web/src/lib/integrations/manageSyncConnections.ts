import { prisma } from "@/lib/prisma";
import { encryptBundle, maskSecret } from "./connections";
import { decryptSecret, type EncryptedSecret } from "./crypto";
import { getAdapter } from "./registry";

/**
 * Sync providers store their credentials in the shared `credentials` column as
 * an AES-256-GCM EncryptedSecret. Legacy API-key connections use `{ apiKey }`;
 * OAuth connections use a provider-specific secret bundle.
 */
function readSecrets(raw: unknown): Record<string, string> {
  if (!raw) return {};
  try {
    return JSON.parse(decryptSecret(raw as EncryptedSecret)) as Record<string, string>;
  } catch {
    return {};
  }
}

const SYNC_PROVIDERS = ["klaviyo", "mailchimp", "hubspot", "omnisend", "brevo", "mailerlite", "drip"] as const;
export type SyncProvider = (typeof SYNC_PROVIDERS)[number];

export function isSyncProvider(p: unknown): p is SyncProvider {
  return typeof p === "string" && (SYNC_PROVIDERS as readonly string[]).includes(p);
}

export interface SyncConnectionView {
  provider: SyncProvider;
  connected: boolean;
  maskedKey: string | null;
  authType: "apiKey" | "oauth" | null;
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
    const row = rows.find((r: (typeof rows)[number]) => r.provider === provider);
    if (!row || !row.enabled) {
      return { provider, connected: false, maskedKey: null, authType: null, config: {}, subscribedEvents: [], lastDelivery: null };
    }

    const secrets = readSecrets(row.credentials);
    const secret = secrets.apiKey || secrets.accessToken || "";
    const maskedKey = secret ? maskSecret(secret) : null;

    const config = (row.config as Record<string, string>) || {};
    const last = row.deliveries[0];

    return {
      provider,
      connected: true,
      maskedKey,
      authType: secrets.accessToken ? "oauth" : secrets.apiKey ? "apiKey" : null,
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

  if (provider === "mailchimp" && input.apiKey) {
    return { ok: false, error: "Mailchimp connections must use OAuth. API keys are not accepted." };
  }

  const existing = await prisma.integrationConnection.findUnique({
    where: { accountId_provider: { accountId, provider } }
  });

  const existingSecrets = existing ? readSecrets(existing.credentials) : {};
  let secretsToStore = existingSecrets;
  if (input.apiKey !== undefined && input.apiKey !== "") {
    secretsToStore = { apiKey: input.apiKey };
  }
  
  if (!secretsToStore.apiKey && !secretsToStore.accessToken) {
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
    secrets: secretsToStore,
    config: newConfig
  });
  
  if (!validationResult.ok) {
    return { ok: false, error: validationResult.error || "Invalid credentials or configuration" };
  }

  const updateData = {
    enabled: true,
    config: newConfig,
    credentials: input.apiKey ? encryptBundle({ apiKey: input.apiKey }) : existing?.credentials,
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
