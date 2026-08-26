import type { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth-adapter";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";

// ── Facade-integration API-key storage ──────────────────────────────────────
// Klaviyo, Mailchimp, HubSpot, Shopify, Zapier. Webhooks has its own route
// (/api/account/webhook) since it predates this and has extra fields
// (signing secret, enabled flag) that don't apply here.
//
// This only stores and returns the key - nothing reads it yet to actually
// forward leads to these providers. That sync job doesn't exist yet.

const KNOWN_INTEGRATION_IDS = ["klaviyo", "mailchimp", "hubspot", "shopify", "zapier"] as const;
type IntegrationId = (typeof KNOWN_INTEGRATION_IDS)[number];

function isKnownIntegrationId(id: unknown): id is IntegrationId {
  return typeof id === "string" && (KNOWN_INTEGRATION_IDS as readonly string[]).includes(id);
}

interface StoredCredential {
  apiKey: string;
  connectedAt: string;
}

function readCredentials(raw: unknown): Partial<Record<IntegrationId, StoredCredential>> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as Partial<Record<IntegrationId, StoredCredential>>;
}

function maskKey(key: string) {
  return `••••••••${key.slice(-4)}`;
}

// ── GET /api/account/integrations ───────────────────────────────────────────
// Returns connection status for every known integration.

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const account = await getOrCreateAccount();
  const creds = readCredentials(account.integrationCredentials);

  const status: Record<IntegrationId, { connected: boolean; maskedKey: string | null; connectedAt: string | null }> =
    {} as never;
  for (const id of KNOWN_INTEGRATION_IDS) {
    const entry = creds[id];
    status[id] = {
      connected: Boolean(entry?.apiKey),
      maskedKey: entry?.apiKey ? maskKey(entry.apiKey) : null,
      connectedAt: entry?.connectedAt ?? null,
    };
  }

  return Response.json({ integrations: status });
}

// ── PATCH /api/account/integrations ─────────────────────────────────────────
// Body: { integrationId, apiKey?, connected }
// connected: true  -> requires a non-empty apiKey, stores it
// connected: false -> removes any stored key for that integration

export async function PATCH(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    integrationId?: string;
    apiKey?: string;
    connected?: boolean;
  };

  if (!isKnownIntegrationId(body.integrationId)) {
    return Response.json({ error: "Unknown integration" }, { status: 400 });
  }
  const integrationId = body.integrationId;

  const account = await getOrCreateAccount();
  const creds = { ...readCredentials(account.integrationCredentials) };

  if (body.connected === false) {
    delete creds[integrationId];
  } else {
    const apiKey = body.apiKey?.trim() ?? "";
    if (apiKey.length < 8) {
      return Response.json({ error: "API key looks too short - double-check you pasted the whole thing." }, { status: 400 });
    }
    creds[integrationId] = { apiKey, connectedAt: new Date().toISOString() };
  }

  const updated = await prisma.account.update({
    where: { id: account.id },
    data: { integrationCredentials: creds as Prisma.InputJsonValue },
  });

  const updatedCreds = readCredentials(updated.integrationCredentials);
  const entry = updatedCreds[integrationId];

  return Response.json({
    integrationId,
    connected: Boolean(entry?.apiKey),
    maskedKey: entry?.apiKey ? maskKey(entry.apiKey) : null,
    connectedAt: entry?.connectedAt ?? null,
  });
}
