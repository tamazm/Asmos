import { auth } from "@/lib/auth-adapter";
import { resolveAccountForRequest } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { syncRewardDiscountToShopify } from "@/lib/shopify/discounts";
import type { RewardType } from ".prisma/client";

const VALID_TYPES: RewardType[] = ["COUPON", "DISCOUNT_PERCENT", "DISCOUNT_FIXED", "FREE_SHIPPING", "GIFT"];
const DISCOUNT_TYPES: RewardType[] = ["DISCOUNT_PERCENT", "DISCOUNT_FIXED"];

async function findOwnedReward(rewardId: string, accountId: string) {
  return prisma.rewardRule.findFirst({
    where: { id: rewardId, campaign: { accountId } },
  });
}

// Edit a reward's details, pause/resume it, or reassign it to a different
// campaign. Reassignment is just an update to campaignId - a RewardRule
// isn't otherwise tied to any one variant, so moving it to another campaign
// (also owned by this account) is safe and immediate.
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/rewards/[id]">,
) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as {
    label?: string;
    description?: string | null;
    category?: string | null;
    type?: string;
    couponCode?: string | null;
    discountValue?: number | null;
    weight?: number;
    maxRedemptions?: number | null;
    active?: boolean;
    campaignId?: string;
    accountId?: string;
  };

  const account = await resolveAccountForRequest(body.accountId);
  if (!account) {
    return Response.json({ error: "Account not found" }, { status: 404 });
  }
  const reward = await findOwnedReward(id, account.id);
  if (!reward) {
    return Response.json({ error: "Reward not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};

  if (body.label !== undefined) {
    const label = body.label.trim();
    if (!label) return Response.json({ error: "label cannot be empty" }, { status: 400 });
    data.label = label;
  }
  if (body.description !== undefined) data.description = body.description?.trim() || null;
  if (body.category !== undefined) data.category = body.category?.trim() || null;
  if (body.type !== undefined) {
    if (!VALID_TYPES.includes(body.type as RewardType)) {
      return Response.json({ error: `type must be one of ${VALID_TYPES.join(", ")}` }, { status: 400 });
    }
    data.type = body.type;
  }
  if (body.couponCode !== undefined) data.couponCode = body.couponCode?.trim() || null;
  if (body.discountValue !== undefined) {
    if (body.discountValue === null) {
      data.discountValue = null;
    } else {
      const v = Math.floor(Number(body.discountValue));
      if (!Number.isFinite(v) || v < 1) {
        return Response.json({ error: "discountValue must be a positive whole number" }, { status: 400 });
      }
      // Cap percentages at 100; the effective type is the incoming one, or the stored one.
      const effectiveType = (body.type as RewardType) ?? reward.type;
      if (effectiveType === "DISCOUNT_PERCENT" && v > 100) {
        return Response.json({ error: "A percentage discount can't exceed 100." }, { status: 400 });
      }
      data.discountValue = v;
    }
  }
  if (body.weight !== undefined) {
    const w = Math.floor(Number(body.weight));
    if (!Number.isFinite(w) || w < 0) return Response.json({ error: "weight must be a non-negative number" }, { status: 400 });
    data.weight = w;
  }
  if (body.maxRedemptions !== undefined) {
    if (body.maxRedemptions === null) {
      data.maxRedemptions = null;
    } else {
      const n = Math.floor(Number(body.maxRedemptions));
      if (!Number.isFinite(n) || n < 1 || n > 1_000_000) {
        return Response.json({ error: "maxRedemptions must be between 1 and 1,000,000, or null for unlimited" }, { status: 400 });
      }
      // Never silently allow shrinking the cap below what's already been
      // redeemed - that would make an already-fulfilled reward look
      // "over-claimed" rather than just closed off to new redemptions.
      if (n < reward.redemptionsCount) {
        return Response.json(
          { error: `maxRedemptions can't be set below the ${reward.redemptionsCount} already redeemed.` },
          { status: 400 },
        );
      }
      data.maxRedemptions = n;
    }
  }
  if (body.active !== undefined) data.active = Boolean(body.active);

  if (body.campaignId !== undefined && body.campaignId !== reward.campaignId) {
    const target = await prisma.campaign.findFirst({
      where: { id: body.campaignId, accountId: account.id },
      select: { id: true },
    });
    if (!target) {
      return Response.json({ error: "Target campaign not found" }, { status: 404 });
    }
    data.campaignId = target.id;
  }

  if (Object.keys(data).length === 0) {
    return Response.json({ error: "No changes provided" }, { status: 400 });
  }

  const updated = await prisma.rewardRule.update({ where: { id: reward.id }, data });

  // Best-effort: keep the matching Shopify discount in sync when a coded discount
  // reward changes. Never let a Shopify hiccup fail the reward update.
  try {
    await syncRewardDiscountToShopify(account.id, updated);
  } catch (e) {
    console.warn("Shopify discount sync failed (reward still updated):", e instanceof Error ? e.message : e);
  }

  return Response.json({ reward: updated });
}

// Deleting a reward cascades to its CouponCode pool (schema: onDelete
// Cascade) and clears rewardRuleId on any leads that redeemed it (onDelete
// SetNull) - their claimed code text stays visible via
// Lead.rewardClaimedCode either way.
export async function DELETE(
  request: Request,
  ctx: RouteContext<"/api/rewards/[id]">,
) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as { accountId?: string };
  const account = await resolveAccountForRequest(body.accountId);
  if (!account) {
    return Response.json({ error: "Account not found" }, { status: 404 });
  }
  const reward = await findOwnedReward(id, account.id);
  if (!reward) {
    return Response.json({ error: "Reward not found" }, { status: 404 });
  }

  await prisma.rewardRule.delete({ where: { id: reward.id } });
  return Response.json({ success: true });
}
