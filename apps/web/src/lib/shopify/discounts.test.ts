import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Admin GraphQL client and prisma before importing the module under test.
vi.mock("./admin-client", () => ({ adminGraphql: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { shopifyShop: { findUnique: vi.fn() } },
}));

import { adminGraphql } from "./admin-client";
import { prisma } from "@/lib/prisma";
import { upsertBasicDiscountCode, syncRewardDiscountToShopify } from "./discounts";

const ag = adminGraphql as unknown as ReturnType<typeof vi.fn>;
const findShop = (prisma.shopifyShop as any).findUnique as ReturnType<typeof vi.fn>;

beforeEach(() => {
  ag.mockReset();
  findShop.mockReset();
});

describe("upsertBasicDiscountCode", () => {
  it("skips a blank code", async () => {
    const r = await upsertBasicDiscountCode("shop.myshopify.com", { code: "  ", valueType: "DISCOUNT_PERCENT", value: 10 });
    expect(r.status).toBe("skipped");
    expect(ag).not.toHaveBeenCalled();
  });

  it("skips a non-positive value", async () => {
    const r = await upsertBasicDiscountCode("shop.myshopify.com", { code: "X", valueType: "DISCOUNT_FIXED", value: 0 });
    expect(r.status).toBe("skipped");
  });

  it("skips a percentage over 100", async () => {
    const r = await upsertBasicDiscountCode("shop.myshopify.com", { code: "X", valueType: "DISCOUNT_PERCENT", value: 150 });
    expect(r.status).toBe("skipped");
  });

  it("creates when the code is free, sending a 0-1 fraction for percentage", async () => {
    ag.mockResolvedValueOnce({ codeDiscountNodeByCode: null }); // lookup
    ag.mockResolvedValueOnce({ discountCodeBasicCreate: { userErrors: [] } }); // create
    const r = await upsertBasicDiscountCode("shop.myshopify.com", { code: "WELCOME10", valueType: "DISCOUNT_PERCENT", value: 10 });
    expect(r.status).toBe("created");
    const createVars = ag.mock.calls[1][2];
    expect(createVars.basicCodeDiscount.customerGets.value).toEqual({ percentage: 0.1 });
    expect(createVars.basicCodeDiscount.code).toBe("WELCOME10");
  });

  it("sends a discountAmount for fixed discounts", async () => {
    ag.mockResolvedValueOnce({ codeDiscountNodeByCode: null });
    ag.mockResolvedValueOnce({ discountCodeBasicCreate: { userErrors: [] } });
    await upsertBasicDiscountCode("shop.myshopify.com", { code: "FIVE", valueType: "DISCOUNT_FIXED", value: 5 });
    const createVars = ag.mock.calls[1][2];
    expect(createVars.basicCodeDiscount.customerGets.value).toEqual({ discountAmount: { amount: "5", appliesOnEachItem: false } });
  });

  it("updates when the code already exists", async () => {
    ag.mockResolvedValueOnce({ codeDiscountNodeByCode: { id: "gid://shopify/DiscountCodeNode/1" } });
    ag.mockResolvedValueOnce({ discountCodeBasicUpdate: { userErrors: [] } });
    const r = await upsertBasicDiscountCode("shop.myshopify.com", { code: "WELCOME10", valueType: "DISCOUNT_PERCENT", value: 20 });
    expect(r.status).toBe("updated");
    expect(ag.mock.calls[1][2].id).toBe("gid://shopify/DiscountCodeNode/1");
  });

  it("returns failed on userErrors", async () => {
    ag.mockResolvedValueOnce({ codeDiscountNodeByCode: null });
    ag.mockResolvedValueOnce({ discountCodeBasicCreate: { userErrors: [{ message: "Code has already been taken" }] } });
    const r = await upsertBasicDiscountCode("shop.myshopify.com", { code: "DUP", valueType: "DISCOUNT_FIXED", value: 5 });
    expect(r.status).toBe("failed");
    expect(r.detail).toContain("already been taken");
  });
});

describe("syncRewardDiscountToShopify", () => {
  it("skips non-discount reward types", async () => {
    const r = await syncRewardDiscountToShopify("acc1", { type: "FREE_SHIPPING", couponCode: "X", discountValue: 1, label: "L" });
    expect(r.status).toBe("skipped");
    expect(findShop).not.toHaveBeenCalled();
  });

  it("skips when code or value is missing", async () => {
    const r = await syncRewardDiscountToShopify("acc1", { type: "DISCOUNT_PERCENT", couponCode: null, discountValue: 10, label: "L" });
    expect(r.status).toBe("skipped");
  });

  it("skips when the account has no linked shop", async () => {
    findShop.mockResolvedValue(null);
    const r = await syncRewardDiscountToShopify("acc1", { type: "DISCOUNT_PERCENT", couponCode: "WELCOME10", discountValue: 10, label: "L" });
    expect(r.status).toBe("skipped");
    expect(r.detail).toContain("no linked Shopify shop");
  });

  it("creates a discount when a shop is linked", async () => {
    findShop.mockResolvedValue({ shopDomain: "shop.myshopify.com" });
    ag.mockResolvedValueOnce({ codeDiscountNodeByCode: null });
    ag.mockResolvedValueOnce({ discountCodeBasicCreate: { userErrors: [] } });
    const r = await syncRewardDiscountToShopify("acc1", { type: "DISCOUNT_PERCENT", couponCode: "WELCOME10", discountValue: 10, label: "Welcome" });
    expect(r.status).toBe("created");
    expect(ag).toHaveBeenCalledTimes(2);
  });
});
