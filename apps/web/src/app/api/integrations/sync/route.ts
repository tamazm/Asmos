import { auth } from "@/lib/auth-adapter";
import { getOrCreateAccount } from "@/lib/account";
import {
  isSyncProvider,
  listSyncConnectionViews,
  saveSyncConnection,
  removeSyncConnection,
} from "@/lib/integrations/manageSyncConnections";

// ── GET /api/integrations/sync ───────────────────────────────────────
// Return connection state for the sync providers (klaviyo, mailchimp, hubspot)

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const account = await getOrCreateAccount();

  return Response.json({ connections: await listSyncConnectionViews(account.id) });
}

// ── PATCH /api/integrations/sync ─────────────────────────────────────
// Save (create or update) a sync connection. 

export async function PATCH(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    provider?: string;
    apiKey?: string;
    config?: Record<string, string>;
    subscribedEvents?: string[];
  };

  if (!isSyncProvider(body.provider)) {
    return Response.json({ error: "Unknown integration" }, { status: 400 });
  }

  const account = await getOrCreateAccount();

  try {
    const res = await saveSyncConnection(account.id, body.provider, {
      apiKey: body.apiKey?.trim(),
      config: body.config,
      subscribedEvents: body.subscribedEvents,
    });
    
    if (!res.ok) {
      return Response.json({ error: res.error }, { status: 400 });
    }
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to save" },
      { status: 400 },
    );
  }

  return Response.json({ connections: await listSyncConnectionViews(account.id) });
}

// ── DELETE /api/integrations/sync ────────────────────────────────────
// Remove a sync connection.

export async function DELETE(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { provider?: string };

  if (!isSyncProvider(body.provider)) {
    return Response.json({ error: "Unknown integration" }, { status: 400 });
  }

  const account = await getOrCreateAccount();

  await removeSyncConnection(account.id, body.provider);

  return Response.json({ connections: await listSyncConnectionViews(account.id) });
}
