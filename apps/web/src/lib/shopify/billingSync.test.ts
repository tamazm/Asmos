import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    shopifyShop: { findUnique: vi.fn() },
    account: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { mapShopifySubStatus, mapShopifyPlanName, applyShopifySubscription } from "./billingSync";

const findShop = (prisma.shopifyShop as any).findUnique as ReturnType<typeof vi.fn>;
const findAccount = (prisma.account as any).findUnique as ReturnType<typeof vi.fn>;
const updateAccount = (prisma.account as any).update as ReturnType<typeof vi.fn>;

beforeEach(() => {
  findShop.mockReset();
  findAccount.mockReset();
  updateAccount.mockReset();
});

describe("mapShopifySubStatus", () => {
  it("maps Shopify statuses to internal enum", () => {
    expect(mapShopifySubStatus("ACTIVE")).toBe("ACTIVE");
    expect(mapShopifySubStatus("PENDING")).toBe("TRIALING");
    expect(mapShopifySubStatus("FROZEN")).toBe("PAST_DUE");
    expect(mapShopifySubStatus("CANCELLED")).toBe("CANCELED");
    expect(mapShopifySubStatus("EXPIRED")).toBe("CANCELED");
    expect(mapShopifySubStatus("anything-else")).toBe("CANCELED");
  });
});

describe("mapShopifyPlanName", () => {
  it("maps plan display names to tiers", () => {
    expect(mapShopifyPlanName("Asmos Scale")).toBe("SCALE");
    expect(mapShopifyPlanName("Asmos Growth")).toBe("GROWTH");
    expect(mapShopifyPlanName("Mystery")).toBe("FREE");
  });
});

describe("applyShopifySubscription", () => {
  it("writes an active Shopify plan onto the shop's account", async () => {
    findShop.mockResolvedValue({ accountId: "acc_1" });
    findAccount.mockResolvedValue({ billingSource: "NONE", subscriptionStatus: "TRIALING" });
    await applyShopifySubscription("s.myshopify.com", {
      admin_graphql_api_id: "gid://shopify/AppSubscription/9",
      name: "Asmos Growth",
      status: "ACTIVE",
    });
    expect(updateAccount).toHaveBeenCalledWith({
      where: { id: "acc_1" },
      data: {
        billingSource: "SHOPIFY",
        subscriptionStatus: "ACTIVE",
        planTier: "GROWTH",
        shopifySubscriptionId: "gid://shopify/AppSubscription/9",
      },
    });
  });

  it("downgrades to NONE/FREE when the Shopify sub is cancelled", async () => {
    findShop.mockResolvedValue({ accountId: "acc_1" });
    findAccount.mockResolvedValue({ billingSource: "SHOPIFY", subscriptionStatus: "ACTIVE" });
    await applyShopifySubscription("s.myshopify.com", { name: "Asmos Growth", status: "CANCELLED" });
    expect(updateAccount).toHaveBeenCalledWith({
      where: { id: "acc_1" },
      data: {
        billingSource: "NONE",
        subscriptionStatus: "CANCELED",
        planTier: "FREE",
        shopifySubscriptionId: null,
      },
    });
  });

  it("does not clobber an account actively billed by Stripe", async () => {
    findShop.mockResolvedValue({ accountId: "acc_1" });
    findAccount.mockResolvedValue({ billingSource: "STRIPE", subscriptionStatus: "ACTIVE" });
    await applyShopifySubscription("s.myshopify.com", { name: "Asmos Growth", status: "ACTIVE" });
    expect(updateAccount).not.toHaveBeenCalled();
  });

  it("no-ops when the shop is unknown", async () => {
    findShop.mockResolvedValue(null);
    await applyShopifySubscription("ghost.myshopify.com", { status: "ACTIVE" });
    expect(updateAccount).not.toHaveBeenCalled();
  });
});
