import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { corsJson, corsPreflight } from "@/lib/cors";
import { pickWeightedReward, generateCouponCode } from "@/lib/reward";
import { sendRewardEmail } from "@/lib/email";
import { recomputeCampaignAllocation } from "@/lib/bandit";

export async function OPTIONS() {
  return corsPreflight();
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    variantId?: string;
    name?: string;
    email?: string;
    phone?: string;
    consentGiven?: boolean;
  };

  if (!body.variantId) {
    return corsJson({ error: "variantId is required" }, { status: 400 });
  }

  const variant = await prisma.variant.findUnique({
    where: { id: body.variantId },
    include: { rewards: true, campaign: { include: { account: true } } },
  });
  if (!variant) {
    return corsJson({ error: "Unknown variant" }, { status: 404 });
  }

  const reward = pickWeightedReward(variant.rewards);
  const couponCode = reward
    ? reward.couponCode ?? (reward.type === "COUPON" ? generateCouponCode() : null)
    : null;

  await prisma.lead.create({
    data: {
      variantId: variant.id,
      name: body.name || null,
      email: body.email || null,
      phone: body.phone || null,
      consentGiven: Boolean(body.consentGiven),
      consentAt: body.consentGiven ? new Date() : null,
      rewardClaimedCode: couponCode,
    },
  });

  await prisma.campaignEvent.create({
    data: { variantId: variant.id, type: "SUBMISSION" },
  });
  if (reward) {
    await prisma.campaignEvent.create({
      data: { variantId: variant.id, type: "GIFT_CLAIMED" },
    });
  }

  // A conversion is exactly the signal the bandit needs to react to — don't
  // wait for the next impression to pick it up (see lib/bandit.ts).
  after(async () => {
    try {
      await recomputeCampaignAllocation(variant.id);
    } catch (err) {
      console.error("[bandit] allocation recompute failed", err);
    }
  });

  // Forward email_captured event to PostHog for behavioral observability.
  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (posthogKey) {
    after(async () => {
      try {
        await fetch("https://eu.posthog.com/capture/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: posthogKey,
            event: "email_captured",
            distinct_id: `widget_visitor_${variant.id}`,
            properties: {
              campaign_id: variant.campaignId,
              variant_id: variant.id,
              variant_name: variant.name,
              has_reward: Boolean(reward),
              reward_type: reward?.type ?? null,
            },
          }),
        });
      } catch (err) {
        console.error("[posthog] email_captured forwarding failed", err);
      }
    });
  }

  if (reward && body.email) {
    try {
      await sendRewardEmail({
        to: body.email,
        rewardLabel: reward.label,
        couponCode,
        brandName: variant.campaign.account.name,
      });
    } catch {
      // Non-fatal: the reward still shows in the widget response even if email delivery fails.
    }
  }

  return corsJson({
    reward: reward ? { label: reward.label, type: reward.type, couponCode } : null,
  });
}
