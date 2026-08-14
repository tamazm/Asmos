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
import { brandTokensFromStoreProfile, computedStylesFromStoreProfile } from "@/lib/storeProfile";
import {
  detectSampleRatioMismatch,
  fetchAccountPrior,
  fetchArms,
  probabilityBest,
} from "@/lib/bandit";

/**
 * Eliminate an arm once its posterior probability of being the best drops
 * below this. 2% is deliberately strict: an elimination is irreversible within
 * a round, and the cost of keeping a mediocre arm alive one more evaluation is
 * a few hundred impressions, where the cost of killing a good one is the whole
 * hypothesis.
 */
const ELIMINATION_THRESHOLD = 0.02;
/** Consecutive evaluations that must agree before an arm is actually removed. */
const ELIMINATION_STRIKES = 2;
/** Floors so a quiet campaign cannot eliminate on noise. */
const MIN_IMPRESSIONS_BEFORE_ELIMINATION = 1000;
const MIN_SUCCESSES_BEFORE_ELIMINATION = 25;

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
          // The store profile is what stops the brand decaying to a single hex
          // after round one — see the brandTokens block below.
          website: { include: { storeProfile: true } },
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
    // the posterior says is not going to win, before doing anything else. This
    // is what narrows a round down to the single winner the advance-round
    // branch above is waiting for.
    //
    // WHY THIS IS NO LONGER A Z-TEST
    // ------------------------------
    // It used to eliminate on `significance_flag === "conclusive" &&
    // conversion_rate < controlRate`. Three things were wrong with that:
    //
    //  - "conclusive" flagged both tails of a ONE-sided statistic at 5%, which
    //    is a two-sided alpha of 0.10 while the comment claimed 95%.
    //  - This function re-runs every 1,000 campaign impressions and re-tested
    //    every arm each time, with no alpha spending and no correction for the
    //    number of arms. Repeated peeking at a fixed-horizon test inflates the
    //    false-elimination rate far past its nominal level.
    //  - The comparison baseline was the previous round's WINNER, whose
    //    measured rate is upward-biased precisely because it was selected for
    //    having the highest measured rate. Challengers were being compared
    //    against an inflated control, so they were eliminated too readily and
    //    the bias compounded every round.
    //
    // A Thompson posterior is already a sequential object: P(best) is valid to
    // read at any time, needs no correction for how often you look or how many
    // arms there are, and is computed from the same numbers driving allocation.
    // Requiring the verdict to hold across two consecutive evaluations is the
    // cheap guard against acting on one unlucky window.
    if (roundVariants.length >= maxVariants && activeVariants.length > 1) {
      const decision = await step.run("evaluate-posteriors", async () => {
        const arms = await fetchArms(campaign.id);
        if (arms.length < 2) return { eliminate: [] as string[], reason: "not enough live arms" };

        const totalImpressions = arms.reduce((s, a) => s + a.impressions, 0);
        const totalSuccesses = arms.reduce((s, a) => s + a.submissions, 0);
        if (totalImpressions < MIN_IMPRESSIONS_BEFORE_ELIMINATION || totalSuccesses < MIN_SUCCESSES_BEFORE_ELIMINATION) {
          return { eliminate: [], reason: "insufficient evidence" };
        }

        // A campaign whose arms are not receiving the traffic they were
        // allocated is a campaign whose results mean nothing. Refuse to
        // eliminate anything until that is resolved.
        const srm = detectSampleRatioMismatch(
          arms.map((a) => ({
            id: a.id,
            impressions: a.impressions,
            trafficPercent: activeVariants.find((v) => v.id === a.id)?.trafficPercent ?? 0,
          })),
        );
        if (srm.mismatch) {
          console.error(
            `[evaluateKnockout] SRM on campaign ${campaign.id}: chi2=${srm.chiSquare.toFixed(1)} df=${srm.degreesOfFreedom} n=${srm.total}. Elimination halted.`,
          );
          return { eliminate: [], reason: "sample ratio mismatch" };
        }

        const prior = await fetchAccountPrior(campaign.accountId, campaign.id);
        const pBest = probabilityBest(arms, prior);

        // Never eliminate the last arm standing, and never eliminate more than
        // one per evaluation — each elimination changes the posterior of every
        // survivor, so they should be taken one at a time.
        const ranked = arms
          .filter((a) => (pBest[a.id] ?? 0) < ELIMINATION_THRESHOLD)
          .sort((a, b) => (pBest[a.id] ?? 0) - (pBest[b.id] ?? 0));

        if (ranked.length === 0 || arms.length - 1 < 1) {
          return { eliminate: [], reason: "no arm below threshold" };
        }
        return {
          eliminate: [ranked[0].id],
          reason: `P(best)=${((pBest[ranked[0].id] ?? 0) * 100).toFixed(2)}%`,
          pBest,
        };
      });

      if (decision.eliminate.length > 0) {
        const targetId = decision.eliminate[0];
        // Two consecutive evaluations must agree. `eliminationStrikes` is
        // cleared whenever an arm climbs back above the threshold, so one
        // unlucky window cannot end a variant on its own.
        const target = activeVariants.find((v) => v.id === targetId);
        const strikes = (target?.eliminationStrikes ?? 0) + 1;

        if (strikes >= ELIMINATION_STRIKES) {
          await step.run("eliminate-underperformer", async () => {
            await prisma.variant.update({
              where: { id: targetId },
              data: { status: "ELIMINATED", trafficPercent: 0, eliminationStrikes: 0 },
            });
          });
          console.log(
            `[evaluateKnockout] campaign ${campaign.id} round ${currentRound}: eliminated ${target?.name ?? targetId} — ${decision.reason}`,
          );
          return { message: "Eliminated underperforming variant", eliminated: 1 };
        }

        await step.run("record-strike", async () => {
          await prisma.$transaction([
            prisma.variant.update({ where: { id: targetId }, data: { eliminationStrikes: strikes } }),
            // Anyone who is no longer the worst gets a clean slate.
            prisma.variant.updateMany({
              where: { campaignId: campaign.id, status: "ACTIVE", id: { not: targetId } },
              data: { eliminationStrikes: 0 },
            }),
          ]);
        });
        return { message: `Strike ${strikes}/${ELIMINATION_STRIKES} recorded`, eliminated: 0 };
      }

      await step.run("clear-strikes", async () => {
        await prisma.variant.updateMany({
          where: { campaignId: campaign.id, status: "ACTIVE", eliminationStrikes: { gt: 0 } },
          data: { eliminationStrikes: 0 },
        });
      });
      return { message: `Round full, no arm below threshold (${decision.reason})` };
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

    // The brand, carried forward.
    //
    // This used to pass `brandTokens: undefined` explicitly, so every variant
    // the tournament generated after round one was built from a synthetic
    // palette derived from one hex, with type_display "system-ui" and
    // imagery_style "clean and minimal". The brand was at its strongest in
    // round one and gone by round two — which is exactly the period during
    // which the bandit decides what "works" for this store.
    //
    // Source order: the store profile persisted at analysis time (durable,
    // survives re-analysis and campaign edits), then the campaign's own
    // generationContext (what the merchant saw at creation), then the account
    // colour as a last resort.
    const storeProfile = campaign.website.storeProfile ?? null;
    const contextTokens = (campaign.generationContext as { brandTokens?: unknown } | null)?.brandTokens;
    const contextStyles = (campaign.generationContext as { computedStyles?: unknown } | null)?.computedStyles;

    const brandTokens = brandTokensFromAnalyzeResult({
      brandColor: accountBrandColor,
      brandTokens: (brandTokensFromStoreProfile(storeProfile) ?? contextTokens) as never,
      computedStyles: contextStyles as never,
      storeName: campaign.account.name,
      industry: accountIndustry,
    });
    const computedStyles = computedStylesFromAnalyzeResult({
      computedStyles: (computedStylesFromStoreProfile(storeProfile) ?? contextStyles) as never,
      brandColor: accountBrandColor,
    });
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
                palette: v.spec.design_tokens.palette,
                discountPercent: v.spec.discount_percent,
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
