import { prisma } from "@/lib/prisma";
import { encryptSecret, decryptSecret } from "@/lib/crypto";

// The Shopify-side analog of getOrCreateAccount() in src/lib/account.ts -
// keyed by shop domain instead of a Clerk user, since embedded merchants
// never see a Clerk sign-up screen (see plan: "well integrated app").
// Auto-provisions Account + ShopifyShop on first install; on reinstall,
// updates the stored token/scope on the existing shop.
export async function getOrCreateAccountForShop(
  shopDomain: string,
  accessToken: string,
  scope: string,
) {
  const encryptedToken = encryptSecret(accessToken);

  const existing = await prisma.shopifyShop.findUnique({
    where: { shopDomain },
    include: { account: true },
  });
  if (existing) {
    await prisma.shopifyShop.update({
      where: { id: existing.id },
      data: { accessToken: encryptedToken, scope, uninstalledAt: null },
    });
    return existing.account;
  }

  const account = await prisma.account.create({
    data: {
      name: shopDomain,
      onboardingCompletedAt: new Date(),
      shopifyShop: {
        create: { shopDomain, accessToken: encryptedToken, scope },
      },
    },
  });
  return account;
}

export async function getAccessTokenForShop(shopDomain: string): Promise<string | null> {
  const shop = await prisma.shopifyShop.findUnique({ where: { shopDomain } });
  if (!shop || shop.uninstalledAt) return null;
  return decryptSecret(shop.accessToken);
}

export async function getAccountForShop(shopDomain: string) {
  const shop = await prisma.shopifyShop.findUnique({
    where: { shopDomain },
    include: { account: true },
  });
  if (!shop || shop.uninstalledAt) return null;
  return shop.account;
}
