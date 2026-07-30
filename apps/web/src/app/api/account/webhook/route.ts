import { auth } from "@/lib/auth-adapter";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";

// ── GET /api/account/webhook ────────────────────────────────────────────────
// Return current webhook config. Secret is masked: only last 4 chars shown.

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const account = await getOrCreateAccount();

  const maskedSecret = account.webhookSecret
    ? `••••••••${account.webhookSecret.slice(-4)}`
    : null;

  return Response.json({
    webhookUrl: account.webhookUrl ?? null,
    webhookSecret: maskedSecret,
    webhookEnabled: account.webhookEnabled,
  });
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

  const data: {
    webhookUrl?: string | null;
    webhookSecret?: string | null;
    webhookEnabled?: boolean;
  } = {};

  // Validate + set URL
  if ("webhookUrl" in body) {
    if (body.webhookUrl === null || body.webhookUrl === "") {
      // Clearing the URL
      data.webhookUrl = null;
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
      data.webhookUrl = url;
    }
  }

  // Set secret (allow clearing)
  if ("webhookSecret" in body) {
    data.webhookSecret =
      body.webhookSecret && body.webhookSecret.trim().length > 0
        ? body.webhookSecret.trim()
        : null;
  }

  // Set enabled flag
  if ("webhookEnabled" in body) {
    data.webhookEnabled = Boolean(body.webhookEnabled);
  }

  const updated = await prisma.account.update({
    where: { id: account.id },
    data,
  });

  const maskedSecret = updated.webhookSecret
    ? `••••••••${updated.webhookSecret.slice(-4)}`
    : null;

  return Response.json({
    webhookUrl: updated.webhookUrl ?? null,
    webhookSecret: maskedSecret,
    webhookEnabled: updated.webhookEnabled,
  });
}
