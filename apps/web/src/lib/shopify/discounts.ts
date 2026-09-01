import { adminGraphql } from "./admin-client";
import { prisma } from "@/lib/prisma";

// Create (or update) a redeemable Shopify discount code from an Asmos reward,
// so a coupon a popup hands out actually works at the merchant's checkout.
//
// Best-effort by contract: callers run this inside try/catch (or after()) so a
// Shopify hiccup never breaks saving the reward. Mirrors lib/shopify/customers.ts.

export type DiscountKind = "DISCOUNT_PERCENT" | "DISCOUNT_FIXED";

export interface DiscountInput {
  /** The code shoppers type at checkout, e.g. "WELCOME10". */
  code: string;
  valueType: DiscountKind;
  /** DISCOUNT_PERCENT: whole percent (10 = 10%). DISCOUNT_FIXED: whole currency units (5 = $5). */
  value: number;
  /** Admin-facing name; defaults to the code. */
  title?: string;
}

export type DiscountResult = { status: "created" | "updated" | "skipped" | "failed"; detail?: string };

interface UserError { field?: string[] | null; message: string }

/** Build Shopify's customerGets.value from our reward value. */
function buildValue(valueType: DiscountKind, value: number) {
  if (valueType === "DISCOUNT_PERCENT") {
    // Shopify wants a 0-1 fraction: 10% -> 0.1.
    return { percentage: value / 100 };
  }
  return { discountAmount: { amount: String(value), appliesOnEachItem: false } };
}

function buildBasicInput(input: DiscountInput) {
  return {
    title: input.title?.trim() || input.code,
    code: input.code,
    startsAt: new Date().toISOString(),
    customerSelection: { all: true },
    customerGets: { value: buildValue(input.valueType, input.value), items: { all: true } },
    appliesOncePerCustomer: true,
  };
}

/** Find an existing code-discount node id by its code (so we update instead of duplicate). */
async function findDiscountIdByCode(shopDomain: string, code: string): Promise<string | null> {
  const data = await adminGraphql<{ codeDiscountNodeByCode?: { id: string } | null }>(
    shopDomain,
    `query FindDiscount($code: String!) { codeDiscountNodeByCode(code: $code) { id } }`,
    { code },
  );
  return data?.codeDiscountNodeByCode?.id ?? null;
}

/**
 * Create the discount if its code is free, otherwise update the existing one so
 * a changed value/label is reflected. Returns a status the caller can log.
 */
export async function upsertBasicDiscountCode(shopDomain: string, input: DiscountInput): Promise<DiscountResult> {
  const code = input.code?.trim();
  if (!code) return { status: "skipped", detail: "no code" };
  if (!Number.isFinite(input.value) || input.value <= 0) return { status: "skipped", detail: "invalid value" };
  if (input.valueType === "DISCOUNT_PERCENT" && input.value > 100) {
    return { status: "skipped", detail: "percent > 100" };
  }

  const basicCodeDiscount = buildBasicInput({ ...input, code });
  const existingId = await findDiscountIdByCode(shopDomain, code);

  if (existingId) {
    const data = await adminGraphql<{ discountCodeBasicUpdate?: { userErrors: UserError[] } }>(
      shopDomain,
      `mutation UpdateDiscount($id: ID!, $basicCodeDiscount: DiscountCodeBasicInput!) {
        discountCodeBasicUpdate(id: $id, basicCodeDiscount: $basicCodeDiscount) {
          userErrors { field message }
        }
      }`,
      { id: existingId, basicCodeDiscount },
    );
    const errors = data?.discountCodeBasicUpdate?.userErrors ?? [];
    if (errors.length) return { status: "failed", detail: errors.map((e) => e.message).join("; ") };
    return { status: "updated" };
  }

  const data = await adminGraphql<{ discountCodeBasicCreate?: { userErrors: UserError[] } }>(
    shopDomain,
    `mutation CreateDiscount($basicCodeDiscount: DiscountCodeBasicInput!) {
      discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
        codeDiscountNode { id }
        userErrors { field message }
      }
    }`,
    { basicCodeDiscount },
  );
  const errors = data?.discountCodeBasicCreate?.userErrors ?? [];
  if (errors.length) return { status: "failed", detail: errors.map((e) => e.message).join("; ") };
  return { status: "created" };
}

/**
 * Reflect an Asmos reward into the merchant's Shopify discounts, if applicable.
 * No-op (returns "skipped") unless the reward is a discount type with a code +
 * value AND the account has a linked Shopify shop. Safe to call best-effort.
 */
export async function syncRewardDiscountToShopify(
  accountId: string,
  reward: { type: string; couponCode: string | null; discountValue: number | null; label: string },
): Promise<DiscountResult> {
  if (reward.type !== "DISCOUNT_PERCENT" && reward.type !== "DISCOUNT_FIXED") {
    return { status: "skipped", detail: "not a discount type" };
  }
  if (!reward.couponCode || reward.discountValue == null) {
    return { status: "skipped", detail: "missing code or value" };
  }
  const shop = await prisma.shopifyShop.findUnique({ where: { accountId }, select: { shopDomain: true } });
  if (!shop) return { status: "skipped", detail: "no linked Shopify shop" };

  return upsertBasicDiscountCode(shop.shopDomain, {
    code: reward.couponCode,
    valueType: reward.type,
    value: reward.discountValue,
    title: reward.label,
  });
}
