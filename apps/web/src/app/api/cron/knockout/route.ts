/**
 * GET /api/cron/knockout
 *
 * Fully autonomous popup variant lifecycle manager. Runs on a schedule (see vercel.json).
 * For every ACTIVE campaign it:
 *   1. Eliminates extreme losers (>100 impressions, conversion rate <20% of leader)
 *   2. Reallocates traffic evenly among survivors (bandit takes over after first impression)
 *   3. Advances the tournament round when a single survivor remains
 *   4. If the campaign has room for more variants AND none are currently generating:
 *      - Fetches PostHog (or Postgres fallback) analytics per existing variant
 *      - Computes significance_flag for each axis
 *      - Determines what to test next (never re-tests a conclusive axis)
 *      - Calls the schema-driven popup generation engine with the full input
 *      - Auto-publishes the new variant(s) — no human action required
 *      - Creates a dashboard Notification so merchants can see what happened
 *
 * Authorization: Bearer <CRON_SECRET> — same as cron/insights.
 */

import { prisma } from "@/lib/prisma";
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
  type ExistingPopupExtracted,
} from "@/lib/popupGeneration";
import type { Prisma } from "@/generated/prisma/client";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const campaigns = await prisma.campaign.findMany({
    where: { status: "ACTIVE" },
    include: {
      account: true,
      website: true,
      variants: { include: { events: true } },
    },
  });

  let generated = 0;
  let eliminated = 0;
  const failed: string[] = [];

  for (const campaign of campaigns) {
    if (campaign.variants.length === 0) continue;

    try {
      // ── 1. Eliminate extreme losers ──────────────────────────────────────────
      let activeVariants = campaign.variants.filter((v) => v.status === "ACTIVE");

      if (activeVariants.length > 1) {
        const stats = activeVariants.map((v) => {
          const impressions = v.events.filter((e) => e.type === "IMPRESSION").length;
          const conversions = v.events.filter((e) => e.type === "SUBMISSION").length;
          return { ...v, impressions, rate: impressions > 0 ? conversions / impressions : 0 };
        });

        const leader = stats.reduce((prev, current) => (prev.rate > current.rate ? prev : current));

        for (const stat of stats) {
          if (stat.id !== leader.id && stat.impressions >= 100 && stat.rate < leader.rate * 0.2) {
            await prisma.variant.update({
              where: { id: stat.id },
              data: { status: "ELIMINATED", trafficPercent: 0 },
            });
            activeVariants = activeVariants.filter((v) => v.id !== stat.id);
            eliminated++;
          }
        }
      }

      // ── 2. Reallocate traffic evenly among survivors ──────────────────────────
      if (activeVariants.length > 0) {
        const split = Math.floor(100 / activeVariants.length);
        const remainder = 100 % activeVariants.length;
        for (let i = 0; i < activeVariants.length; i++) {
          await prisma.variant.update({
            where: { id: activeVariants[i].id },
            data: { trafficPercent: split + (i === 0 ? remainder : 0) },
          });
        }
      }

      // ── 3. Tournament round advancement ──────────────────────────────────────
      const planTier = campaign.account.planTier;
      const maxVariants = planTier === "FREE" ? 1 : planTier === "STARTER" ? 4 : 20;
      const currentRound = campaign.tournamentRound;
      const roundVariants = campaign.variants.filter((v) => v.tournamentRound === currentRound);

      if (roundVariants.length >= maxVariants && activeVariants.length === 1) {
        const winner = activeVariants[0];
        await prisma.$transaction([
          prisma.campaign.update({ where: { id: campaign.id }, data: { tournamentRound: currentRound + 1 } }),
          prisma.variant.update({ where: { id: winner.id }, data: { isControl: true, tournamentRound: currentRound + 1 } }),
        ]);
        continue; // fresh state on next run
      }

      // ── 4. Autonomous variant generation ─────────────────────────────────────
      if (roundVariants.length >= maxVariants) continue;

      // Don't double-generate
      const isGenerating = campaign.variants.some((v) => v.status === "GENERATING");
      if (isGenerating) continue;

      // Winner declared — stop generating
      if (campaign.winningVariantId) continue;

      // How many new variants can we add?
      const slotsAvailable = maxVariants - activeVariants.length;
      if (slotsAvailable <= 0) continue;

      // ── Fetch analytics for this campaign ──
      const analyticsVariants: AnalyticsVariant[] = await fetchVariantAnalytics(campaign.id);

      // ── Determine which axes are already conclusive (never re-test) ──
      const conclusiveAxes = new Set<string>();
      for (const av of analyticsVariants) {
        if (av.significance_flag === "conclusive" && av.test_axis) {
          conclusiveAxes.add(av.test_axis);
        }
      }

      // If all five axes are conclusive, nothing left to test
      const ALL_AXES = ["trigger", "friction", "copy", "layout", "visual"];
      const openAxes = ALL_AXES.filter((a) => !conclusiveAxes.has(a));
      if (openAxes.length === 0) {
        console.log(`[cron/knockout] campaign ${campaign.id}: all axes conclusive, skipping`);
        continue;
      }

      // ── Assemble brand tokens from Account + Website metadata ──
      const accountBrandColor = campaign.account.brandColor ?? "#165DFF";
      const accountIndustry = campaign.account.industry ?? "Ecommerce / Retail";
      const websiteDomain = campaign.website.url;

      // Use the control variant's design JSON for brand token inference
      const controlVariant = campaign.variants.find((v) => v.isControl) ?? campaign.variants[0];
      const controlDesign = (controlVariant?.design ?? {}) as Record<string, unknown>;

      const brandTokens: BrandTokens = brandTokensFromAnalyzeResult({
        brandColor: accountBrandColor,
        brandTokens: undefined, // will be derived from color
      });

      const computedStyles: ComputedStyles = computedStylesFromAnalyzeResult({
        brandColor: accountBrandColor,
      });

      const existingPopup: ExistingPopupExtracted = existingPopupFromAnalyzeResult({
        popup: {
          found: Boolean(controlVariant?.design),
          description: typeof controlDesign.headline === "string" ? controlDesign.headline : "",
        },
      });

      const input = buildPopupInput({
        domain: websiteDomain,
        category: accountIndustry,
        brandTokens,
        existingPopup,
        computedStyles,
        analyticsVariants,
        variantCount: Math.min(slotsAvailable, 2), // generate at most 2 variants per run
        multivariate: false,
      });

      // ── Create placeholder variants so UI shows "generating" state ──
      const numToGenerate = Math.min(slotsAvailable, 2);
      const placeholders = await Promise.all(
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

      try {
        const output = await generatePopupWithVariants(input);

        // ── Persist each generated variant ──
        const variantsToCreate = output.variants.slice(0, numToGenerate);

        for (let i = 0; i < variantsToCreate.length; i++) {
          const v = variantsToCreate[i];
          const placeholder = placeholders[i];
          if (!placeholder) continue;

          const design: Prisma.InputJsonValue = {
            headline: v.spec.headline,
            body: v.spec.subhead,
            primaryColor: v.spec.design_tokens.palette[0] ?? accountBrandColor,
            ctaText: v.spec.cta,
          };

          const formFields: Prisma.InputJsonValue = v.spec.fields;

          const targeting: Prisma.InputJsonValue = {
            trigger: v.spec.trigger,
            delaySeconds: null,
          };

          await prisma.variant.update({
            where: { id: placeholder.id },
            data: {
              status: "ACTIVE",
              trafficPercent: 0, // bandit will pick this up on first impression
              name: v.variant_id,
              design,
              formFields,
              targeting,
              testAxis: v.test_axis,
              hypothesis: v.hypothesis,
              motivatingMetric: v.motivating_metric,
              popupSpec: v.spec as unknown as Prisma.InputJsonValue,
              generatedCode: v.code,
            },
          });

          generated++;
        }

        // Clean up any unused placeholders if AI returned fewer variants than requested
        for (let i = variantsToCreate.length; i < placeholders.length; i++) {
          const p = placeholders[i];
          if (p) await prisma.variant.delete({ where: { id: p.id } }).catch(() => {});
        }

        // ── Store AI rationale as a CampaignInsight ──
        const insightSummary = variantsToCreate
          .map((v) => `**${v.test_axis}**: ${v.hypothesis} (${v.motivating_metric})`)
          .join("\n\n");

        await prisma.campaignInsight.create({
          data: {
            campaignId: campaign.id,
            summary: `Asmos auto-generated ${variantsToCreate.length} new variant(s) based on ${analyticsVariants.length > 0 ? "PostHog analytics data" : "cold-start defaults"}.\n\n${insightSummary}`,
          },
        });

        // ── Create dashboard Notification ──
        const firstVariant = variantsToCreate[0];
        if (firstVariant) {
          await prisma.notification.create({
            data: {
              accountId: campaign.accountId,
              title: "New variant auto-generated",
              body: firstVariant.hypothesis,
              href: `/campaigns/${campaign.id}?tab=variants`,
            },
          });
        }
      } catch (genErr) {
        console.error(`[cron/knockout] generation failed for campaign ${campaign.id}:`, genErr);
        // Clean up all placeholders
        for (const p of placeholders) {
          await prisma.variant.delete({ where: { id: p.id } }).catch(() => {});
        }
        failed.push(campaign.id);
      }
    } catch (err) {
      console.error(`[cron/knockout] outer error for campaign ${campaign.id}:`, err);
      failed.push(campaign.id);
    }
  }

  return Response.json({ generated, eliminated, failed });
}
