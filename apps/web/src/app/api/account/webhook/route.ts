import { auth } from "@/lib/auth-adapter";
import { getOrCreateAccount } from "@/lib/account";
import { getWebhookView, saveWebhook } from "@/lib/integrations/webhookConnection";

// ── GET /api/account/webhook ────────────────────────────────────────────────
// Return current webhook config, backed by IntegrationConnection (provider
// "webhooks"). Secret is masked: only last 4 chars shown.

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const account = await getOrCreateAccount();

  return Response.json(await getWebhookView(account.id));
}

// ── PATCH /api/account/webhook ──────────────────────────────────────────────
// Save webhook URL, secret, and enabled flag.
// URL must be https://. Secret is optional but validated non-empty if provided.

export async function PATCH(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    webhookUrl?: string;
    webhookSecret?: string;
    webhookEnabled?: boolean;
  };

  const account = await getOrCreateAccount();

  const input: {
    webhookUrl?: string | null;
    webhookSecret?: string | null;
    webhookEnabled?: boolean;
  } = {};

  // Validate + set URL
  if ("webhookUrl" in body) {
    if (body.webhookUrl === null || body.webhookUrl === "") {
      // Clearing the URL
      input.webhookUrl = null;
    } else {
      const url = body.webhookUrl?.trim() ?? "";
      if (!url.startsWith("https://")) {
        return Response.json(
          { error: "webhookUrl must be a valid https:// URL" },
          { status: 400 },
        );
      }
      try {
        new URL(url); // validate full URL structure
      } catch {
        return Response.json(
          { error: "webhookUrl is not a valid URL" },
          { status: 400 },
        );
      }
      input.webhookUrl = url;
    }
  }

  // Set secret (allow clearing)
  if ("webhookSecret" in body) {
    input.webhookSecret =
      body.webhookSecret && body.webhookSecret.trim().length > 0
        ? body.webhookSecret.trim()
        : null;
  }

  // Set enabled flag
  if ("webhookEnabled" in body) {
    input.webhookEnabled = Boolean(body.webhookEnabled);
  }

  await saveWebhook(account.id, input);

  return Response.json(await getWebhookView(account.id));
}
