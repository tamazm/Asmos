import { auth } from "@/lib/auth-adapter";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";

// GET /api/integrations/shopify
// Returns whether the active account has an installed Shopify store.
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const account = await getOrCreateAccount();
  const shop = await prisma.shopifyShop.findFirst({
    where: { accountId: account.id, uninstalledAt: null },
    select: {
      id: true,
      shopDomain: true,
      installedAt: true,
      linkedAt: true,
      websiteId: true,
    },
  });

  return Response.json({
    connected: Boolean(shop),
    shop: shop
      ? {
          id: shop.id,
          shopDomain: shop.shopDomain,
          installedAt: shop.installedAt.toISOString(),
          linkedAt: shop.linkedAt ? shop.linkedAt.toISOString() : null,
          websiteId: shop.websiteId,
        }
      : null,
  });
}

// DELETE /api/integrations/shopify
// Unlinks/disconnects the Shopify store from the account.
export async function DELETE() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const account = await getOrCreateAccount();
  const shop = await prisma.shopifyShop.findFirst({
    where: { accountId: account.id, uninstalledAt: null },
  });

  if (!shop) {
    return Response.json({ error: "No connected Shopify store found" }, { status: 404 });
  }

  // Soft-unlink by marking uninstalledAt or resetting accountId to a detached placeholder
  await prisma.shopifyShop.update({
    where: { id: shop.id },
    data: {
      uninstalledAt: new Date(),
    },
  });

  return Response.json({ ok: true });
}
