import { auth, currentUser } from "@/lib/auth-adapter";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { isSuperadminEmail } from "@/lib/superadmin";

// ── GET /api/account/shopify-request ────────────────────────────────────────
// Lets the Integrations tab know on load whether this account already asked,
// so the button renders "Requested" instead of "Request Shopify integration"
// after a page refresh.

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const account = await getOrCreateAccount();
  const existing = await prisma.shopifyIntegrationRequest.findUnique({
    where: { accountId: account.id },
  });
  return Response.json({ requested: Boolean(existing), requestedAt: existing?.createdAt ?? null });
}

// ── POST /api/account/shopify-request ───────────────────────────────────────
// Logs interest in the (not-yet-built) Shopify OAuth integration. One row per
// account — see @@unique on the model — so this is safe to call again; it
// just returns the existing request instead of erroring or duplicating.
// Also drops a Notification for every superadmin account so it surfaces in
// their bell, plus it's listable at /admin/shopify-requests.

export async function POST() {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const account = await getOrCreateAccount();
  const email = user.primaryEmailAddress?.emailAddress ?? "";
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || null;

  if (!email) {
    return Response.json({ error: "No email on file for this account." }, { status: 400 });
  }

  const existing = await prisma.shopifyIntegrationRequest.findUnique({
    where: { accountId: account.id },
  });
  if (existing) {
    return Response.json({ requested: true, requestedAt: existing.createdAt });
  }

  const storeUrl = account.websites?.[0]?.url ?? null;

  const request = await prisma.shopifyIntegrationRequest.create({
    data: { accountId: account.id, email, name, storeUrl },
  });

  // Best-effort: a failure to notify shouldn't fail the request itself —
  // the row above is the durable record; /admin/shopify-requests always
  // has it even if the bell doesn't.
  try {
    const superadminUsers = await prisma.user.findMany({
      select: { accountId: true, email: true },
    });
    const superadminAccountIds: string[] = Array.from(
      new Set(
        superadminUsers
          .filter((u: { accountId: string; email: string }) => isSuperadminEmail(u.email))
          .map((u: { accountId: string; email: string }) => u.accountId),
      ),
    );
    if (superadminAccountIds.length > 0) {
      await prisma.notification.createMany({
        data: superadminAccountIds.map((accountId: string) => ({
          accountId,
          title: "Shopify integration requested",
          body: `${name ?? email} (${account.name}) asked for the Shopify integration.`,
          href: "/admin/shopify-requests",
        })),
      });
    }
  } catch (err) {
    console.error("[shopify-request] superadmin notification failed", err);
  }

  return Response.json({ requested: true, requestedAt: request.createdAt });
}
