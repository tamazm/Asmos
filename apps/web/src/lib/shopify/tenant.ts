import { prisma } from "@/lib/prisma";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import { shopify } from "./client";
import { isRailActive } from "@/lib/billing/source";

// The token bundle produced by an expiring-offline-token exchange (see
// /api/shopify/session). `expiresAt`/`refreshToken` are absent only for legacy
// permanent tokens, which we no longer request.
export interface ShopTokenBundle {
  accessToken: string;
  scope: string;
  expiresAt?: Date | null;
  refreshToken?: string | null;
  refreshTokenExpiresAt?: Date | null;
}

// The Shopify-side analog of getOrCreateAccount() in src/lib/account.ts -
// keyed by shop domain instead of a Clerk user, since embedded merchants
// never see a Clerk sign-up screen (see plan: "well integrated app").
// Auto-provisions Account + ShopifyShop on first install; on reinstall,
// updates the stored token/scope on the existing shop.
export async function getOrCreateAccountForShop(
  shopDomain: string,
  token: ShopTokenBundle,
) {
  const tokenData = {
    accessToken: encryptSecret(token.accessToken),
    scope: token.scope,
    tokenExpiresAt: token.expiresAt ?? null,
    refreshToken: token.refreshToken ? encryptSecret(token.refreshToken) : null,
    refreshTokenExpiresAt: token.refreshTokenExpiresAt ?? null,
  };

  const existing = await prisma.shopifyShop.findUnique({
    where: { shopDomain },
    include: { account: true },
  });
  if (existing) {
    await prisma.shopifyShop.update({
      where: { id: existing.id },
      data: { ...tokenData, uninstalledAt: null },
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
        create: { shopDomain, ...tokenData },
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

// Renew the offline access token a minute before it actually expires, so a call
// that starts just under the wire doesn't land after expiry.
const TOKEN_EXPIRY_BUFFER_MS = 60_000;

// Returns a currently-valid offline access token for the shop, transparently
// refreshing an expired one via its refresh token. This is what every Admin API
// call should use (see admin-client.ts) — never the raw stored token, which may
// have expired. Returns null if the shop is uninstalled or can't be refreshed
// (e.g. a legacy permanent token with no refresh token, or an expired refresh
// token); the caller then fails cleanly and the shop self-heals on its next
// embedded session load, which re-exchanges a fresh expiring token.
export async function getValidAccessTokenForShop(shopDomain: string): Promise<string | null> {
  const shop = await prisma.shopifyShop.findUnique({ where: { shopDomain } });
  if (!shop || shop.uninstalledAt) return null;

  // Legacy permanent token (no expiry recorded) or still-valid expiring token:
  // use as-is. Permanent tokens keep working until the next session load swaps
  // them for an expiring one — Shopify's hard cutoff is 2027-01-01.
  const notExpiring = !shop.tokenExpiresAt;
  const stillValid =
    shop.tokenExpiresAt && shop.tokenExpiresAt.getTime() - TOKEN_EXPIRY_BUFFER_MS > Date.now();
  if (notExpiring || stillValid) return decryptSecret(shop.accessToken);

  // Expired: refresh if we can.
  if (
    !shop.refreshToken ||
    (shop.refreshTokenExpiresAt && shop.refreshTokenExpiresAt.getTime() <= Date.now())
  ) {
    return null;
  }

  const { session } = await shopify.auth.refreshToken({
    shop: shopDomain,
    refreshToken: decryptSecret(shop.refreshToken),
  });
  if (!session.accessToken) return null;

  await prisma.shopifyShop.update({
    where: { id: shop.id },
    data: {
      accessToken: encryptSecret(session.accessToken),
      scope: session.scope ?? shop.scope,
      tokenExpiresAt: session.expires ?? null,
      // A refresh response may rotate the refresh token; keep the newest.
      refreshToken: session.refreshToken ? encryptSecret(session.refreshToken) : shop.refreshToken,
      refreshTokenExpiresAt: session.refreshTokenExpires ?? shop.refreshTokenExpiresAt,
    },
  });
  return session.accessToken;
}

// Raw stored token, no refresh. Retained for callers that only need presence
// (e.g. uninstall bookkeeping); prefer getValidAccessTokenForShop for API calls.
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

export class ShopLinkError extends Error {}

// Links an installed shop to a merchant's existing (Clerk-backed) Asmos account:
// re-points the ShopifyShop off its auto-provisioned throwaway account and onto
// `targetAccountId`, picking which of that account's websites serves on the
// storefront, then migrates the campaigns for the shop's OWN website (and their
// leads, transitively) off the throwaway account onto the target. Campaigns the
// merchant may have created for a DIFFERENT website on the throwaway (possible
// via SSO dashboard access) are left untouched — never forcibly re-homed to
// this shop's domain. Non-destructive: the orphaned throwaway account is
// deleted only when it holds nothing worth keeping (no Clerk users, no
// integration connections, AND no remaining campaigns); otherwise it's left in
// place (detached from the shop) so no data is ever silently lost or corrupted.
// Refuses the merge outright if the shop is actively billed via Shopify and the
// target account is actively billed via Stripe, to avoid double-billing the
// merchant.
//
// Ordering matters: we re-point the shop FIRST, then touch the old account —
// ShopifyShop cascades on account delete, so deleting the old account while the
// shop still pointed at it would take the shop with it.
export async function linkShopToAccount(
  shopDomain: string,
  targetAccountId: string,
  opts: { websiteId?: string | null; expectedFromAccountId?: string } = {},
): Promise<{ websiteId: string }> {
  const shop = await prisma.shopifyShop.findUnique({
    where: { shopDomain },
    include: { account: { select: { billingSource: true, subscriptionStatus: true } } },
  });
  if (!shop) throw new ShopLinkError("This store isn't installed anymore.");
  if (shop.uninstalledAt) throw new ShopLinkError("This store has uninstalled the app.");

  // Single-use enforcement: the link token was minted while the shop was on
  // `expectedFromAccountId`. If it's since moved (already linked/replayed), the
  // token is stale — refuse rather than silently re-point.
  if (opts.expectedFromAccountId && shop.accountId !== opts.expectedFromAccountId) {
    throw new ShopLinkError("This store has already been connected. Start again from the app to make changes.");
  }

  const target = await prisma.account.findUnique({
    where: { id: targetAccountId },
    select: {
      id: true,
      billingSource: true,
      subscriptionStatus: true,
      shopifyShop: { select: { id: true } },
      websites: { select: { id: true, url: true } },
    },
  });
  if (!target) throw new ShopLinkError("That Asmos account no longer exists.");
  // One shop per account: refuse if the target already has a *different* shop.
  if (target.shopifyShop && target.shopifyShop.id !== shop.id) {
    throw new ShopLinkError("That Asmos account is already connected to a different Shopify store.");
  }

  // Double-billing guard: if the shop's current account is actively billed by
  // Shopify AND the target account is actively billed by Stripe, merging would
  // leave the merchant paying on both rails. Refuse and tell them how to fix it.
  const shopRailActive =
    shop.account &&
    isRailActive({
      billingSource: shop.account.billingSource,
      planTier: "FREE",
      subscriptionStatus: shop.account.subscriptionStatus,
    });
  const targetRailActive = isRailActive({
    billingSource: target.billingSource,
    planTier: "FREE",
    subscriptionStatus: target.subscriptionStatus,
  });
  if (
    shop.account?.billingSource === "SHOPIFY" &&
    shopRailActive &&
    target.billingSource === "STRIPE" &&
    targetRailActive
  ) {
    throw new ShopLinkError(
      "This store has an active Shopify subscription and the Asmos account you're connecting to is billed by card. Cancel the Shopify subscription first so you aren't charged twice.",
    );
  }

  // Resolve the website this store maps to under the target account.
  const targetWebsites = target.websites as { id: string; url: string }[];
  let websiteId: string;
  if (opts.websiteId) {
    if (!targetWebsites.some((w) => w.id === opts.websiteId)) {
      throw new ShopLinkError("That website doesn't belong to your account.");
    }
    websiteId = opts.websiteId;
  } else {
    // Reuse a target website already pointed at this domain, else create one.
    const existing = targetWebsites.find((w) => w.url === shopDomain);
    websiteId =
      existing?.id ??
      (await prisma.website.create({ data: { accountId: targetAccountId, url: shopDomain } })).id;
  }

  const oldAccountId = shop.accountId;
  const oldShopWebsiteId = shop.websiteId;

  // 1) Re-point the shop (and its storefront website mapping).
  await prisma.shopifyShop.update({
    where: { id: shop.id },
    data: { accountId: targetAccountId, websiteId, linkedAt: new Date() },
  });

  // 2) Migrate the campaigns the merchant built while the shop was on its old
  //    (throwaway) account. Campaigns on the shop's OWN website move to the
  //    target account + resolved target website. Campaigns the merchant may have
  //    created for a DIFFERENT website (possible via SSO dashboard access) are
  //    left untouched on the old account — never forcibly re-homed to this
  //    shop's domain, which would corrupt their storefront mapping. Leads follow
  //    their campaigns (Lead -> Variant -> Campaign), so lead/revenue data moves
  //    with them.
  if (oldAccountId !== targetAccountId) {
    if (oldShopWebsiteId) {
      await prisma.campaign.updateMany({
        where: { accountId: oldAccountId, websiteId: oldShopWebsiteId },
        data: { accountId: targetAccountId, websiteId },
      });
    } else {
      // Degenerate: the shop had no website mapping — nothing to scope by, so
      // migrate all of the old account's campaigns wholesale.
      await prisma.campaign.updateMany({
        where: { accountId: oldAccountId },
        data: { accountId: targetAccountId, websiteId },
      });
    }
  }

  // 3) Delete the orphaned throwaway account — only when it holds nothing worth
  //    keeping. Block deletion if it still has Clerk users, integration
  //    connections (a Shopify-first merchant can now reach the dashboard via SSO
  //    and connect integrations under the throwaway), or campaigns for OTHER
  //    websites that were deliberately left in place above.
  if (oldAccountId !== targetAccountId) {
    const [userCount, connCount, remainingCampaigns] = await Promise.all([
      prisma.user.count({ where: { accountId: oldAccountId } }),
      prisma.integrationConnection.count({ where: { accountId: oldAccountId } }),
      prisma.campaign.count({ where: { accountId: oldAccountId } }),
    ]);
    if (userCount === 0 && connCount === 0 && remainingCampaigns === 0) {
      await prisma.account.delete({ where: { id: oldAccountId } }).catch((err) => {
        console.error("[shopify/link] throwaway account delete failed", oldAccountId, err);
      });
    } else {
      console.warn(
        `[shopify/link] kept old account ${oldAccountId} (users=${userCount}, connections=${connCount}, campaigns=${remainingCampaigns}) after linking ${shopDomain}`,
      );
    }
  }

  return { websiteId };
}
