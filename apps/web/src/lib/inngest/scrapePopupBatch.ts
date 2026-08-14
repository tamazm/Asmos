import { inngest } from "./client";
import { prisma } from "@/lib/prisma";
import { POPUP_SCRAPE_FN, normalizeIndustry, normalizePopupScrapeResult } from "@/lib/popupScraping";

// Scraped popup design library — see lib/popupScraping.ts and
// popupGeneration.ts's getScrapedExamplesSection. Triggered from the
// superadmin dashboard (/admin/scraped-popups's ScrapeForm, via
// actions.ts's runScrapeBatch), not on a schedule — an admin pastes a list
// of high-traffic sites and this runs the batch in the background so the
// request doesn't have to sit through N sequential Browserless calls.
//
// Same batch shape as mineCrossAccountPatterns.ts: one event-triggered
// function looping `step.run` per item, not a fan-out of one event per site.
// Each item's own try/catch means one bad URL can't fail the whole batch or
// trigger an Inngest-level retry that re-scrapes everything already done.
const BROWSERLESS_TOKEN = process.env.BROWSERLESS_TOKEN ?? "";
const BROWSERLESS_FUNCTION_URL = `https://production-sfo.browserless.io/function?token=${BROWSERLESS_TOKEN}`;

export const scrapePopupBatch = inngest.createFunction(
  { id: "scrape-popup-batch", triggers: { event: "popup.scrape_batch" } },
  async ({ event, step }) => {
    const rows = (event.data.rows ?? []) as { url: string; segment: string }[];
    let scraped = 0;
    let failed = 0;

    for (const { url, segment } of rows) {
      const outcome = await step.run(`scrape-${url}`, async () => {
        if (!BROWSERLESS_TOKEN) {
          return { ok: false as const, error: "BROWSERLESS_TOKEN not configured" };
        }
        try {
          const res = await fetch(BROWSERLESS_FUNCTION_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: POPUP_SCRAPE_FN, context: { url } }),
            signal: AbortSignal.timeout(45000),
          });
          if (!res.ok) {
            return { ok: false as const, error: `Browserless ${res.status}: ${(await res.text()).slice(0, 200)}` };
          }
          const body = await res.json();
          const result = normalizePopupScrapeResult(body?.data ?? body);
          const industry = normalizeIndustry(segment);
          await prisma.scrapedPopupExample.create({
            data: {
              sourceUrl: url,
              segment,
              industry,
              present: result.present,
              html: result.html,
              headline: result.headline,
              subhead: result.subhead,
              ctaText: result.ctaText,
              templateGuess: result.templateGuess,
              layoutGuess: result.layoutGuess,
              palette: result.palette,
              screenshot: result.screenshot,
            },
          });
          return { ok: true as const };
        } catch (err) {
          return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
        }
      });

      if (outcome.ok) {
        scraped++;
      } else {
        failed++;
        console.warn(`[scrapePopupBatch] failed for ${url}:`, outcome.error);
      }
    }

    return { message: `Scraped ${scraped}/${rows.length} sites`, scraped, failed };
  },
);
