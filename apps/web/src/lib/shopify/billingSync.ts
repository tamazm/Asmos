import type { PlanTier, SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canStartShopifyCharge } from "@/lib/billing/source";

// Shopify AppSubscription.status (uppercase in the app_subscriptions/update
// webhook payload) -> our internal SubscriptionStatus.
export function mapShopifySubStatus(status: string): SubscriptionStatus {
  switch ((status || "").toUpperCase()) {
    case "ACTIVE":
      return "ACTIVE";
    case "PENDING":
      return "TRIALING"; // created, awaiting approval / in trial
    case "FROZEN":
      return "PAST_DUE"; // payment problem, Shopify retrying
    case "CANCELLED":
    case "DECLINED":
    case "EXPIRED":
    default:
      return "CANCELED";
  }
}

// Shopify plan display name -> PlanTier. Names come from the PLANS catalog in
// lib/shopify/billing.ts ("Asmos Growth", "Asmos Scale"). Substring match so a
// future rename that keeps the tier word still resolves.
export function mapShopifyPlanName(name: string): PlanTier {
  const n = (name || "").toLowerCase();
  if (n.includes("scale")) return "SCALE";
  if (n.includes("growth")) return "GROWTH";
  return "FREE";
}

type AppSubscriptionPayload = {
  admin_graphql_api_id?: string;
  name?: string;
  status?: string;
};

// Persist a Shopify app-subscription state change onto the shop's Account so the
// app's own entitlement checks (lib/limits.ts reads Account.planTier) reflect a
// Shopify-billed plan. Idempotent — safe to call for every app_subscriptions/update
// webhook. Refuses to overwrite an account that Stripe actively owns (that would
// mean a double-billing anomaly the create-guards should have prevented; we log
// and leave Stripe as the owner rather than silently flip the rail).
export async function applyShopifySubscription(
  shopDomain: string,
  subscription: AppSubscriptionPayload,
): Promise<void> {
  const shop = await prisma.shopifyShop.findUnique({
    where: { shopDomain },
    select: { accountId: true },
  });
  if (!shop) return;

  const account = await prisma.account.findUnique({
    where: { id: shop.accountId },
    select: { billingSource: true, subscriptionStatus: true, planTier: true },
  });
  if (!account) return;

  // Defensive: never let a stray Shopify webhook clobber an account that Stripe
  // actively owns. canStartShopifyCharge encapsulates exactly that check.
  if (!canStartShopifyCharge(account)) {
    console.warn(
      `[shopify/billingSync] ignoring Shopify sub update for ${shopDomain}: account ${shop.accountId} is actively billed by Stripe`,
    );
    return;
  }

  const status = mapShopifySubStatus(subscription.status ?? "");
  const active = status === "ACTIVE" || status === "TRIALING" || status === "PAST_DUE";
  const planTier: PlanTier = active ? mapShopifyPlanName(subscription.name ?? "") : "FREE";

  await prisma.account.update({
    where: { id: shop.accountId },
    data: {
      billingSource: active ? "SHOPIFY" : "NONE",
      subscriptionStatus: status,
      planTier,
      shopifySubscriptionId: active ? subscription.admin_graphql_api_id ?? null : null,
    },
  });
}
