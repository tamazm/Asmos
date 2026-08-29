import { auth } from "@/lib/auth-adapter";
import { getOrCreateAccount } from "@/lib/account";
import {
  isUrlProvider,
  listConnectionViews,
  saveConnection,
  removeConnection,
} from "@/lib/integrations/manageConnections";

// ── GET /api/integrations/connections ───────────────────────────────────────
// Return connection state for the six URL-based providers (zapier, make,
// n8n, slack, discord, teams).

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const account = await getOrCreateAccount();

  return Response.json({ connections: await listConnectionViews(account.id) });
}

// ── PATCH /api/integrations/connections ─────────────────────────────────────
// Save (create or update) a connection. Body: { provider, url?, subscribedEvents? }.

export async function PATCH(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    provider?: string;
    url?: string;
    subscribedEvents?: string[];
  };

  if (!isUrlProvider(body.provider)) {
    return Response.json({ error: "Unknown integration" }, { status: 400 });
  }

  const account = await getOrCreateAccount();

  try {
    await saveConnection(account.id, body.provider, {
      url: body.url?.trim(),
      subscribedEvents: body.subscribedEvents,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to save" },
      { status: 400 },
    );
  }

  return Response.json({ connections: await listConnectionViews(account.id) });
}

// ── DELETE /api/integrations/connections ────────────────────────────────────
// Remove a connection. Body: { provider }.

export async function DELETE(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { provider?: string };

  if (!isUrlProvider(body.provider)) {
    return Response.json({ error: "Unknown integration" }, { status: 400 });
  }

  const account = await getOrCreateAccount();

  await removeConnection(account.id, body.provider);

  return Response.json({ connections: await listConnectionViews(account.id) });
}
