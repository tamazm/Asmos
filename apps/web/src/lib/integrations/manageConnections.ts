import { prisma } from "@/lib/prisma";
import { encryptBundle, maskSecret } from "./connections";
import { decryptSecret, type EncryptedSecret } from "./crypto";

const URL_PROVIDERS = ["zapier", "make", "n8n", "slack", "discord", "teams"] as const;
type UrlProvider = (typeof URL_PROVIDERS)[number];
const CANONICAL_EVENTS = ["lead.captured", "variant.winner_declared"];

export function isUrlProvider(p: unknown): p is UrlProvider {
  return typeof p === "string" && (URL_PROVIDERS as readonly string[]).includes(p);
}

export interface ConnectionView {
  provider: UrlProvider;
  connected: boolean;
  url: string | null;
  subscribedEvents: string[];
  maskedSecret: string | null;
  lastDelivery: { status: string; at: string } | null;
}

interface ConnectionRow {
  provider: string;
  enabled: boolean;
  config: unknown;
  credentials: unknown;
  subscribedEvents: string[];
  deliveries: { status: string; createdAt: Date }[];
}

/** Decrypt a connection's credentials bundle and return the masked signing secret, if any. */
function maskConnectionSecret(credentials: unknown): string | null {
  if (!credentials) return null;
  try {
    const bundle = JSON.parse(decryptSecret(credentials as EncryptedSecret)) as { signingSecret?: string };
    return bundle.signingSecret ? maskSecret(bundle.signingSecret) : null;
  } catch {
    return null;
  }
}

export async function listConnectionViews(accountId: string): Promise<ConnectionView[]> {
  const rows: ConnectionRow[] = await prisma.integrationConnection.findMany({
    where: { accountId, provider: { in: [...URL_PROVIDERS] } },
    include: { deliveries: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  return URL_PROVIDERS.map((provider): ConnectionView => {
    const row = rows.find((r: ConnectionRow) => r.provider === provider);
    if (!row || !row.enabled) {
      return { provider, connected: false, url: null, subscribedEvents: [], maskedSecret: null, lastDelivery: null };
    }
    const url = (row.config as { url?: string } | null)?.url ?? null;
    const last = row.deliveries[0];
    return {
      provider,
      connected: Boolean(url),
      url,
      subscribedEvents: row.subscribedEvents ?? [],
      maskedSecret: maskConnectionSecret(row.credentials),
      lastDelivery: last ? { status: last.status, at: last.createdAt.toISOString() } : null,
    };
  });
}

export async function saveConnection(
  accountId: string,
  provider: UrlProvider,
  input: { url?: string; subscribedEvents?: string[]; signingSecret?: string | null },
): Promise<void> {
  if (!isUrlProvider(provider)) throw new Error(`Unknown provider: ${String(provider)}`);
  if (input.url !== undefined && !input.url.startsWith("https://")) {
    throw new Error("Endpoint URL must start with https://");
  }
  const events = input.subscribedEvents?.filter((e) => CANONICAL_EVENTS.includes(e));
  // undefined = leave unchanged; "" = clear the secret; non-empty = set/rotate it.
  const credentials =
    input.signingSecret === undefined
      ? undefined
      : encryptBundle(input.signingSecret ? { signingSecret: input.signingSecret } : {});

  if (input.url === undefined) {
    const existing = await prisma.integrationConnection.findUnique({ where: { accountId_provider: { accountId, provider } } });
    if (!existing) throw new Error("A URL is required to create a connection");

    const data: { enabled?: boolean; config?: { url: string }; subscribedEvents?: string[]; credentials?: EncryptedSecret } = {};
    if (events !== undefined) data.subscribedEvents = events;
    if (credentials !== undefined) data.credentials = credentials;
    await prisma.integrationConnection.update({ where: { id: existing.id }, data });
    return;
  }

  const updateData: { enabled?: boolean; config?: { url: string }; subscribedEvents?: string[]; credentials?: EncryptedSecret } = {};
  updateData.config = { url: input.url };
  updateData.enabled = true;
  if (events !== undefined) updateData.subscribedEvents = events;
  if (credentials !== undefined) updateData.credentials = credentials;

  await prisma.integrationConnection.upsert({
    where: { accountId_provider: { accountId, provider } },
    update: updateData,
    create: {
      accountId,
      provider,
      enabled: true,
      config: { url: input.url },
      subscribedEvents: events ?? CANONICAL_EVENTS,
      credentials,
    },
  });
}

export async function removeConnection(accountId: string, provider: UrlProvider): Promise<void> {
  await prisma.integrationConnection.deleteMany({ where: { accountId, provider } });
}
