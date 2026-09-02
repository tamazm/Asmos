import { auth } from "@/lib/auth-adapter";
import { resolveAccountForRequest } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { syncRewardDiscountToShopify } from "@/lib/shopify/discounts";
import type { RewardType } from ".prisma/client";

const VALID_TYPES: RewardType[] = ["COUPON", "DISCOUNT_PERCENT", "DISCOUNT_FIXED", "FREE_SHIPPING", "GIFT"];
// Types that carry a redeemable code (and, for the two discount types, a value).
const CODE_TYPES: RewardType[] = ["COUPON", "DISCOUNT_PERCENT", "DISCOUNT_FIXED"];
const DISCOUNT_TYPES: RewardType[] = ["DISCOUNT_PERCENT", "DISCOUNT_FIXED"];

// Manual reward creation - the rewards page previously only ever showed
// rewards the AI had created as a side effect of generating a campaign.
// This lets a merchant add any reward type directly (a second free-shipping
// tier, a manually-authored gift, extra discount rules, etc.) and attach it
// to whichever campaign they choose.
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    campaignId?: string;
    label?: string;
    type?: string;
    description?: string;
    category?: string;
    couponCode?: string;
    discountValue?: number | null;
    maxRedemptions?: number | null;
    weight?: number;
    accountId?: string;
  };

  const account = await resolveAccountForRequest(body.accountId);
  if (!account) {
    return Response.json({ error: "Account not found" }, { status: 404 });
  }

  if (!body.campaignId || typeof body.campaignId !== "string") {
    return Response.json({ error: "campaignId is required" }, { status: 400 });
  }
  const campaign = await prisma.campaign.findFirst({
    where: { id: body.campaignId, accountId: account.id },
    select: { id: true },
  });
  if (!campaign) {
    return Response.json({ error: "Campaign not found" }, { status: 404 });
  }

  const label = (body.label ?? "").trim();
  if (!label) {
    return Response.json({ error: "label is required" }, { status: 400 });
  }

  const type = body.type as RewardType;
  if (!VALID_TYPES.includes(type)) {
    return Response.json({ error: `type must be one of ${VALID_TYPES.join(", ")}` }, { status: 400 });
  }

  let maxRedemptions: number | null = null;
  if (body.maxRedemptions !== undefined && body.maxRedemptions !== null) {
    const n = Math.floor(Number(body.maxRedemptions));
    if (!Number.isFinite(n) || n < 1 || n > 1_000_000) {
      return Response.json({ error: "maxRedemptions must be between 1 and 1,000,000, or omitted for unlimited" }, { status: 400 });
    }
    maxRedemptions = n;
  }

  const weight = Number.isFinite(Number(body.weight)) ? Math.max(0, Math.floor(Number(body.weight))) : 1;

  // Discount value: required shape only for the two discount types; ignored otherwise.
  let discountValue: number | null = null;
  if (DISCOUNT_TYPES.includes(type) && body.discountValue !== undefined && body.discountValue !== null) {
    const v = Math.floor(Number(body.discountValue));
    if (!Number.isFinite(v) || v < 1) {
      return Response.json({ error: "discountValue must be a positive whole number" }, { status: 400 });
    }
    if (type === "DISCOUNT_PERCENT" && v > 100) {
      return Response.json({ error: "A percentage discount can't exceed 100." }, { status: 400 });
    }
    discountValue = v;
  }

  const reward = await prisma.rewardRule.create({
    data: {
      campaignId: campaign.id,
      label,
      type,
      description: body.description?.trim() || null,
      category: body.category?.trim() || null,
      couponCode: CODE_TYPES.includes(type) ? (body.couponCode?.trim() || null) : null,
      discountValue,
      maxRedemptions,
      weight,
    },
  });

  // Best-effort: mirror a coded discount into Shopify so the code actually works
  // at checkout. Never let a Shopify hiccup fail the reward creation.
  try {
    await syncRewardDiscountToShopify(account.id, reward);
  } catch (e) {
    console.warn("Shopify discount sync failed (reward still created):", e instanceof Error ? e.message : e);
  }

  return Response.json({ reward });
}
