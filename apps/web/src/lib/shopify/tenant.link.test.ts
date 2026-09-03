import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/crypto", () => ({
  encryptSecret: (s: string) => `enc(${s})`,
  decryptSecret: (s: string) => s.replace(/^enc\(|\)$/g, ""),
}));
vi.mock("./client", () => ({ shopify: {} }));
vi.mock("@/lib/prisma", () => {
  const prisma = {
    shopifyShop: { findUnique: vi.fn(), update: vi.fn() },
    account: { findUnique: vi.fn(), delete: vi.fn() },
    website: { create: vi.fn() },
    campaign: { updateMany: vi.fn(), count: vi.fn() },
    user: { count: vi.fn() },
    lead: { count: vi.fn() },
    integrationConnection: { count: vi.fn() },
  };
  return { prisma };
});

import { prisma } from "@/lib/prisma";
import { linkShopToAccount, ShopLinkError } from "./tenant";

const p = prisma as any;

beforeEach(() => {
  Object.values(p).forEach((m: any) => Object.values(m).forEach((fn: any) => fn.mockReset?.()));
  p.website.create.mockResolvedValue({ id: "web_target" });
  p.shopifyShop.update.mockResolvedValue({});
  p.campaign.updateMany.mockResolvedValue({ count: 2 });
  p.campaign.count.mockResolvedValue(0);
  p.user.count.mockResolvedValue(0);
  p.lead.count.mockResolvedValue(0);
  p.integrationConnection.count.mockResolvedValue(0);
});

describe("linkShopToAccount billing conflict", () => {
  it("refuses when the shop's account has an active Shopify sub and target is billed by Stripe", async () => {
    p.shopifyShop.findUnique.mockResolvedValue({
      id: "shop_1", accountId: "throwaway", uninstalledAt: null,
      account: { billingSource: "SHOPIFY", subscriptionStatus: "ACTIVE" },
    });
    p.account.findUnique.mockResolvedValue({
      id: "target", billingSource: "STRIPE", subscriptionStatus: "ACTIVE",
      shopifyShop: null, websites: [],
    });
    await expect(linkShopToAccount("s.myshopify.com", "target")).rejects.toBeInstanceOf(ShopLinkError);
    expect(p.shopifyShop.update).not.toHaveBeenCalled();
  });
});

describe("linkShopToAccount campaign migration", () => {
  it("migrates campaigns to the target account and does not delete a throwaway that still has integrations", async () => {
    p.shopifyShop.findUnique.mockResolvedValue({
      id: "shop_1", accountId: "throwaway", uninstalledAt: null, websiteId: "old_web",
      account: { billingSource: "NONE", subscriptionStatus: "TRIALING" },
    });
    p.account.findUnique.mockResolvedValue({
      id: "target", billingSource: "NONE", subscriptionStatus: "TRIALING",
      shopifyShop: null, websites: [{ id: "web_target", url: "s.myshopify.com" }],
    });
    p.integrationConnection.count.mockResolvedValue(1); // has a Klaviyo connection

    const res = await linkShopToAccount("s.myshopify.com", "target");

    expect(res.websiteId).toBe("web_target");
    expect(p.shopifyShop.update).toHaveBeenCalledWith({
      where: { id: "shop_1" },
      data: { accountId: "target", websiteId: "web_target", linkedAt: expect.any(Date) },
    });
    expect(p.campaign.updateMany).toHaveBeenCalledWith({
      where: { accountId: "throwaway", websiteId: "old_web" },
      data: { accountId: "target", websiteId: "web_target" },
    });
    expect(p.account.delete).not.toHaveBeenCalled();
  });

  it("deletes an empty throwaway after migrating campaigns", async () => {
    p.shopifyShop.findUnique.mockResolvedValue({
      id: "shop_1", accountId: "throwaway", uninstalledAt: null, websiteId: "old_web",
      account: { billingSource: "NONE", subscriptionStatus: "TRIALING" },
    });
    p.account.findUnique.mockResolvedValue({
      id: "target", billingSource: "NONE", subscriptionStatus: "TRIALING",
      shopifyShop: null, websites: [{ id: "web_target", url: "s.myshopify.com" }],
    });
    p.account.delete.mockResolvedValue({});

    await linkShopToAccount("s.myshopify.com", "target");

    expect(p.campaign.updateMany).toHaveBeenCalled();
    expect(p.account.delete).toHaveBeenCalledWith({ where: { id: "throwaway" } });
  });

  it("leaves campaigns for other websites untouched and keeps the throwaway", async () => {
    p.shopifyShop.findUnique.mockResolvedValue({
      id: "shop_1", accountId: "throwaway", uninstalledAt: null, websiteId: "old_web",
      account: { billingSource: "NONE", subscriptionStatus: "TRIALING" },
    });
    p.account.findUnique.mockResolvedValue({
      id: "target", billingSource: "NONE", subscriptionStatus: "TRIALING",
      shopifyShop: null, websites: [{ id: "web_target", url: "s.myshopify.com" }],
    });
    // A campaign for some other site the merchant made via SSO still lives on the
    // throwaway after migration, so it must not be deleted.
    p.campaign.count.mockResolvedValue(1);

    await linkShopToAccount("s.myshopify.com", "target");

    // Only the shop's own website's campaigns are re-homed.
    expect(p.campaign.updateMany).toHaveBeenCalledWith({
      where: { accountId: "throwaway", websiteId: "old_web" },
      data: { accountId: "target", websiteId: "web_target" },
    });
    // Throwaway kept because a campaign for another website remains.
    expect(p.account.delete).not.toHaveBeenCalled();
  });
});
