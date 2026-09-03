import type { PlanTier, SubscriptionStatus, BillingSource } from "@prisma/client";

// The minimal billing shape these helpers reason about. Any object with these
// three fields (an Account row, or a test fixture) works — keeps the helpers
// pure and trivially unit-testable.
export type AccountBillingFields = {
  billingSource: BillingSource;
  planTier: PlanTier;
  subscriptionStatus: SubscriptionStatus;
};

// A rail "owns" an account while its subscription is in any non-terminal state.
// PAST_DUE is intentionally included: the merchant still has a live billing
// relationship on that rail (the processor is retrying the charge), so we must
// not let a second rail be opened underneath it.
const OWNING_STATUSES: SubscriptionStatus[] = ["ACTIVE", "TRIALING", "PAST_DUE"];

export function isRailActive(a: AccountBillingFields): boolean {
  return a.billingSource !== "NONE" && OWNING_STATUSES.includes(a.subscriptionStatus);
}

// True unless Shopify actively owns the account. Called before creating a Stripe
// Checkout session so a Shopify-billed merchant can never open a second rail.
export function canStartStripeCheckout(a: AccountBillingFields): boolean {
  return !(a.billingSource === "SHOPIFY" && isRailActive(a));
}

// True unless Stripe actively owns the account. Called before creating a Shopify
// app subscription so a Stripe-billed merchant is never double-charged.
export function canStartShopifyCharge(a: AccountBillingFields): boolean {
  return !(a.billingSource === "STRIPE" && isRailActive(a));
}
