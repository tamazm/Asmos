import type { Prisma } from ".prisma/client";
import { analyzeStoreForCampaign } from "@/app/api/analyze/route";
import { prisma } from "@/lib/prisma";
import { POPUP_SCRAPE_FN, normalizePopupScrapeResult, type PopupScrapeResult } from "@/lib/popupScraping";
import type { ExistingPopupExtracted } from "@/lib/popupGeneration";

type StepRunner = {
  run<T>(id: string, callback: () => Promise<T>): Promise<T>;
};

const BROWSERLESS_TOKEN = process.env.BROWSERLESS_TOKEN ?? "";
const BROWSERLESS_FUNCTION_URL = `https://production-sfo.browserless.io/function?token=${BROWSERLESS_TOKEN}`;

/**
 * Real getComputedStyle capture of the merchant's own popup - reuses
 * POPUP_SCRAPE_FN verbatim, the same Browserless function that builds the
 * competitor PopupPart library (see lib/popupScraping.ts). Deliberately not
 * part of analyzeStore/analyzeStoreForCampaign in api/analyze/route.ts: both
 * of those are hard-budgeted (ANALYZE_RESPONSE_BUDGET_MS /
 * CAMPAIGN_ANALYSIS_BUDGET_MS, single Browserless navigation each) so a live
 * page load never stalls on it. This step has no such deadline - it runs
 * inside a durable Inngest workflow, not in front of a waiting browser tab -
 * so it can afford POPUP_SCRAPE_FN's own ~25-45s budget (navigation + a
 * delay/scroll/exit-intent search) as a separate, independently-failable step.
 */
async function scrapeOwnPopup(url: string): Promise<PopupScrapeResult | null> {
  if (!BROWSERLESS_TOKEN) return null;
  try {
    const res = await fetch(BROWSERLESS_FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: POPUP_SCRAPE_FN, context: { url } }),
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) {
      console.warn("[analyzeCampaignStore] popup scrape failed:", res.status);
      return null;
    }
    const body = await res.json();
    return normalizePopupScrapeResult(body?.data ?? body);
  } catch (e) {
    console.warn("[analyzeCampaignStore] popup scrape error:", e);
    return null;
  }
}

/**
 * Enrich a newly created campaign with the higher-fidelity protected analysis
 * preset, inside the durable generation workflow instead of before the browser
 * can navigate to the campaign page.
 */
export async function analyzeCampaignStore(
  step: StepRunner,
  campaignId: string,
  context: Record<string, unknown> | null,
): Promise<Record<string, unknown> | null> {
  if (!context || context.analysisPending !== true) return context;

  const storeUrl = typeof context.storeUrl === "string" ? context.storeUrl : null;
  if (!storeUrl) throw new Error("Missing store URL for background analysis");

  const afterAnalysis = await step.run("analyze-store", async () => {
    await prisma.campaign
      .update({
        where: { id: campaignId },
        data: { generationStage: "ANALYZING" },
      })
      .catch((error) => {
        console.error(
          `[generateCampaign] failed to set stage=ANALYZING for campaign ${campaignId}:`,
          error,
        );
      });

    const startedAt = Date.now();
    const rawAnalysis = await analyzeStoreForCampaign(storeUrl);

    // The screenshot is useful to the analyzer's vision calls but not to popup
    // generation afterward. Keeping its base64 bytes out of Prisma and Inngest
    // step output prevents a large payload from slowing every replay.
    const analysisWithoutScreenshot = { ...rawAnalysis };
    delete analysisWithoutScreenshot.screenshotBase64;
    const serializableAnalysis = JSON.parse(
      JSON.stringify(analysisWithoutScreenshot),
    ) as Record<string, unknown>;
    const mergedContext: Record<string, unknown> = {
      ...serializableAnalysis,
      ...context,
      storeUrl,
      analysisPending: false,
    };

    const analyzedStoreName =
      typeof serializableAnalysis.storeName === "string"
        ? serializableAnalysis.storeName.trim()
        : "";
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        generationContext: mergedContext as Prisma.InputJsonValue,
        ...(context.autoName === true && analyzedStoreName
          ? { name: `${analyzedStoreName}: Email Capture` }
          : {}),
      },
    });

    console.info("[generateCampaign] store analysis completed", {
      campaignId,
      analysisMs: Date.now() - startedAt,
      source: serializableAnalysis.analysisSource ?? "unknown",
    });
    return mergedContext;
  });

  // A separate step, deliberately after and independent of analyze-store
  // above - see scrapeOwnPopup's doc comment for why this can't just be
  // folded into that budgeted call. A failure (or no popup found) degrades to
  // whatever existingPopup analyze-store already produced (a vision guess)
  // rather than failing the whole campaign generation over a popup capture.
  return step.run("scrape-existing-popup", async () => {
    const popupScrape = await scrapeOwnPopup(storeUrl);
    if (!popupScrape?.present) return afterAnalysis;

    const existing = (afterAnalysis.existingPopup ?? {}) as Partial<ExistingPopupExtracted>;
    const enrichedExistingPopup: ExistingPopupExtracted = {
      captured: true,
      screenshot_url: existing.screenshot_url ?? null,
      extracted_copy: {
        headline: popupScrape.design.headline ?? existing.extracted_copy?.headline ?? "",
        subhead: popupScrape.design.subhead ?? existing.extracted_copy?.subhead ?? "",
        cta: popupScrape.design.ctaText ?? existing.extracted_copy?.cta ?? "",
      },
      extracted_structure: {
        trigger_guess: existing.extracted_structure?.trigger_guess ?? "unknown",
        fields: existing.extracted_structure?.fields ?? ["email"],
        layout: popupScrape.design.layout ?? popupScrape.design.template ?? existing.extracted_structure?.layout ?? "unknown",
      },
      measured_design: popupScrape.design,
    };

    const enrichedContext = { ...afterAnalysis, existingPopup: enrichedExistingPopup };

    await prisma.campaign
      .update({
        where: { id: campaignId },
        data: { generationContext: enrichedContext as Prisma.InputJsonValue },
      })
      .catch((error) => {
        console.error(`[analyzeCampaignStore] failed to persist enriched popup capture for ${campaignId}:`, error);
      });

    return enrichedContext;
  });
}
