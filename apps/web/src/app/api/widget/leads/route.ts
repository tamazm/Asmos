// @ts-expect-error
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { corsJson, corsPreflight } from "@/lib/cors";
import { pickWeightedReward, generateCouponCode } from "@/lib/reward";
import { sendRewardEmail } from "@/lib/email";
import { recomputeCampaignAllocation } from "@/lib/bandit";
import { dispatchWebhook } from "@/lib/webhook";
import { capturePostHogEvents, isPostHogCaptureConfigured } from "@/lib/posthog-server";
import { classifyUserIntent } from "@/lib/userIntent";

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
    // First-party per-visitor id + behavioral context, same shape as
    // /api/widget/events - lets us see e.g. how much a visitor scrolled or
    // how long they were on the page before converting, not just that they
    // converted.
    visitorId?: string;
    scrollDepthPct?: number;
    timeOnPageSeconds?: number;
    device?: string;
    pageUrl?: string;
    referrer?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    timeToFirstKeystrokeMs?: number | null;
    fieldFocusCount?: number;
  };

  if (!body.variantId) {
    return corsJson({ error: "variantId is required" }, { status: 400 });
  }

  const variant = await prisma.variant.findUnique({
    where: { id: body.variantId },
    include: {
      campaign: {
        include: {
          // Only unused pool codes count toward "does this reward have
          // anything left to give out" - see lib/reward.ts's
          // isRewardAvailable, which treats couponCodes.length as the
          // available count.
          rewards: { include: { couponCodes: { where: { usedAt: null }, select: { id: true } } } },
          account: {
            select: {
              name: true,
              webhookUrl: true,
              webhookSecret: true,
              webhookEnabled: true,
            },
          },
        },
      },
    },
  });
  if (!variant) {
    return corsJson({ error: "Unknown variant" }, { status: 404 });
  }

  const reward = pickWeightedReward(variant.campaign.rewards);

  const lead = await prisma.lead.create({
    data: {
      variantId: variant.id,
      name: body.name || null,
      email: body.email || null,
      phone: body.phone || null,
      consentGiven: Boolean(body.consentGiven),
      consentAt: body.consentGiven ? new Date() : null,
    },
  });

  // Prefer an imported/generated code from the pool (see /rewards) over the
  // legacy single shared code, so bulk-imported/generated codes actually get
  // handed out one-per-lead instead of sitting unused.
  let couponCode: string | null = null;
  if (reward) {
    const candidate = await prisma.couponCode.findFirst({
      where: { rewardRuleId: reward.id, usedAt: null },
      orderBy: { createdAt: "asc" },
    });
    if (candidate) {
      const claim = await prisma.couponCode.updateMany({
        where: { id: candidate.id, usedAt: null },
        data: { usedAt: new Date(), leadId: lead.id },
      });
      if (claim.count === 1) couponCode = candidate.code;
    }
    if (!couponCode) {
      couponCode = reward.couponCode ?? (reward.type === "COUPON" ? generateCouponCode() : null);
    }
    await prisma.lead.update({
      where: { id: lead.id },
      data: { rewardClaimedCode: couponCode, rewardRuleId: reward.id },
    });
    // Generic redemption counter - tracked for every reward type (not just
    // COUPON's own usedAt-based pool accounting) so maxRedemptions works
    // uniformly for FREE_SHIPPING/GIFT/etc. too. Best-effort: a failure here
    // shouldn't break lead capture, which has already succeeded above.
    await prisma.rewardRule
      .update({ where: { id: reward.id }, data: { redemptionsCount: { increment: 1 } } })
      .catch((err) => console.error("[reward] redemptionsCount increment failed", err));
  }

  const userIntent = classifyUserIntent({
    eventType: "SUBMISSION",
    scrollDepthPct: body.scrollDepthPct,
    timeOnPageSeconds: body.timeOnPageSeconds,
    timeToFirstKeystrokeMs: body.timeToFirstKeystrokeMs,
    fieldFocusCount: body.fieldFocusCount,
    converted: true,
  });

  const conversionDetails = {
    device: body.device,
    pageUrl: body.pageUrl,
    referrer: body.referrer,
    utmSource: body.utmSource,
    utmMedium: body.utmMedium,
    utmCampaign: body.utmCampaign,
    timeToFirstKeystrokeMs: body.timeToFirstKeystrokeMs ?? undefined,
    fieldFocusCount: body.fieldFocusCount,
    userIntentLevel: userIntent.level,
    userIntentScore: userIntent.score,
    userIntentSignals: userIntent.signals,
    userIntentVersion: userIntent.version,
    scrollDepthPct: body.scrollDepthPct,
    timeOnPageSeconds: body.timeOnPageSeconds,
  };
  const hasConversionDetails = Object.values(conversionDetails).some((v) => v !== undefined);

  await prisma.campaignEvent.create({
    data: {
      variantId: variant.id,
      type: "SUBMISSION",
      visitorId: body.visitorId ?? undefined,
      details: hasConversionDetails ? conversionDetails : undefined,
    },
  });
  if (reward) {
    await prisma.campaignEvent.create({
      data: { variantId: variant.id, type: "GIFT_CLAIMED", visitorId: body.visitorId ?? undefined },
    });
  }

  // A conversion is exactly the signal the bandit needs to react to - don't
  // wait for the next impression to pick it up (see lib/bandit.ts).
  after(async () => {
    try {
      await recomputeCampaignAllocation(variant.id);
    } catch (err) {
      console.error("[bandit] allocation recompute failed", err);
    }
  });

  // Fire outbound webhook if configured (fire-and-forget via after()).
  // A slow or dead customer endpoint must never delay or break the widget's lead ack.
  after(async () => {
    try {
      const account = variant.campaign.account;
      if (account.webhookEnabled && account.webhookUrl) {
        await dispatchWebhook(account.webhookUrl, account.webhookSecret ?? null, {
          event: "lead.captured",
          payload: {
            campaign_id: variant.campaign.id,
            campaign_name: variant.campaign.name,
            variant_id: variant.id,
            variant_name: variant.name,
            lead: {
              email: body.email ?? null,
              name: body.name ?? null,
              phone: body.phone ?? null,
              consent_given: Boolean(body.consentGiven),
              captured_at: new Date().toISOString(),
            },
            reward: reward
              ? {
                  label: reward.label,
                  type: reward.type,
                  coupon_code: couponCode,
                }
              : null,
          },
        });
      }
    } catch (err) {
      console.error("[webhook] lead.captured dispatch failed", err);
    }
  });

  // Forward the conversion plus its intent cohort to PostHog.
  if (isPostHogCaptureConfigured()) {
    after(async () => {
      try {
        const distinctId = body.visitorId || `widget_visitor_${variant.id}`;
        const sharedProperties = {
          store_id: `campaign_${variant.campaignId}`,
          campaign_id: variant.campaignId,
          popup_id: variant.campaignId,
          variant_id: variant.id,
          variant_name: variant.name,
          test_axis: variant.testAxis,
          hypothesis: variant.hypothesis,
          motivating_metric: variant.motivatingMetric,
          has_reward: Boolean(reward),
          reward_type: reward?.type ?? null,
          device: body.device,
          page_url: body.pageUrl,
          referrer: body.referrer,
          utm_source: body.utmSource,
          utm_medium: body.utmMedium,
          utm_campaign: body.utmCampaign,
          scroll_depth_pct: body.scrollDepthPct,
          time_on_page_s: body.timeOnPageSeconds,
          time_to_first_keystroke_ms: body.timeToFirstKeystrokeMs,
          field_focus_count: body.fieldFocusCount,
          user_intent_level: userIntent.level,
          user_intent_score: userIntent.score,
          user_intent_signals: userIntent.signals,
          user_intent_version: userIntent.version,
          $current_url: body.pageUrl,
        };

        await capturePostHogEvents([
          { event: "email_captured", distinctId, properties: sharedProperties },
          { event: "asmos_popup_converted", distinctId, properties: sharedProperties },
          { event: "asmos_user_intent_scored", distinctId, properties: sharedProperties },
        ]);
      } catch (err) {
        console.error("[posthog] conversion forwarding failed", err);
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
