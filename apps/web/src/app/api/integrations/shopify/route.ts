import { auth, currentUser } from "@/lib/auth-adapter";
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
  let shop = await prisma.shopifyShop.findFirst({
    where: { accountId: account.id, uninstalledAt: null },
    select: {
      id: true,
      shopDomain: true,
      installedAt: true,
      linkedAt: true,
      websiteId: true,
    },
  });

  // Auto-detection: If not directly linked by accountId, check if any Website in this account
  // matches an active installed ShopifyShop domain and auto-link it.
  if (!shop) {
    const websites = await prisma.website.findMany({
      where: { accountId: account.id },
      select: { id: true, url: true },
    });

    for (const w of websites) {
      const cleanUrl = w.url.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").trim();
      const domainVariants = [cleanUrl];
      if (!cleanUrl.includes(".")) {
        domainVariants.push(`${cleanUrl}.myshopify.com`);
      }

      const matchingShop = await prisma.shopifyShop.findFirst({
        where: {
          uninstalledAt: null,
          shopDomain: { in: domainVariants },
        },
      });

      if (matchingShop) {
        await prisma.shopifyShop.update({
          where: { id: matchingShop.id },
          data: {
            accountId: account.id,
            websiteId: matchingShop.websiteId || w.id,
            linkedAt: new Date(),
          },
        });

        shop = {
          id: matchingShop.id,
          shopDomain: matchingShop.shopDomain,
          installedAt: matchingShop.installedAt,
          linkedAt: new Date(),
          websiteId: matchingShop.websiteId || w.id,
        };
        break;
      }
    }
  }

  let availableShops: { shopDomain: string; installedAt: string }[] = [];
  if (!shop) {
    const caller = await currentUser();
    const callerEmail = caller?.primaryEmailAddress?.emailAddress?.toLowerCase();

    const candidateShops = await prisma.shopifyShop.findMany({
      where: {
        uninstalledAt: null,
        OR: [
          { linkedAt: null },
          ...(callerEmail
            ? [
                {
                  account: {
                    users: {
                      some: { email: { equals: callerEmail, mode: "insensitive" as const } },
                    },
                  },
                },
              ]
            : []),
        ],
      },
      select: { shopDomain: true, installedAt: true },
      take: 5,
    });

    availableShops = candidateShops.map((s) => ({
      shopDomain: s.shopDomain,
      installedAt: s.installedAt.toISOString(),
    }));
  }

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
    availableShops,
  });
}

// POST /api/integrations/shopify
// Detects and connects a specified store domain to the active account.
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { shopDomain?: string };
  let shopDomain = (body.shopDomain || "").trim().toLowerCase();
  shopDomain = shopDomain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");

  if (!shopDomain) {
    return Response.json({ error: "Please enter your Shopify store domain." }, { status: 400 });
  }

  if (!shopDomain.includes(".")) {
    shopDomain = `${shopDomain}.myshopify.com`;
  }

  const account = await getOrCreateAccount();

  // Check if this store has been installed
  const shop = await prisma.shopifyShop.findUnique({
    where: { shopDomain },
  });

  if (!shop || shop.uninstalledAt) {
    return Response.json({
      connected: false,
      installed: false,
      message: `Asmos is not installed on ${shopDomain} yet.`,
      installUrl: `/api/shopify/install?shop=${encodeURIComponent(shopDomain)}`,
    });
  }

  // If already linked to this account, return connected status
  if (shop.accountId === account.id) {
    return Response.json({
      connected: true,
      shop: {
        id: shop.id,
        shopDomain: shop.shopDomain,
        installedAt: shop.installedAt.toISOString(),
        linkedAt: shop.linkedAt ? shop.linkedAt.toISOString() : null,
        websiteId: shop.websiteId,
      },
    });
  }

  // Ownership verification check:
  // If this shop is already linked to another active Asmos user account, verify whether the
  // caller has the same email. If not, require Shopify OAuth re-authentication so a stranger
  // cannot steal someone else's active store just by typing its domain name.
  if (shop.linkedAt) {
    const existingAccount = await prisma.account.findUnique({
      where: { id: shop.accountId },
      include: { users: true },
    });
    const callerUser = await currentUser();
    const callerEmail = callerUser?.primaryEmailAddress?.emailAddress?.toLowerCase();
    const isSameOwner = existingAccount?.users?.some(
      (u) => u.clerkUserId === userId || (callerEmail && u.email?.toLowerCase() === callerEmail)
    );

    if (existingAccount && existingAccount.users.length > 0 && !isSameOwner) {
      return Response.json({
        connected: false,
        requiresOAuth: true,
        message: `This store is currently connected to another Asmos account. To verify ownership and transfer it, please authorize via Shopify.`,
        installUrl: `/api/shopify/install?shop=${encodeURIComponent(shopDomain)}`,
      });
    }
  }

  // Ensure a Website exists for this shop on the account
  let website = await prisma.website.findFirst({
    where: { accountId: account.id, url: shopDomain },
  });
  if (!website) {
    website = await prisma.website.create({
      data: { accountId: account.id, url: shopDomain },
    });
  }

  // Link this shop to the user's account
  await prisma.shopifyShop.update({
    where: { id: shop.id },
    data: {
      accountId: account.id,
      websiteId: website.id,
      linkedAt: new Date(),
    },
  });

  return Response.json({
    connected: true,
    shop: {
      id: shop.id,
      shopDomain: shop.shopDomain,
      installedAt: shop.installedAt.toISOString(),
      linkedAt: new Date().toISOString(),
      websiteId: website.id,
    },
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
