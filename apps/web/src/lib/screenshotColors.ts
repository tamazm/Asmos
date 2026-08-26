/**
 * lib/screenshotColors.ts
 *
 * Non-AI colour extraction from a screenshot - pure pixel quantization
 * (colorthief, backed by sharp), never a vision-model call. Server-only:
 * sharp is a native binding and must never end up in a client bundle, which
 * is why this lives in its own file instead of inside popupScraping.ts
 * (imported by client components for INDUSTRY_BUCKETS/normalizeIndustry).
 *
 * The one job this has: when a page loads fine but DOM-based popup
 * detection (POPUP_SCRAPE_FN) finds nothing, this turns what would
 * otherwise be a wasted scrape into at least a real colour signal, pulled
 * straight from the page's own screenshot instead of guessing.
 *
 * Deliberately narrow - a flat screenshot has no DOM, so it can only ever
 * yield colour. It can never recover template/layout/copy/fonts/shape;
 * those need a real element to read computed styles off of, which is
 * exactly what this path doesn't have.
 */
import { getPalette, getSwatches } from "colorthief";
import type { PaletteEntry } from "@/lib/popupScraping";

export type ScreenshotColors = {
  palette: PaletteEntry[];
  // The most saturated/eye-catching colour on the page - the closest a flat
  // screenshot can get to "what a button's brand colour probably looks
  // like", short of actually finding the button.
  accentColor: string | null;
  // The most dominant colour by area - usually the page's own background.
  backgroundColor: string | null;
};

const EMPTY: ScreenshotColors = { palette: [], accentColor: null, backgroundColor: null };

/**
 * Same Browserless /screenshot request shape as api/analyze/route.ts's
 * takeScreenshot - a full above-the-fold capture, not the cropped
 * popup-element screenshot POPUP_SCRAPE_FN takes when it actually finds a
 * popup. Used only as the fallback when that DOM-based capture found
 * nothing on a page that otherwise loaded fine.
 */
export async function takePageScreenshot(url: string, browserlessToken: string): Promise<string | null> {
  if (!browserlessToken) return null;
  try {
    const res = await fetch(`https://production-sfo.browserless.io/screenshot?token=${browserlessToken}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        options: { fullPage: false, type: "jpeg", quality: 75 },
        waitForTimeout: 2000,
        gotoOptions: { waitUntil: "networkidle2", timeout: 15000 },
        viewport: { width: 1280, height: 900 },
      }),
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 1000) return null; // suspiciously small - likely a blocked/blank response
    return Buffer.from(buf).toString("base64");
  } catch (err) {
    console.warn("[screenshotColors] fallback screenshot failed:", err);
    return null;
  }
}

export async function extractColorsFromScreenshot(base64Jpeg: string): Promise<ScreenshotColors> {
  try {
    const buf = Buffer.from(base64Jpeg, "base64");
    const [rawPalette, swatches] = await Promise.all([
      getPalette(buf, { colorCount: 6 }),
      getSwatches(buf),
    ]);
    // getPalette's array order reflects its quantization tree, not proportion
    // - sort by area share so callers (and backgroundColor below) can rely
    // on index 0 actually being the most dominant colour.
    const palette: PaletteEntry[] = (rawPalette ?? [])
      .map((c) => ({ hex: c.hex(), areaShare: c.proportion }))
      .sort((a, b) => b.areaShare - a.areaShare);
    return {
      palette,
      accentColor: swatches.Vibrant?.color.hex() ?? null,
      backgroundColor: palette[0]?.hex ?? null,
    };
  } catch (err) {
    console.warn("[screenshotColors] extraction failed:", err);
    return EMPTY;
  }
}
