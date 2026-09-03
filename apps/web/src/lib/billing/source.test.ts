import { describe, it, expect } from "vitest";
import { isRailActive, canStartStripeCheckout, canStartShopifyCharge } from "./source";

const base = { billingSource: "NONE" as const, planTier: "FREE" as const, subscriptionStatus: "TRIALING" as const };

describe("isRailActive", () => {
  it("is false when no rail owns the account", () => {
    expect(isRailActive(base)).toBe(false);
  });
  it("is true for an owning status on a real rail", () => {
    expect(isRailActive({ ...base, billingSource: "STRIPE", subscriptionStatus: "ACTIVE" })).toBe(true);
    expect(isRailActive({ ...base, billingSource: "SHOPIFY", subscriptionStatus: "TRIALING" })).toBe(true);
    expect(isRailActive({ ...base, billingSource: "SHOPIFY", subscriptionStatus: "PAST_DUE" })).toBe(true);
  });
  it("is false once the rail's subscription is canceled", () => {
    expect(isRailActive({ ...base, billingSource: "STRIPE", subscriptionStatus: "CANCELED" })).toBe(false);
  });
});

describe("checkout guards", () => {
  it("blocks Stripe checkout when Shopify actively owns the account", () => {
    expect(canStartStripeCheckout({ ...base, billingSource: "SHOPIFY", subscriptionStatus: "ACTIVE" })).toBe(false);
  });
  it("allows Stripe checkout when Shopify sub is canceled", () => {
    expect(canStartStripeCheckout({ ...base, billingSource: "SHOPIFY", subscriptionStatus: "CANCELED" })).toBe(true);
  });
  it("blocks Shopify charge when Stripe actively owns the account", () => {
    expect(canStartShopifyCharge({ ...base, billingSource: "STRIPE", subscriptionStatus: "ACTIVE" })).toBe(false);
  });
  it("allows each rail when the account is free (NONE)", () => {
    expect(canStartStripeCheckout(base)).toBe(true);
    expect(canStartShopifyCharge(base)).toBe(true);
  });
});
