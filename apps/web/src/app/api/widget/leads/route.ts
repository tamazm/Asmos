import { prisma } from "@/lib/prisma";
import { corsJson, corsPreflight } from "@/lib/cors";
import { pickWeightedReward, generateCouponCode } from "@/lib/reward";
import { sendRewardEmail } from "@/lib/email";

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
