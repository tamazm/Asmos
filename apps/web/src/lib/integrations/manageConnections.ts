import { prisma } from "@/lib/prisma";

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
  lastDelivery: { status: string; at: string } | null;
}

interface ConnectionRow {
  provider: string;
  enabled: boolean;
  config: unknown;
  subscribedEvents: string[];
  deliveries: { status: string; createdAt: Date }[];
}

export async function listConnectionViews(accountId: string): Promise<ConnectionView[]> {
  const rows: ConnectionRow[] = await prisma.integrationConnection.findMany({
    where: { accountId, provider: { in: [...URL_PROVIDERS] } },
    include: { deliveries: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  return URL_PROVIDERS.map((provider): ConnectionView => {
    const row = rows.find((r: ConnectionRow) => r.provider === provider);
    if (!row || !row.enabled) {
      return { provider, connected: false, url: null, subscribedEvents: [], lastDelivery: null };
    }
    const url = (row.config as { url?: string } | null)?.url ?? null;
    const last = row.deliveries[0];
    return {
      provider,
      connected: Boolean(url),
      url,
      subscribedEvents: row.subscribedEvents ?? [],
      lastDelivery: last ? { status: last.status, at: last.createdAt.toISOString() } : null,
    };
  });
}

export async function saveConnection(
  accountId: string,
  provider: UrlProvider,
  input: { url?: string; subscribedEvents?: string[] },
): Promise<void> {
  if (!isUrlProvider(provider)) throw new Error(`Unknown provider: ${String(provider)}`);
  if (input.url !== undefined && !input.url.startsWith("https://")) {
    throw new Error("Endpoint URL must start with https://");
  }
  const events = input.subscribedEvents?.filter((e) => CANONICAL_EVENTS.includes(e));

  const existing = await prisma.integrationConnection.findFirst({ where: { accountId, provider } });

  if (existing) {
    const data: { enabled?: boolean; config?: { url: string }; subscribedEvents?: string[] } = {};
    if (input.url !== undefined) {
      data.config = { url: input.url };
      data.enabled = true;
    }
    if (events !== undefined) data.subscribedEvents = events;
    await prisma.integrationConnection.update({ where: { id: existing.id }, data });
    return;
  }

  if (!input.url) throw new Error("A URL is required to create a connection");
  await prisma.integrationConnection.create({
    data: {
      accountId,
      provider,
      enabled: true,
      config: { url: input.url },
      subscribedEvents: events ?? CANONICAL_EVENTS,
    },
  });
}

export async function removeConnection(accountId: string, provider: UrlProvider): Promise<void> {
  await prisma.integrationConnection.deleteMany({ where: { accountId, provider } });
}
