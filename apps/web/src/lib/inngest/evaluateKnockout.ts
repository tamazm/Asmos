// @ts-expect-error
/* eslint-disable @typescript-eslint/no-unused-vars */
import { inngest } from "./client";
import { prisma } from "@/lib/prisma";
import { AI_GENERATION_LIMITS, MAX_VARIANTS_PER_ROUND } from "@/lib/limits";
import type { Prisma } from ".prisma/client";
import {
  generatePopupWithVariants,
  fetchVariantAnalytics,
  fetchNoveltyMemory,
  buildPopupInput,
  brandTokensFromAnalyzeResult,
  computedStylesFromAnalyzeResult,
  existingPopupFromAnalyzeResult,
} from "@/lib/popupGeneration";
import { briefFromSpec, buildVariantBriefs, hashSeed } from "@/lib/designBrief";
import { renderPopupTemplate } from "@/lib/templates";

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
    const maxVariants = MAX_VARIANTS_PER_ROUND[planTier];
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

    // The round is full but still has multiple contenders — eliminate anyone
    // conclusively worse than the current control before doing anything else.
    // This is what actually narrows a round down to the single winner that
    // the advance-round branch above is waiting for.
    if (roundVariants.length >= maxVariants && activeVariants.length > 1) {
      const controlVariant = roundVariants.find((v) => v.isControl) ?? activeVariants[0];
      const analyticsVariants = await step.run("fetch-analytics-for-elimination", async () =>
        fetchVariantAnalytics(campaign.id),
      );
      const statsById = new Map(analyticsVariants.map((a) => [a.variant_id, a]));
      const controlRate = statsById.get(controlVariant.id)?.conversion_rate ?? 0;

      const toEliminate = activeVariants.filter((v) => {
        if (v.id === controlVariant.id) return false;
        const stats = statsById.get(v.id);
        return stats?.significance_flag === "conclusive" && stats.conversion_rate < controlRate;
      });

      if (toEliminate.length > 0) {
        await step.run("eliminate-underperformers", async () => {
          await prisma.variant.updateMany({
            where: { id: { in: toEliminate.map((v) => v.id) } },
            data: { status: "ELIMINATED", trafficPercent: 0 },
          });
        });
        console.log(
          `[evaluateKnockout] campaign ${campaign.id} round ${currentRound}: eliminated ${toEliminate.length} variant(s) — ${toEliminate.map((v) => v.name).join(", ")}`,
        );
        return { message: "Eliminated underperforming variants", eliminated: toEliminate.length };
      }

      return { message: "Round full, no conclusive underperformer yet" };
    }

    if (roundVariants.length >= maxVariants) return { message: "Max variants reached" };
    if (campaign.variants.some((v) => v.status === "GENERATING")) return { message: "Already generating" };
    if (campaign.winningVariantId) return { message: "Winner already declared" };

    const slotsAvailable = maxVariants - activeVariants.length;
    if (slotsAvailable <= 0) return { message: "No slots available" };

    const maxGenerations = AI_GENERATION_LIMITS[planTier] ?? 3;
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
    // Page targeting is a campaign-level choice made once at creation (see
    // NewCampaignForm.tsx) and copied identically onto every variant's
    // targeting.pages by generateCampaign.ts — carry it forward onto
    // knockout-generated variants too, or a new round would silently reset
    // "only show on /product/*" back to "show everywhere".
    const controlTargeting = (controlVariant?.targeting ?? {}) as { pages?: unknown };
    const pageTargeting = controlTargeting.pages;

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

    // Carry the merchant's original creation-time offer preference forward
    // into knockout-generated variants too (same rationale as pageTargeting
    // above), rather than silently reverting to "ai_choice" every round.
    const generationContext = (campaign.generationContext ?? {}) as Record<string, unknown>;
    const offerPreferenceType =
      typeof generationContext.discountPreference === "string"
        ? (generationContext.discountPreference as "ai_choice" | "percentage" | "free_shipping" | "fixed_prize")
        : "ai_choice";
    const maxDiscountPercent =
      typeof generationContext.maxDiscountPercent === "number" ? generationContext.maxDiscountPercent : undefined;
    const fixedPrizeDescription =
      typeof generationContext.fixedPrizeDescription === "string" ? generationContext.fixedPrizeDescription : undefined;

    try {
      const output = await step.run("generate-ai", async () => {
        const novelty = await fetchNoveltyMemory(campaign.accountId);

        // Two-tier policy, exploit half: this campaign has real traffic and a
        // leader, so new arms perturb the CURRENT CONTROL by one knob each
        // rather than exploring freely. That's what makes the resulting
        // conversion delta attributable to a specific change instead of to a
        // wholesale redesign.
        const controlSpec = (controlVariant?.popupSpec ?? null) as
          | { template_id?: string; layout_style?: string; dna?: unknown }
          | null;
        const baseBrief = controlSpec
          ? briefFromSpec(controlSpec, hashSeed(campaign.id, currentRound))
          : undefined;

        const briefs = buildVariantBriefs({
          seed: hashSeed(campaign.id, currentRound, Date.now()),
          variantCount: numToGenerate,
          mode: baseBrief ? "exploit" : "explore",
          baseBrief,
          avoid: novelty.recentFingerprints,
        });

        const input = buildPopupInput({
          domain: websiteDomain,
          category: accountIndustry,
          brandTokens,
          existingPopup,
          computedStyles,
          analyticsVariants,
          variantCount: numToGenerate,
          multivariate: false,
          maxDiscountPercent,
          offerPreference: { type: offerPreferenceType, fixedPrizeDescription },
          testingMode: baseBrief ? "exploit" : "explore",
          novelty,
        });
        return generatePopupWithVariants(input, briefs);
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
              targeting: { trigger: v.spec.trigger, delaySeconds: v.spec.delay_seconds, pages: pageTargeting },
              testAxis: v.test_axis,
              hypothesis: v.hypothesis,
              motivatingMetric: v.motivating_metric,
              popupSpec: v.spec as unknown as Prisma.InputJsonValue,
              generatedCode: renderPopupTemplate(v.spec.template_id, {
                headline: v.spec.headline,
                subhead: v.spec.subhead,
                cta: v.spec.cta,
                primaryColor: v.spec.design_tokens.palette[0] ?? accountBrandColor,
                couponCode: v.spec.coupon_code,
                goal: "BOTH",
                layoutStyle: v.spec.layout_style,
                imageUrl: v.spec.image_url,
                dna: v.spec.dna,
                brandFonts: v.spec.design_tokens,
              }),
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
      console.error(`[evaluateKnockout] campaign ${campaign.id} round ${currentRound} generation failed:`, genErr);
      await step.run("cleanup-placeholders", async () => {
        for (const p of placeholders) {
          await prisma.variant.delete({ where: { id: p.id } }).catch(() => {});
        }
      });
      throw genErr;
    }
  }
);
