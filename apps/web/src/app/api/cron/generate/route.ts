import { prisma } from "@/lib/prisma";
import {
  generatePopupWithVariants,
  buildPopupInput,
  brandTokensFromAnalyzeResult,
  computedStylesFromAnalyzeResult,
  existingPopupFromAnalyzeResult,
  type BrandTokens,
  type ExistingPopupExtracted,
  type ComputedStyles,
} from "@/lib/popupGeneration";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const campaigns = await prisma.campaign.findMany({
    where: { status: "GENERATING" },
    include: { variants: true },
  });

  let generated = 0;
  const failed: string[] = [];

  for (const campaign of campaigns) {
    try {
      const context = campaign.generationContext as Record<string, unknown> | null;
      if (!context) {
        throw new Error("Missing generationContext on campaign");
      }

      // Assemble brand tokens and styles from context
      const brandTokens: BrandTokens = brandTokensFromAnalyzeResult({
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

      const existingPopup: ExistingPopupExtracted = existingPopupFromAnalyzeResult({
        existingPopup: context.existingPopup as ExistingPopupExtracted | undefined,
        popup: context.popup as { found: boolean; description: string } | undefined,
      });

      const category = typeof context.industry === "string" ? context.industry : "Ecommerce / Retail";
      let storeUrl = typeof context.storeUrl === "string" ? context.storeUrl : "unknown.com";
      
      let domain = storeUrl;
      try {
        domain = new URL(storeUrl).hostname.replace(/^www\./, "");
      } catch { /* use raw storeUrl */ }

      const input = buildPopupInput({
        domain,
        category,
        brandTokens,
        existingPopup,
        computedStyles,
        analyticsVariants: [],
        variantCount: 1, // Generate baseline + 1 variant
        multivariate: false,
      });

      const output = await generatePopupWithVariants(input);

      // Create variants
      const newVariants = [
        // Baseline (Control)
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
          popupSpec: output.baseline.spec,
          generatedCode: output.baseline.code,
        },
        // Variants
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
          popupSpec: v.spec,
          generatedCode: v.code,
          testAxis: v.test_axis,
          hypothesis: v.hypothesis,
          motivatingMetric: v.motivating_metric,
        }))
      ];

      // Re-assign traffic percentage evenly
      const split = Math.floor(100 / newVariants.length);
      newVariants.forEach(v => { v.trafficPercent = split; });
      newVariants[0].trafficPercent += (100 - split * newVariants.length);

      // Transaction to safely update campaign and insert variants
      await prisma.$transaction(async (tx) => {
        // First delete any existing placeholder variants
        await tx.variant.deleteMany({
          where: { campaignId: campaign.id },
        });

        // Create new variants
        for (const variantData of newVariants) {
          await tx.variant.create({
            data: {
              campaignId: campaign.id,
              ...variantData,
              rewards: {
                create: [],
              }
            }
          });
        }

        // Update campaign status
        await tx.campaign.update({
          where: { id: campaign.id },
          data: {
            status: "ACTIVE",
            lastError: null,
          }
        });
      });

      generated++;
    } catch (err) {
      console.error(`[cron/generate] failed for campaign ${campaign.id}`, err);
      failed.push(campaign.id);
      
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: {
          status: "FAILED",
          lastError: err instanceof Error ? err.stack ?? err.message : String(err),
        }
      });
    }
  }

  return Response.json({ generated, failed });
}
