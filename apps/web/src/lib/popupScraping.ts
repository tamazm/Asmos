/**
 * lib/popupScraping.ts
 *
 * Shared logic for the scraped-popup design library: what a scraped row's
 * industry gets normalized to, and the actual Browserless function that
 * captures a popup off a live site.
 *
 * Consumed from two places: popupGeneration.ts (read-time — matching a
 * merchant's industry to stored rows) and the local, gitignored scraper
 * script under scripts/popup-scraper/ (write-time — normalizing the CSV's
 * segment column before insert). Neither ever imports the other, so the
 * bucket list and normalizer live here once, not duplicated.
 */

// ─── Industry buckets ─────────────────────────────────────────────────────────

// Deliberately lines up with imageLibrary.ts's ImageCategory keys
// (fashion_apparel, beauty_skincare, food_beverage, home_lifestyle,
// electronics_accessories, fitness_wellness) plus a few buckets this feature
// needs that imageLibrary explicitly has no photos for (UNSERVED_STORE_TYPES:
// jewelry, kids/baby) — a popup *example* is still useful there even though a
// stock photo isn't — and a generic catch-all for everything else.
export const INDUSTRY_BUCKETS = [
  "Apparel & Fashion",
  "Beauty & Cosmetics",
  "Food & Beverage",
  "Health & Wellness",
  "Home & Lifestyle",
  "Electronics & Technology",
  "Jewelry & Luxury",
  "Kids & Baby",
  "General Retail",
  "Other",
] as const;

export type IndustryBucket = (typeof INDUSTRY_BUCKETS)[number];

// Keyword → bucket. Checked in order, first match wins, so more specific
// keywords are listed before broader ones (e.g. "beauty" before "goods").
const KEYWORD_BUCKETS: [RegExp, IndustryBucket][] = [
  [/kids?|baby|babies|toddler|nursery|toy/i, "Kids & Baby"],
  [/jewel|luxury|watch/i, "Jewelry & Luxury"],
  [/beauty|cosmetic|skincare|makeup/i, "Beauty & Cosmetics"],
  [/apparel|fashion|cloth|footwear|shoe/i, "Apparel & Fashion"],
  [/food|beverage|drink|grocery|snack/i, "Food & Beverage"],
  [/health|wellness|fitness|medical|biotech|pharma/i, "Health & Wellness"],
  [/home|furniture|decor|garden|lifestyle/i, "Home & Lifestyle"],
  [/electronic|technology|software|saas|it\b|telecom/i, "Electronics & Technology"],
  [/retail|consumer goods|e-?commerce|marketplace/i, "General Retail"],
];

/**
 * Maps free text — the CSV's `segment` column, or a merchant's own
 * Account.industry (which is genuinely free text, not a DB-level enum: it's
 * whatever the analyze pass or the merchant typed) — down to one of the
 * buckets above, so a scraped row and a merchant's industry can actually
 * match on equality.
 */
export function normalizeIndustry(raw: string): IndustryBucket {
  const text = raw.trim();
  if (!text) return "Other";
  for (const [pattern, bucket] of KEYWORD_BUCKETS) {
    if (pattern.test(text)) return bucket;
  }
  return "Other";
}

// ─── Scrape result shape ──────────────────────────────────────────────────────

export type PaletteEntry = { hex: string; areaShare: number };

export type PopupScrapeResult = {
  present: boolean;
  selector: string | null;
  html: string | null;
  headline: string | null;
  subhead: string | null;
  ctaText: string | null;
  templateGuess: "split-screen" | "corner-toast" | "fullscreen-takeover" | null;
  layoutGuess: string | null;
  palette: PaletteEntry[];
  screenshot: string | null; // base64, no data: prefix
};

/**
 * Normalises whatever the Browserless /function call returned into a typed
 * shape. Mirrors storeExtraction.ts's normalizeDomExtraction — defensive
 * about a raw, untyped JSON blob coming back over HTTP.
 */
export function normalizePopupScrapeResult(raw: unknown): PopupScrapeResult {
  const empty: PopupScrapeResult = {
    present: false,
    selector: null,
    html: null,
    headline: null,
    subhead: null,
    ctaText: null,
    templateGuess: null,
    layoutGuess: null,
    palette: [],
    screenshot: null,
  };
  if (!raw || typeof raw !== "object") return empty;
  const d = raw as Record<string, unknown>;
  const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
  const templateGuess = str(d.templateGuess);
  return {
    present: Boolean(d.present),
    selector: str(d.selector),
    html: str(d.html),
    headline: str(d.headline),
    subhead: str(d.subhead),
    ctaText: str(d.ctaText),
    templateGuess:
      templateGuess === "split-screen" || templateGuess === "corner-toast" || templateGuess === "fullscreen-takeover"
        ? templateGuess
        : null,
    layoutGuess: str(d.layoutGuess),
    palette: Array.isArray(d.palette)
      ? (d.palette as unknown[])
          .filter((p): p is { hex: string; areaShare: number } => {
            const entry = p as { hex?: unknown; areaShare?: unknown };
            return typeof entry?.hex === "string" && typeof entry?.areaShare === "number";
          })
          .slice(0, 8)
      : [],
    screenshot: str(d.screenshot),
  };
}

// ─── Browserless /function body ───────────────────────────────────────────────

/**
 * Captures a real popup off a live site: navigates, waits for delay-triggered
 * popups, best-effort simulates exit-intent (what most popup SDKs listen
 * for), then looks for anything popup-shaped and, if found, extracts its
 * copy, dominant colours, a template/layout guess from its own geometry, and
 * a screenshot cropped to just that element.
 *
 * Same convention as storeExtraction.ts's DOM_EXTRACTION_FN: kept as a
 * string so it can be posted verbatim to Browserless's /function endpoint,
 * deliberately dependency-free since it runs in the target page's context.
 */
export const POPUP_SCRAPE_FN = `
export default async function ({ page, context }) {
  const { url } = context;
  await page.goto(url, { waitUntil: "networkidle2", timeout: 25000 });

  // Give delay-triggered popups a chance to appear on their own.
  await new Promise((r) => setTimeout(r, 2000));

  // Best-effort exit-intent simulation — most popup SDKs listen for the
  // cursor leaving the top of the viewport. Not guaranteed to fire every
  // vendor's trigger, but zero-cost to try before giving up.
  await page.evaluate(() => {
    document.dispatchEvent(new MouseEvent("mouseout", { clientY: -10, bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 1500));

  const data = await page.evaluate(() => {
    const isVisible = (el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 40 || r.height < 40) return false;
      const s = getComputedStyle(el);
      return s.display !== "none" && s.visibility !== "hidden" && Number(s.opacity) !== 0;
    };

    const candidates = [...document.querySelectorAll(
      "[class*='modal'], [class*='popup'], [class*='optin'], [class*='newsletter'], " +
      "[role='dialog'], [aria-modal='true'], [class*='klaviyo'], [id*='privy'], " +
      "[class*='justuno'], [class*='wisepops'], [class*='poptin'], .fancybox-container"
    )].filter(isVisible);

    // Prefer the largest visible candidate — a small "cookie banner"-shaped
    // match is less likely to be the actual offer popup than the biggest one.
    const popupEl = candidates.sort((a, b) => {
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      return rb.width * rb.height - ra.width * ra.height;
    })[0] || null;

    if (!popupEl) {
      return { present: false };
    }

    const rect = popupEl.getBoundingClientRect();
    const style = getComputedStyle(popupEl);
    const viewportArea = window.innerWidth * window.innerHeight;
    const elArea = rect.width * rect.height;

    let templateGuess = "split-screen";
    if (elArea / viewportArea > 0.85) {
      templateGuess = "fullscreen-takeover";
    } else if (style.position === "fixed" && rect.width < 420) {
      templateGuess = "corner-toast";
    }

    let layoutGuess = "centered";
    if (templateGuess === "corner-toast") {
      layoutGuess = rect.left < window.innerWidth / 2 ? "split-left" : "split-right";
    } else if (popupEl.querySelector("img")) {
      const img = popupEl.querySelector("img");
      const imgRect = img.getBoundingClientRect();
      layoutGuess = imgRect.left < rect.left + rect.width / 2 ? "split-left" : "split-right";
    }

    const txt = (el) => (el && el.textContent ? el.textContent.trim().slice(0, 200) : null);
    const headlineEl = popupEl.querySelector("h1, h2, [class*='headline'], [class*='title']");
    const subheadEl = popupEl.querySelector("p, [class*='subhead'], [class*='subtitle']");
    const ctaEl = popupEl.querySelector("button[type='submit'], button, [class*='cta'], a[class*='btn']");

    // Colour by painted area, scoped to just the popup's own descendants —
    // same technique as storeExtraction.ts's DOM_EXTRACTION_FN.
    const paint = new Map();
    const nodes = popupEl.querySelectorAll("*");
    for (let i = 0; i < Math.min(nodes.length, 500); i++) {
      const el = nodes[i];
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      const s = getComputedStyle(el);
      const area = r.width * r.height;
      for (const c of [s.backgroundColor, s.color]) {
        if (!c || c === "rgba(0, 0, 0, 0)" || c === "transparent") continue;
        paint.set(c, (paint.get(c) || 0) + area);
      }
    }
    const totalArea = [...paint.values()].reduce((a, b) => a + b, 0) || 1;
    const palette = [...paint.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([hex, area]) => ({ hex, areaShare: area / totalArea }));

    let screenshot = null;
    // Screenshot capture happens outside evaluate() below, via the element
    // handle — flagged here so the outer function knows to attempt it.
    return {
      present: true,
      selector: popupEl.className || popupEl.tagName,
      html: popupEl.outerHTML.slice(0, 20000),
      headline: txt(headlineEl),
      subhead: txt(subheadEl),
      ctaText: txt(ctaEl),
      templateGuess,
      layoutGuess,
      palette,
    };
  });

  if (!data.present) {
    return { data, type: "application/json" };
  }

  // Screenshot the matched element specifically, cropped rather than a full
  // viewport capture — this has to happen from the outer Puppeteer context,
  // not inside page.evaluate(), since it needs an ElementHandle.
  try {
    const handle = await page.evaluateHandle((sel) => {
      const isVisible = (el) => {
        const r = el.getBoundingClientRect();
        if (r.width < 40 || r.height < 40) return false;
        const s = getComputedStyle(el);
        return s.display !== "none" && s.visibility !== "hidden" && Number(s.opacity) !== 0;
      };
      const candidates = [...document.querySelectorAll(
        "[class*='modal'], [class*='popup'], [class*='optin'], [class*='newsletter'], " +
        "[role='dialog'], [aria-modal='true'], [class*='klaviyo'], [id*='privy'], " +
        "[class*='justuno'], [class*='wisepops'], [class*='poptin'], .fancybox-container"
      )].filter(isVisible);
      return candidates.sort((a, b) => {
        const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        return rb.width * rb.height - ra.width * ra.height;
      })[0] || null;
    }, data.selector);
    const el = handle.asElement();
    if (el) {
      data.screenshot = await el.screenshot({ encoding: "base64", type: "jpeg", quality: 80 });
    }
  } catch {
    // Screenshot is a nice-to-have; the structured data above is still useful without it.
  }

  return { data, type: "application/json" };
}
`.trim();
