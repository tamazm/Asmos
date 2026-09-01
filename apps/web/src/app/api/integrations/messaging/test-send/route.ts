import { NextResponse } from "next/server";
import { getAccountSession } from "@/lib/auth-adapter";
import { prisma } from "@/lib/prisma";
import { getAdapter } from "@/lib/integrations/registry";
import { renderTemplate } from "@/lib/integrations/template";
import { decryptSecret } from "@/lib/crypto";

export async function POST(req: Request) {
  const session = await getAccountSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { provider, templateId, testRecipient } = await req.json();
    if (!provider || !templateId || !testRecipient) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const conn = await prisma.integrationConnection.findUnique({
      where: { accountId_provider: { accountId: session.accountId, provider } }
    });
    if (!conn) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }

    const template = await prisma.messageTemplate.findUnique({
      where: { id: templateId }
    });
    if (!template || template.connectionId !== conn.id) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const adapter = getAdapter(provider as any);
    if (!adapter) {
      return NextResponse.json({ error: "Adapter not found" }, { status: 404 });
    }

    const vars = {
      "lead.name": "Test User",
      "lead.email": testRecipient,
      "lead.phone": testRecipient,
      "campaign.name": "Test Campaign",
      "variant.name": "Test Variant",
      "reward.label": "Test Reward",
      "reward.coupon_code": "TEST-CODE",
    };

    const renderedContent = {
      to: testRecipient,
      subject: template.subject ? renderTemplate(template.subject, vars) : null,
      body: renderTemplate(template.body, vars),
    };

    const secretsStr = conn.credentials ? await decryptSecret(conn.credentials as any) : "{}";
    const secrets = JSON.parse(secretsStr);

    const resolvedConn = {
      id: conn.id,
      accountId: conn.accountId,
      provider: conn.provider as any,
      enabled: conn.enabled,
      config: conn.config as any,
      subscribedEvents: conn.subscribedEvents,
      secrets,
    };

    const result = await adapter.deliver({
      event: { event: "lead.captured", payload: {} as any }, // Mock event
      connection: resolvedConn,
      renderedContent
    });

    if (result.status === "failed") {
      return NextResponse.json({ error: result.detail || "Delivery failed" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
