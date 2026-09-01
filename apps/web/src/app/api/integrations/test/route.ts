import { NextResponse } from "next/server";
import { getAccountSession } from "@/lib/auth-adapter";
import { prisma } from "@/lib/prisma";
import { resolveConnection } from "@/lib/integrations/connections";
import { getAdapter } from "@/lib/integrations/registry";
import type { IntegrationEvent } from "@/lib/integrations/types";
import { isIntegrationProvider } from "@/lib/integrations/types";

const TEST_EVENT: IntegrationEvent = {
  event: "lead.captured",
  payload: {
    campaign_id: "test-campaign",
    campaign_name: "Asmos connection test",
    variant_id: "test-variant",
    variant_name: "Test variant",
    lead: {
      email: "test@example.com",
      name: "Asmos Test",
      phone: null,
      consent_given: true,
      captured_at: new Date().toISOString(),
    },
    reward: null,
    test: true,
  },
};

export async function POST(request: Request) {
  const session = await getAccountSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { provider?: string };
  if (!isIntegrationProvider(body.provider)) {
    return NextResponse.json({ error: "Unknown integration" }, { status: 400 });
  }

  const connection = await prisma.integrationConnection.findUnique({
    where: { accountId_provider: { accountId: session.accountId, provider: body.provider } },
  });
  if (!connection || !connection.enabled) {
    return NextResponse.json({ error: "Connect this integration before testing it." }, { status: 404 });
  }

  const adapter = getAdapter(body.provider);
  const resolved = await resolveConnection(connection.id);
  if (!adapter || !resolved) {
    return NextResponse.json({ error: "Integration adapter is unavailable." }, { status: 500 });
  }

  if (adapter.kind === "webhook") {
    const result = await adapter.deliver({ event: TEST_EVENT, connection: resolved });
    if (result.status === "failed") {
      return NextResponse.json({ error: result.detail ?? "The test request failed." }, { status: 502 });
    }
    return NextResponse.json({ ok: true, message: "Test request delivered." });
  }

  const result = await adapter.validate({ config: resolved.config, secrets: resolved.secrets });
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "The saved credentials could not be verified." }, { status: 422 });
  }

  return NextResponse.json({ ok: true, message: "Credentials verified." });
}
