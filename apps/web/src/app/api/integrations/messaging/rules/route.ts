import { NextResponse } from "next/server";
import { getAccountSession } from "@/lib/auth-adapter";
import { getRules, saveRules } from "@/lib/integrations/manageMessagingRules";

export async function GET(req: Request) {
  const session = await getAccountSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const connectionId = searchParams.get("connectionId");
  if (!connectionId) return NextResponse.json({ error: "Missing connectionId" }, { status: 400 });

  const rules = await getRules(connectionId);
  return NextResponse.json(rules);
}

export async function PUT(req: Request) {
  const session = await getAccountSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const connectionId = searchParams.get("connectionId");
    if (!connectionId) return NextResponse.json({ error: "Missing connectionId" }, { status: 400 });

    const rules = await req.json();
    await saveRules(connectionId, rules);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
