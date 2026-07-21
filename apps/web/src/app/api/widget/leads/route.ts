import { prisma } from "@/lib/prisma";
import { corsJson, corsPreflight } from "@/lib/cors";
import { pickWeightedReward, generateCouponCode } from "@/lib/reward";
import { sendRewardEmail } from "@/lib/email";

export async function OPTIONS() {
  return corsPreflight();
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    campaignId?: string;
    name?: string;
    email?: string;
    phone?: string;
    consentGiven?: boolean;
  };

  if (!body.campaignId) {
    return corsJson({ error: "campaignId is required" }, { status: 400 });
  }

  const campaign = await prisma.campaign.findUnique({
    where: { id: body.campaignId },
    include: { rewards: true, account: true },
  });
  if (!campaign) {
    return corsJson({ error: "Unknown campaign" }, { status: 404 });
  }

  const reward = pickWeightedReward(campaign.rewards);
  const couponCode = reward
    ? reward.couponCode ?? (reward.type === "COUPON" ? generateCouponCode() : null)
    : null;

  await prisma.lead.create({
    data: {
      campaignId: campaign.id,
      name: body.name || null,
      email: body.email || null,
      phone: body.phone || null,
      consentGiven: Boolean(body.consentGiven),
      consentAt: body.consentGiven ? new Date() : null,
      rewardClaimedCode: couponCode,
    },
  });

  await prisma.campaignEvent.create({
    data: { campaignId: campaign.id, type: "SUBMISSION" },
  });
  if (reward) {
    await prisma.campaignEvent.create({
      data: { campaignId: campaign.id, type: "GIFT_CLAIMED" },
    });
  }

  if (reward && body.email) {
    try {
      await sendRewardEmail({
        to: body.email,
        rewardLabel: reward.label,
        couponCode,
        brandName: campaign.account.name,
      });
    } catch {
      // Non-fatal: the reward still shows in the widget response even if email delivery fails.
    }
  }

  return corsJson({
    reward: reward ? { label: reward.label, type: reward.type, couponCode } : null,
  });
}
