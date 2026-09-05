import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DOM_EXTRACTION_FN } from "./storeExtraction";

const routeSource = readFileSync(
  fileURLToPath(new URL("../app/api/analyze/route.ts", import.meta.url)),
  "utf8",
);
const analyzeStoreSource = routeSource.slice(routeSource.indexOf("export async function analyzeStore"));

describe("store analysis fast path", () => {
  it("uses one Browserless navigation for DOM and screenshot extraction", () => {
    expect(DOM_EXTRACTION_FN.match(/page\.goto\(/g)).toHaveLength(1);
    expect(DOM_EXTRACTION_FN).toContain("page.screenshot");
    expect(DOM_EXTRACTION_FN).toContain("colorsByArea");
    expect(DOM_EXTRACTION_FN).toContain("logo:");
    expect(DOM_EXTRACTION_FN).toContain("productImages");
    expect(DOM_EXTRACTION_FN).toContain("detectedPopup");
    expect(DOM_EXTRACTION_FN.indexOf("page.screenshot")).toBeLessThan(
      DOM_EXTRACTION_FN.indexOf("window.scrollTo"),
    );
    expect(analyzeStoreSource.match(/extractDom\(/g)).toHaveLength(1);
    expect(routeSource).not.toContain("/screenshot?token=");
  });

  it("has no fixed waits in the Browserless session", () => {
    expect(DOM_EXTRACTION_FN).not.toContain("setTimeout(");
    expect(DOM_EXTRACTION_FN).not.toContain('waitUntil: "networkidle2"');
    expect(DOM_EXTRACTION_FN).toContain("waitForPossiblePopup");
  });

  it("uses one primary AI request, one failure-only fallback, and a DOM fallback", () => {
    expect(analyzeStoreSource.match(/analyzeWithBedrock\(/g)).toHaveLength(1);
    expect(analyzeStoreSource).not.toContain("analyzeWithAnthropic(");
    expect(analyzeStoreSource).not.toContain("analyzeWithGemini(");
    expect(analyzeStoreSource).not.toContain("extractBrandTokens(");
    expect(analyzeStoreSource).toContain("analyzeWithAnthropicUnified(");
    expect(analyzeStoreSource).toContain("domBasedCro(");
    expect(analyzeStoreSource).toContain("settleWithin(");
  });

  it("budgets 7.5 seconds for a screenshot-backed free report and emits stage timings", () => {
    expect(routeSource).toContain("ANALYZE_RESPONSE_BUDGET_MS = 7500");
    expect(routeSource).toContain("maxBrowserMs: 4600");
    expect(routeSource).toContain("navigationTimeoutMs: 3000");
    expect(routeSource).toContain("screenshotQuality: 82");
    expect(routeSource).toContain("aiMaxTokens: 1700");
    for (const stage of ["navigationMs", "extractionMs", "aiMs", "catalogueMs", "databaseMs"]) {
      expect(routeSource).toContain(stage);
    }
    expect(routeSource).toContain("medianMs");
    expect(routeSource).toContain("p95Ms");
    expect(routeSource).toContain("Server-Timing");
  });

  it("keeps a separate, richer campaign preset", () => {
    expect(routeSource).toContain("CAMPAIGN_ANALYSIS_BUDGET_MS = 7500");
    expect(routeSource).toContain("navigationTimeoutMs: 3500");
    expect(routeSource).toContain("triggerWaitMs: 650");
    expect(routeSource).toContain("screenshotQuality: 82");
    expect(routeSource).toContain("aiMaxTokens: 1700");
    expect(routeSource).toContain("analyzeWithAnthropicUnified(");
  });
});
