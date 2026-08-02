/* eslint-disable @typescript-eslint/no-unused-vars */
import { inngest } from "./client";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import {
  generatePopupWithVariants,
  fetchVariantAnalytics,
  buildPopupInput,
  brandTokensFromAnalyzeResult,
  computedStylesFromAnalyzeResult,
  existingPopupFromAnalyzeResult,
  type AnalyticsVariant,
  type BrandTokens,
  type ComputedStyles,
  type ExistingPopupExtracted
} from "@/lib/popupGeneration";

export const evaluateKnockout = inngest.createFunction(
  { id: "evaluate-knockout", triggers: { event: "campaign.evaluate" } },
  async ({ event, step }) => {
    const { campaignId } = event.data;

    const campaign = await step.run("fetch-campaign", async () => {
      return prisma.campaign.findUnique({
        where: { id: campaignId },
        include: {
          variants: true,
          account: true,
          website: true,
        },
      });
    });

    if (!campaign || campaign.status !== "ACTIVE") {
      return { message: "Campaign not active" };
    }

    const planTier = campaign.account.planTier;
    const maxVariants = planTier === "FREE" ? 1 : planTier === "STARTER" ? 4 : 20;
    const currentRound = campaign.tournamentRound;
    const roundVariants = campaign.variants.filter((v) => v.tournamentRound === currentRound);
    const activeVariants = roundVariants.filter((v) => v.status === "ACTIVE");

    if (roundVariants.length >= maxVariants && activeVariants.length === 1) {
      const winner = activeVariants[0];
      await step.run("advance-round", async () => {
        await prisma.$transaction([
          prisma.campaign.update({ where: { id: campaign.id }, data: { tournamentRound: currentRound + 1 } }),
          prisma.variant.update({ where: { id: winner.id }, data: { isControl: true, tournamentRound: currentRound + 1 } }),
        ]);
      });
      return { message: "Round advanced" };
    }

    if (roundVariants.length >= maxVariants) return { message: "Max variants reached" };
    if (campaign.variants.some((v) => v.status === "GENERATING")) return { message: "Already generating" };
    if (campaign.winningVariantId) return { message: "Winner already declared" };

    const slotsAvailable = maxVariants - activeVariants.length;
    if (slotsAvailable <= 0) return { message: "No slots available" };

    const limits: Record<string, number> = { FREE: 3, STARTER: 10, GROWTH: 50, SCALE: 250 };
    const maxGenerations = limits[planTier] ?? 3;
    if (campaign.account.aiGenerationsCount >= maxGenerations) {
      return { message: "Account reached AI generation limit" };
    }

    const analyticsVariants = await step.run("fetch-analytics", async () => fetchVariantAnalytics(campaign.id));

    const conclusiveAxes = new Set<string>();
    for (const av of analyticsVariants) {
      if (av.significance_flag === "conclusive" && av.test_axis) conclusiveAxes.add(av.test_axis);
    }

    const ALL_AXES = ["trigger", "friction", "copy", "layout", "visual"];
    const openAxes = ALL_AXES.filter((a) => !conclusiveAxes.has(a));
    if (openAxes.length === 0) return { message: "All axes conclusive" };

    const accountBrandColor = campaign.account.brandColor ?? "#165DFF";
    const accountIndustry = campaign.account.industry ?? "Ecommerce / Retail";
    const websiteDomain = campaign.website.url;

    const controlVariant = campaign.variants.find((v) => v.isControl) ?? campaign.variants[0];
    const controlDesign = (controlVariant?.design ?? {}) as Record<string, unknown>;

    const brandTokens = brandTokensFromAnalyzeResult({ brandColor: accountBrandColor, brandTokens: undefined });
    const computedStyles = computedStylesFromAnalyzeResult({ brandColor: accountBrandColor });
    const existingPopup = existingPopupFromAnalyzeResult({
      popup: {
        found: Boolean(controlVariant?.design),
        description: typeof controlDesign.headline === "string" ? controlDesign.headline : "",
      },
    });

    const numToGenerate = Math.min(slotsAvailable, 2);

    const placeholders = await step.run("create-placeholders", async () => {
      return Promise.all(
        Array.from({ length: numToGenerate }).map((_, i) =>
          prisma.variant.create({
            data: {
              campaignId: campaign.id,
              name: `Variant ${campaign.variants.length + i + 1}`,
              status: "GENERATING",
              trafficPercent: 0,
              tournamentRound: currentRound,
            },
          }),
        ),
      );
    });

    try {
      const output = await step.run("generate-ai", async () => {
        const input = buildPopupInput({
          domain: websiteDomain,
          category: accountIndustry,
          brandTokens,
          existingPopup,
          computedStyles,
          analyticsVariants,
          variantCount: numToGenerate,
          multivariate: false,
        });
        return generatePopupWithVariants(input);
      });

      await step.run("save-variants", async () => {
        const variantsToCreate = output.variants.slice(0, numToGenerate);
        for (let i = 0; i < variantsToCreate.length; i++) {
          const v = variantsToCreate[i];
          const placeholder = placeholders[i];
          if (!placeholder) continue;

          await prisma.variant.update({
            where: { id: placeholder.id },
            data: {
              status: "ACTIVE",
              trafficPercent: 0,
              name: v.variant_id,
              design: {
                headline: v.spec.headline,
                body: v.spec.subhead,
                primaryColor: v.spec.design_tokens.palette[0] ?? accountBrandColor,
                ctaText: v.spec.cta,
              },
              formFields: v.spec.fields,
              targeting: { trigger: v.spec.trigger, delaySeconds: null },
              testAxis: v.test_axis,
              hypothesis: v.hypothesis,
              motivatingMetric: v.motivating_metric,
              popupSpec: v.spec as unknown as Prisma.InputJsonValue,
              generatedCode: v.code,
            },
          });
        }

        for (let i = variantsToCreate.length; i < placeholders.length; i++) {
          const p = placeholders[i];
          if (p) await prisma.variant.delete({ where: { id: p.id } }).catch(() => {});
        }

        const insightSummary = variantsToCreate
          .map((v) => `**${v.test_axis}**: ${v.hypothesis} (${v.motivating_metric})`)
          .join("\n\n");

        await prisma.campaignInsight.create({
          data: {
            campaignId: campaign.id,
            summary: `Asmos auto-generated ${variantsToCreate.length} new variant(s).\n\n${insightSummary}`,
          },
        });

        await prisma.account.update({
          where: { id: campaign.accountId },
          data: { aiGenerationsCount: { increment: 1 } },
        });
      });

      return { message: "Generation complete" };
    } catch (genErr) {
      await step.run("cleanup-placeholders", async () => {
        for (const p of placeholders) {
          await prisma.variant.delete({ where: { id: p.id } }).catch(() => {});
        }
      });
      throw genErr;
    }
  }
);
