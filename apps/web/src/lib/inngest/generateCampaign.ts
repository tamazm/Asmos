import { inngest } from "./client";
import { prisma } from "@/lib/prisma";
import type { Prisma, PlanTier } from ".prisma/client";
import {
  generatePopupWithVariants,
  buildPopupInput,
  brandTokensFromAnalyzeResult,
  computedStylesFromAnalyzeResult,
  existingPopupFromAnalyzeResult,
  type BrandTokens,
  type ExistingPopupExtracted,
  type ComputedStyles,
  type PopupGenerationOutput,
} from "@/lib/popupGeneration";
import { renderPopupTemplate } from "@/lib/templates";
import type { CampaignGenerationStageCode } from "@/lib/campaignGenerationStages";
import { generateCouponCode } from "@/lib/reward";
import {
  MAX_CODES_PER_GENERATE_REQUEST,
  MAX_COUPON_CODES_PER_ACCOUNT,
  DEFAULT_NEW_CAMPAIGN_CODE_COUNT,
  DEFAULT_GIFT_REDEMPTIONS,
} from "@/lib/limits";

// A popup must never go live promising a reward it can't deliver (see the
// gate in api/widget/config/route.ts), and a merchant shouldn't have to
// remember to go stock codes by hand every time they launch a campaign — so
// campaign creation guarantees a real, redeemable reward is attached
// whenever the campaign's offer implies one. Runs once per campaign
// (idempotent: a no-op if a reward already exists, e.g. a knockout round
// re-invoking generation on the same campaign) rather than per-variant —
// rewards belong to the campaign and are shared across all its variants.
async function attachDefaultReward(
  tx: Prisma.TransactionClient,
  campaignId: string,
  accountId: string,
  planTier: PlanTier,
  offerPreferenceType: "ai_choice" | "percentage" | "free_shipping" | "fixed_prize",
  baselineCouponCode: string | null | undefined,
  fixedPrizeDescription: string | undefined,
  freeShippingLimit: number | undefined,
  fixedPrizeLimit: number | undefined,
) {
  const existing = await tx.rewardRule.findFirst({ where: { campaignId } });
  if (existing) return;

  if (offerPreferenceType === "free_shipping") {
    await tx.rewardRule.create({
      data: {
        campaignId,
        label: "Free Shipping",
        type: "FREE_SHIPPING",
        // Merchant-set quantity if they gave one (e.g. "first 200 orders"),
        // otherwise genuinely unlimited — free shipping isn't inherently a
        // scarce resource the way a gift or discount budget is.
        maxRedemptions: freeShippingLimit ?? null,
      },
    });
    return;
  }

  if (offerPreferenceType === "fixed_prize") {
    await tx.rewardRule.create({
      data: {
        campaignId,
        label: (fixedPrizeDescription || "Free Gift").slice(0, 80),
        description: fixedPrizeDescription || null,
        type: "GIFT",
        maxRedemptions: fixedPrizeLimit ?? DEFAULT_GIFT_REDEMPTIONS,
      },
    });
    return;
  }

  // "percentage" or "ai_choice" — a coupon-code discount. If the AI didn't
  // end up producing a coupon_code at all (it decided a discount wasn't the
  // right move), there's nothing to attach here; the campaign's goal-based
  // gating in the widget config route handles that case rather than forcing
  // a fake reward onto it.
  if (!baselineCouponCode) return;

  const rule = await tx.rewardRule.create({
    data: { campaignId, label: "AI Discount", type: "COUPON", couponCode: baselineCouponCode },
  });

  // Real one-time-use inventory instead of relying solely on the single
  // shared code above (which never runs out and can't be tracked
  // per-redemption) — bounded by the same tiered per-request and
  // account-wide caps as manual generation on the Rewards page, so
  // attaching this can never itself blow through either budget.
  const generateCap = MAX_CODES_PER_GENERATE_REQUEST[planTier] ?? 25;
  const totalCap = MAX_COUPON_CODES_PER_ACCOUNT[planTier] ?? 100;
  const existingTotal = await tx.couponCode.count({
    where: { rewardRule: { campaign: { accountId } } },
  });
  const remaining = Math.max(0, totalCap - existingTotal);
  const poolSize = Math.max(0, Math.min(DEFAULT_NEW_CAMPAIGN_CODE_COUNT, generateCap, remaining));
  if (poolSize > 0) {
    const codes = new Set<string>();
    while (codes.size < poolSize) codes.add(generateCouponCode());
    await tx.couponCode.createMany({
      data: Array.from(codes).map((code) => ({ rewardRuleId: rule.id, code })),
      skipDuplicates: true,
    });
  }
}

// Marks progress within status=GENERATING so the UI can show something more
// useful than a static "Generating…" (and, on failure, which stage it died
// in). Left as-is when generation fails — that last-known stage is what the
// UI reads to say e.g. "Failed while: Structure is forming".
async function setStage(campaignId: string, stage: CampaignGenerationStageCode) {
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { generationStage: stage },
  }).catch((err) => {
    // Non-fatal — a missed status update shouldn't abort generation itself.
    console.error(`[generateCampaign] failed to set stage=${stage} for campaign ${campaignId}:`, err);
  });
}

export const generateCampaign = inngest.createFunction(
  // Terminal on failure by design — the campaign detail page shows lastError
  // with an explicit "Retry" button rather than silently auto-retrying,
  // which would flicker the UI between FAILED and ACTIVE unpredictably.
  { id: "generate-campaign", triggers: { event: "campaign.generate" }, retries: 0 },
  async ({ event, step }) => {
    const { campaignId } = event.data;

    const campaign = await step.run("fetch-campaign", async () => {
      return prisma.campaign.findUnique({
        where: { id: campaignId, status: "GENERATING" },
        include: { variants: true },
      });
    });

    if (!campaign) return { message: "Skipping" };

    try {
      return await runGeneration(step, campaignId, campaign.generationContext as Record<string, unknown> | null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Generation failed for an unknown reason";
      console.error(`[generateCampaign] campaign ${campaignId} failed:`, err);
      await prisma.systemLog.create({
        data: {
          level: "ERROR",
          message: `Campaign generation failed: ${message}`,
          details: err instanceof Error ? String(err.stack ?? message) : message,
        },
      }).catch(() => {});
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: "FAILED", lastError: message },
      });
      return { message: "Generation failed", error: message };
    }
  },
);

async function runGeneration(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Inngest's step-tools type is generated per-call-site and not easily named standalone; this is an internal helper, not a public API.
  step: any,
  campaignId: string,
  context: Record<string, unknown> | null,
) {
    if (!context) throw new Error("Missing generationContext");

    const brandTokens = brandTokensFromAnalyzeResult({
      brandColor: typeof context.brandColor === "string" ? context.brandColor : undefined,
      brandTokens: context.brandTokens as BrandTokens | undefined,
      computedStyles: context.computedStyles as ComputedStyles | undefined,
      storeName: typeof context.storeName === "string" ? context.storeName : undefined,
      industry: typeof context.industry === "string" ? context.industry : undefined,
    });

    const computedStyles = computedStylesFromAnalyzeResult({
      computedStyles: context.computedStyles as ComputedStyles | undefined,
      brandColor: typeof context.brandColor === "string" ? context.brandColor : undefined,
    });

    const existingPopup = existingPopupFromAnalyzeResult({
      existingPopup: context.existingPopup as ExistingPopupExtracted | undefined,
      popup: context.popup as { found: boolean; description: string } | undefined,
    });

    const category = typeof context.industry === "string" ? context.industry : "Ecommerce / Retail";
    const storeUrl = typeof context.storeUrl === "string" ? context.storeUrl : "unknown.com";
    let domain = storeUrl;
    try { domain = new URL(storeUrl).hostname.replace(/^www\./, ""); } catch {}

    await setStage(campaignId, "AI_THINKING");

    // Personalization inputs collected at campaign creation (see
    // NewCampaignForm.tsx's "Personalize your popup" section) — optional,
    // default to "let the AI decide" / "show everywhere" so the fast-path
    // (just paste a URL) is unaffected for anyone who skips them.
    const pageTargeting =
      context.pageTargeting && typeof context.pageTargeting === "object"
        ? (context.pageTargeting as { mode: "all" | "include" | "exclude"; patterns: string[] })
        : undefined;
    const offerPreferenceType =
      typeof context.discountPreference === "string"
        ? (context.discountPreference as "ai_choice" | "percentage" | "free_shipping" | "fixed_prize")
        : "ai_choice";
    const maxDiscountPercent =
      typeof context.maxDiscountPercent === "number" ? context.maxDiscountPercent : undefined;
    const fixedPrizeDescription =
      typeof context.fixedPrizeDescription === "string" ? context.fixedPrizeDescription : undefined;
    const freeShippingLimit =
      typeof context.freeShippingLimit === "number" && context.freeShippingLimit > 0
        ? Math.floor(context.freeShippingLimit)
        : undefined;
    const fixedPrizeLimit =
      typeof context.fixedPrizeLimit === "number" && context.fixedPrizeLimit > 0
        ? Math.floor(context.fixedPrizeLimit)
        : undefined;

    const output: PopupGenerationOutput = await step.run("generate-ai", async () => {
      const goal = (context.goal as "EMAIL" | "DISCOUNT" | "BOTH") ?? "BOTH";

      const input = buildPopupInput({
        domain,
        category,
        brandTokens,
        existingPopup,
        computedStyles,
        // Cold start (no analytics yet): request 2 variants instead of 1 so a
        // freshly created campaign already tests two axes (trigger timing +
        // friction, per the system prompt's ranked cold-start order) against
        // control, instead of shipping a single variant that — by design —
        // only differs from control in one respect. Safe on every plan tier:
        // MAX_VARIANTS_PER_ROUND is >= 3 everywhere (see lib/limits.ts), and
        // this still only costs 1 unit of the account's AI generation budget
        // regardless of variant count.
        analyticsVariants: [],
        variantCount: 2,
        multivariate: false,
        goal,
        maxDiscountPercent,
        offerPreference: { type: offerPreferenceType, fixedPrizeDescription },
      });
      return generatePopupWithVariants(input);
    });

    await setStage(campaignId, "STRUCTURING");

    await step.run("save-variants", async () => {
      const goal = (context.goal as "EMAIL" | "DISCOUNT" | "BOTH") ?? "BOTH";
      const newVariants = [
        {
          name: "Control",
          isControl: true,
          trafficPercent: 50,
          design: {
            headline: output.baseline.spec.headline,
            body: output.baseline.spec.subhead,
            primaryColor: brandTokens.palette[0] ?? "#165DFF",
            ctaText: output.baseline.spec.cta,
            imageUrl: output.baseline.spec.image_url,
          },
          formFields: output.baseline.spec.fields,
          targeting: {
            trigger: output.baseline.spec.trigger,
            delaySeconds: output.baseline.spec.delay_seconds,
            pages: pageTargeting,
          },
          popupSpec: output.baseline.spec as unknown as Prisma.InputJsonValue,
          generatedCode: renderPopupTemplate(output.baseline.spec.template_id, {
            headline: output.baseline.spec.headline,
            subhead: output.baseline.spec.subhead,
            cta: output.baseline.spec.cta,
            primaryColor: brandTokens.palette[0] ?? "#165DFF",
            couponCode: output.baseline.spec.coupon_code,
            goal,
            layoutStyle: output.baseline.spec.layout_style,
            imageUrl: output.baseline.spec.image_url,
          }),
        },
        ...output.variants.map((v, idx) => ({
          name: `Variant ${idx + 1} (${v.test_axis})`,
          isControl: false,
          trafficPercent: 50,
          design: {
            headline: v.spec.headline,
            body: v.spec.subhead,
            primaryColor: brandTokens.palette[0] ?? "#165DFF",
            ctaText: v.spec.cta,
            imageUrl: v.spec.image_url,
          },
          formFields: v.spec.fields,
          targeting: { trigger: v.spec.trigger, delaySeconds: v.spec.delay_seconds, pages: pageTargeting },
          popupSpec: v.spec as unknown as Prisma.InputJsonValue,
          generatedCode: renderPopupTemplate(v.spec.template_id, {
            headline: v.spec.headline,
            subhead: v.spec.subhead,
            cta: v.spec.cta,
            primaryColor: brandTokens.palette[0] ?? "#165DFF",
            couponCode: v.spec.coupon_code,
            goal,
            layoutStyle: v.spec.layout_style,
            imageUrl: v.spec.image_url,
          }),
          testAxis: v.test_axis,
          hypothesis: v.hypothesis,
          motivatingMetric: v.motivating_metric,
        }))
      ];

      const split = Math.floor(100 / newVariants.length);
      newVariants.forEach(v => { v.trafficPercent = split; });
      newVariants[0].trafficPercent += (100 - split * newVariants.length);

      await setStage(campaignId, "SAVING");

      const campaignAccount = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { accountId: true, account: { select: { planTier: true } } },
      });
      if (!campaignAccount) throw new Error("Campaign disappeared before save");

      await prisma.$transaction(async (tx) => {
        await tx.variant.deleteMany({ where: { campaignId } });
        for (const variantData of newVariants) {
          await tx.variant.create({
            data: {
              campaignId,
              ...variantData,
            }
          });
        }

        // Rewards belong to the campaign as a whole, not any one variant —
        // create/verify the campaign has one real, redeemable reward exactly
        // once per generation round (see attachDefaultReward's doc comment).
        await attachDefaultReward(
          tx,
          campaignId,
          campaignAccount.accountId,
          campaignAccount.account.planTier,
          offerPreferenceType,
          output.baseline.spec.coupon_code,
          fixedPrizeDescription,
          freeShippingLimit,
          fixedPrizeLimit,
        );

        await tx.campaign.update({
          where: { id: campaignId },
          data: {
            status: "ACTIVE",
            lastError: null,
            generationStage: null,
            account: { update: { aiGenerationsCount: { increment: 1 } } }
          }
        });
      });
    });

    return { message: "Campaign generated" };
}
