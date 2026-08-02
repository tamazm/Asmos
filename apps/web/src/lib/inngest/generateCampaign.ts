import { inngest } from "./client";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
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
      const input = buildPopupInput({
        domain,
        category,
        brandTokens,
        existingPopup,
        computedStyles,
        analyticsVariants: [],
        variantCount: 1,
        multivariate: false,
      });
      return generatePopupWithVariants(input);
    });

    await step.run("save-variants", async () => {
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
          },
          formFields: output.baseline.spec.fields,
          targeting: { trigger: output.baseline.spec.trigger, delaySeconds: null },
          popupSpec: output.baseline.spec as unknown as Prisma.InputJsonValue,
          generatedCode: output.baseline.code,
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
          },
          formFields: v.spec.fields,
          targeting: { trigger: v.spec.trigger, delaySeconds: null },
          popupSpec: v.spec as unknown as Prisma.InputJsonValue,
          generatedCode: v.code,
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
          await tx.variant.create({ data: { campaignId, ...variantData } });
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
