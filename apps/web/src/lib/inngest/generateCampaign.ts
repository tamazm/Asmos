import { inngest } from "./client";
import { prisma } from "@/lib/prisma";
import type { Prisma, RewardType } from ".prisma/client";
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
import { renderSplitScreenTemplate } from "@/lib/templates/splitScreen";

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

    const output: PopupGenerationOutput = await step.run("generate-ai", async () => {
      const goal = (context.goal as "EMAIL" | "DISCOUNT" | "BOTH") ?? "BOTH";

      const input = buildPopupInput({
        domain,
        category,
        brandTokens,
        existingPopup,
        computedStyles,
        analyticsVariants: [],
        variantCount: 1,
        multivariate: false,
        goal,
      });
      return generatePopupWithVariants(input);
    });

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
          targeting: { trigger: output.baseline.spec.trigger, delaySeconds: output.baseline.spec.delay_seconds },
          popupSpec: output.baseline.spec as unknown as Prisma.InputJsonValue,
          generatedCode: renderSplitScreenTemplate({
            headline: output.baseline.spec.headline,
            subhead: output.baseline.spec.subhead,
            cta: output.baseline.spec.cta,
            primaryColor: brandTokens.palette[0] ?? "#165DFF",
            couponCode: output.baseline.spec.coupon_code,
            goal,
            layoutStyle: output.baseline.spec.layout_style,
            imageUrl: output.baseline.spec.image_url,
          }),
          rewards: output.baseline.spec.coupon_code
            ? [
                {
                  label: "AI Discount",
                  type: "COUPON" as RewardType,
                  couponCode: output.baseline.spec.coupon_code,
                },
              ]
            : [],
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
          targeting: { trigger: v.spec.trigger, delaySeconds: v.spec.delay_seconds },
          popupSpec: v.spec as unknown as Prisma.InputJsonValue,
          generatedCode: renderSplitScreenTemplate({
            headline: v.spec.headline,
            subhead: v.spec.subhead,
            cta: v.spec.cta,
            primaryColor: brandTokens.palette[0] ?? "#165DFF",
            couponCode: v.spec.coupon_code,
            goal,
            layoutStyle: v.spec.layout_style,
            imageUrl: v.spec.image_url,
          }),
          rewards: v.spec.coupon_code
            ? [
                {
                  label: "AI Discount",
                  type: "COUPON" as RewardType,
                  couponCode: v.spec.coupon_code,
                },
              ]
            : [],
          testAxis: v.test_axis,
          hypothesis: v.hypothesis,
          motivatingMetric: v.motivating_metric,
        }))
      ];

      const split = Math.floor(100 / newVariants.length);
      newVariants.forEach(v => { v.trafficPercent = split; });
      newVariants[0].trafficPercent += (100 - split * newVariants.length);

      await prisma.$transaction(async (tx) => {
        await tx.variant.deleteMany({ where: { campaignId } });
        for (const variantData of newVariants) {
          const { rewards, ...restData } = variantData;
          await tx.variant.create({ 
            data: { 
              campaignId, 
              ...restData
            } 
          });
          
          // Create rewards at the campaign level if they don't already exist
          if (rewards && rewards.length > 0) {
             for (const r of rewards) {
                const existingReward = await tx.rewardRule.findFirst({
                   where: { campaignId, couponCode: r.couponCode }
                });
                if (!existingReward) {
                   await tx.rewardRule.create({
                      data: { campaignId, ...r }
                   });
                }
             }
          }
        }
        await tx.campaign.update({
          where: { id: campaignId },
          data: {
            status: "ACTIVE",
            lastError: null,
            account: { update: { aiGenerationsCount: { increment: 1 } } }
          }
        });
      });
    });

    return { message: "Campaign generated" };
}
