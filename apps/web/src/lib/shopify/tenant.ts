import { prisma } from "@/lib/prisma";
import { encryptSecret, decryptSecret } from "@/lib/crypto";

// The Shopify-side analog of getOrCreateAccount() in src/lib/account.ts —
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
    // Backfill the Website link for shops provisioned before websites were
    // linked, so storefront config lookups by shop domain resolve.
    if (!existing.websiteId) {
      await ensureWebsiteForShop(existing.id, existing.accountId, shopDomain);
    }
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
    include: { shopifyShop: true },
  });
  if (account.shopifyShop) {
    await ensureWebsiteForShop(account.shopifyShop.id, account.id, shopDomain);
  }
  return account;
}

// Every Shopify shop needs a Website row so its Campaigns have a parent and
// /api/widget/config?shop= can resolve. url is the shop's permanent domain
// (e.g. "example.myshopify.com"), which the theme app extension passes as
// data-asmos-shop. Idempotent so reinstall/backfill can't create duplicates.
async function ensureWebsiteForShop(
  shopId: string,
  accountId: string,
  shopDomain: string,
) {
  let website = await prisma.website.findFirst({
    where: { accountId, url: shopDomain },
  });
  if (!website) {
    website = await prisma.website.create({
      data: { accountId, url: shopDomain },
    });
  }
  await prisma.shopifyShop.update({
    where: { id: shopId },
    data: { websiteId: website.id },
  });
  return website;
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
