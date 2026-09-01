import { NextResponse } from "next/server";
import { getAccountSession } from "@/lib/auth-adapter";
import { 
  listMessagingConnectionViews, 
  saveMessagingConnection, 
  removeMessagingConnection 
} from "@/lib/integrations/manageMessagingConnections";
import type { IntegrationProvider } from "@/lib/integrations/types";

export async function GET(req: Request) {
  const session = await getAccountSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  const views = await listMessagingConnectionViews(session.accountId);
  return NextResponse.json(views);
}

export async function PATCH(req: Request) {
  const session = await getAccountSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { provider, secrets, config, subscribedEvents } = body;
    
    if (!provider) {
      return NextResponse.json({ error: "Missing provider" }, { status: 400 });
    }

    await saveMessagingConnection(session.accountId, provider as IntegrationProvider, {
      secrets, config, subscribedEvents
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const session = await getAccountSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const provider = searchParams.get("provider") as IntegrationProvider;
    if (!provider) {
      return NextResponse.json({ error: "Missing provider param" }, { status: 400 });
    }

    await removeMessagingConnection(session.accountId, provider);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
