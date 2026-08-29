import { prisma } from "@/lib/prisma";
import { encryptSecret, decryptSecret, type EncryptedSecret } from "./crypto";
import { isIntegrationProvider, type ResolvedConnection, type DeliveryResult } from "./types";

export function maskSecret(secret: string): string | null {
  if (!secret) return null;
  return `••••••••${secret.slice(-4)}`;
}

export function encryptBundle(secrets: Record<string, string>): EncryptedSecret {
  return encryptSecret(JSON.stringify(secrets));
}

function decryptBundle(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  try {
    return JSON.parse(decryptSecret(raw as EncryptedSecret)) as Record<string, string>;
  } catch {
    return {};
  }
}

/** Server-side only: load a connection with its secrets decrypted, ready for an adapter. */
export async function resolveConnection(id: string): Promise<ResolvedConnection | null> {
  const row = await prisma.integrationConnection.findUnique({ where: { id } });
  if (!row || !isIntegrationProvider(row.provider)) return null;
  return {
    id: row.id,
    accountId: row.accountId,
    provider: row.provider,
    enabled: row.enabled,
    config: (row.config as Record<string, unknown>) ?? {},
    subscribedEvents: row.subscribedEvents ?? [],
    secrets: decryptBundle(row.credentials),
  };
}

export async function recordDelivery(connectionId: string, event: string, result: DeliveryResult): Promise<void> {
  await prisma.integrationDelivery.create({
    data: { connectionId, event, status: result.status, detail: result.detail },
  });
}
