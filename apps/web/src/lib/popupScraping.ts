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
  [/kids?|child(ren)?|baby|babies|toddler|nursery|toy/i, "Kids & Baby"],
  [/jewel|luxury|watch/i, "Jewelry & Luxury"],
  [/beauty|cosmetic|skincare|makeup/i, "Beauty & Cosmetics"],
  [/apparel|fashion|cloth|footwear|shoe/i, "Apparel & Fashion"],
  [/food|beverage|drink|grocery|snack|coffee|restaurant|caf[eé]/i, "Food & Beverage"],
  [/health|wellness|fitness|medical|biotech|pharma/i, "Health & Wellness"],
  [/home|furniture|decor|garden|lifestyle|kitchen|cookware|homeware/i, "Home & Lifestyle"],
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

/**
 * Host + path, lowercased, protocol/www/query/hash/trailing-slash stripped —
 * so https://Example.com/, http://www.example.com and example.com?ref=x all
 * collapse to the same dedupe key. Matches the SQL approximation the
 * scraped_popup_dedupe migration used to backfill existing rows.
 */
export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  try {
    const u = new URL(trimmed);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    const path = u.pathname.replace(/\/+$/, "");
    return `${host}${path}`;
  } catch {
    return trimmed.toLowerCase();
  }
}

// ─── Scrape result shape ──────────────────────────────────────────────────────

export type PaletteEntry = { hex: string; areaShare: number };

/**
 * Everything about a scraped popup's design, as one connected object —
 * matching the shape of lib/popupDna.ts's knobs (colour by role, typography,
 * shape, density, imagery) rather than a handful of disconnected facts. This
 * is what makes a scraped example actually comparable to a generated one:
 * you can see that the button's own colour, shape and fill go together, not
 * just that the popup had a blue palette and separately a pill-shaped button
 * somewhere.
 */
export type ScrapedPopupDesign = {
  template: "split-screen" | "corner-toast" | "fullscreen-takeover" | null;
  layout: string | null;

  headline: string | null;
  subhead: string | null;
  ctaText: string | null;

  // Colour by role — not just a flat palette. backgroundColor/accentColor/
  // textColor answer "what IS the blue" (the card? the button? the text?),
  // which a flat list of hex codes can't.
  palette: PaletteEntry[];
  backgroundColor: string | null; // the popup card's own background
  accentColor: string | null; // the CTA button's own fill colour
  textColor: string | null; // the headline's own text colour

  headlineFont: string | null;
  bodyFont: string | null;
  headlineFontSize: string | null;
  fontWeight: string | null;

  cornerRadius: string | null; // the card's own border-radius
  buttonRadius: string | null;
  buttonShape: "rect" | "rounded" | "pill" | null;
  buttonFill: "solid" | "outline" | null;

  padding: string | null;
  density: "compact" | "regular" | "airy" | null;

  hasImage: boolean;
  imagePosition: "side" | "top" | "background" | "none";

  hasShadow: boolean;
};

export type PopupScrapeResult = {
  present: boolean;
  selector: string | null;
  html: string | null;
  design: ScrapedPopupDesign;
  screenshot: string | null; // base64, no data: prefix
  // Page title + meta/OG description + the popup's own headline/subhead,
  // concatenated — feed this into normalizeIndustry() to auto-assign an
  // industry bucket instead of requiring one to be typed in per URL.
  industrySignal: string;
};

const EMPTY_DESIGN: ScrapedPopupDesign = {
  template: null,
  layout: null,
  headline: null,
  subhead: null,
  ctaText: null,
  palette: [],
  backgroundColor: null,
  accentColor: null,
  textColor: null,
  headlineFont: null,
  bodyFont: null,
  headlineFontSize: null,
  fontWeight: null,
  cornerRadius: null,
  buttonRadius: null,
  buttonShape: null,
  buttonFill: null,
  padding: null,
  density: null,
  hasImage: false,
  imagePosition: "none",
  hasShadow: false,
};

function normalizeDesign(raw: unknown): ScrapedPopupDesign {
  if (!raw || typeof raw !== "object") return EMPTY_DESIGN;
  const d = raw as Record<string, unknown>;
  const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
  const template = str(d.template);
  const buttonShape = str(d.buttonShape);
  const buttonFill = str(d.buttonFill);
  const density = str(d.density);
  const imagePosition = str(d.imagePosition);
  return {
    template:
      template === "split-screen" || template === "corner-toast" || template === "fullscreen-takeover"
        ? template
        : null,
    layout: str(d.layout),
    headline: str(d.headline),
    subhead: str(d.subhead),
    ctaText: str(d.ctaText),
    palette: Array.isArray(d.palette)
      ? (d.palette as unknown[])
          .filter((p): p is { hex: string; areaShare: number } => {
            const entry = p as { hex?: unknown; areaShare?: unknown };
            return typeof entry?.hex === "string" && typeof entry?.areaShare === "number";
          })
          .slice(0, 8)
      : [],
    backgroundColor: str(d.backgroundColor),
    accentColor: str(d.accentColor),
    textColor: str(d.textColor),
    headlineFont: str(d.headlineFont),
    bodyFont: str(d.bodyFont),
    headlineFontSize: str(d.headlineFontSize),
    fontWeight: str(d.fontWeight),
    cornerRadius: str(d.cornerRadius),
    buttonRadius: str(d.buttonRadius),
    buttonShape: buttonShape === "rect" || buttonShape === "rounded" || buttonShape === "pill" ? buttonShape : null,
    buttonFill: buttonFill === "solid" || buttonFill === "outline" ? buttonFill : null,
    padding: str(d.padding),
    density: density === "compact" || density === "regular" || density === "airy" ? density : null,
    hasImage: Boolean(d.hasImage),
    imagePosition:
      imagePosition === "side" || imagePosition === "top" || imagePosition === "background" ? imagePosition : "none",
    hasShadow: Boolean(d.hasShadow),
  };
}

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
    design: EMPTY_DESIGN,
    screenshot: null,
    industrySignal: "",
  };
  if (!raw || typeof raw !== "object") return empty;
  const d = raw as Record<string, unknown>;
  const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
  return {
    present: Boolean(d.present),
    selector: str(d.selector),
    html: str(d.html),
    design: normalizeDesign(d.design),
    screenshot: str(d.screenshot),
    industrySignal: typeof d.industrySignal === "string" ? d.industrySignal : "",
  };
}

// ─── Browserless /function body ───────────────────────────────────────────────

/**
 * Captures a real popup off a live site: navigates, waits for delay-triggered
 * popups, best-effort simulates exit-intent (what most popup SDKs listen
 * for), then looks for anything popup-shaped and, if found, extracts its
 * copy, dominant colours, a template/layout guess from its own geometry, and
 * a screenshot cropped to just that element. Also pulls the page's own
 * title/meta description and combines it with the popup's copy into
 * industrySignal, so an industry can be auto-assigned (normalizeIndustry)
 * without anyone typing one in per URL.
 *
 * Same convention as storeExtraction.ts's DOM_EXTRACTION_FN: kept as a
 * string so it can be posted verbatim to Browserless's /function endpoint,
 * deliberately dependency-free since it runs in the target page's context.
 */
export const POPUP_SCRAPE_FN = `
export default async function ({ page, context }) {
  const { url } = context;
  await page.goto(url, { waitUntil: "networkidle2", timeout: 25000 });

  // Title + meta/OG description — present at load, nothing to do with popup
  // timing, so grabbed before any of the waits/simulation below.
  const pageSignal = await page.evaluate(() => {
    const meta = (name) => {
      const el = document.querySelector('meta[name="' + name + '"], meta[property="' + name + '"]');
      return el ? el.getAttribute("content") || "" : "";
    };
    return [document.title, meta("description"), meta("og:description"), meta("og:type")]
      .filter(Boolean)
      .join(" . ");
  });

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

    // Cookie/consent banners match the same broad selectors below (they're
    // built as modals/dialogs too) and are usually the first thing to appear,
    // so without this they'd routinely win the "largest visible candidate"
    // sort ahead of the actual marketing popup. Filtered on two signals: the
    // major consent platforms' own container names, and — since plenty of
    // sites hand-roll their own banner with no telltale class — the
    // boilerplate language every cookie notice uses regardless of markup.
    const isCookieNotice = (el) => {
      const identity = ((el.className || "") + " " + (el.id || "")).toLowerCase();
      if (
        /cookie|consent|gdpr|ccpa|onetrust|cookiebot|osano|trustarc|quantcast|cookielaw|termly|cookieyes|iubenda|didomi|usercentrics|cmpbox|cky-/i.test(
          identity,
        )
      ) {
        return true;
      }
      const text = (el.textContent || "").slice(0, 300).toLowerCase();
      return /we use cookies|this (site|website) uses cookies|cookie (policy|settings|preferences)|manage (your )?(cookie|privacy) preferences|accept all cookies|reject all cookies/.test(
        text,
      );
    };

    const candidates = [...document.querySelectorAll(
      "[class*='modal'], [class*='popup'], [class*='optin'], [class*='newsletter'], " +
      "[role='dialog'], [aria-modal='true'], [class*='klaviyo'], [id*='privy'], " +
      "[class*='justuno'], [class*='wisepops'], [class*='poptin'], .fancybox-container"
    )].filter(isVisible).filter((el) => !isCookieNotice(el));

    // Prefer the largest visible candidate among what's left.
    const popupEl = candidates.sort((a, b) => {
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      return rb.width * rb.height - ra.width * ra.height;
    })[0] || null;

    if (!popupEl) {
      return { present: false };
    }

    // Marked so the outer Puppeteer context can grab the exact same element
    // for the screenshot below without re-running (and risking drifting from)
    // this selection logic a second time.
    popupEl.setAttribute("data-asmos-scrape-target", "1");

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
    const imgEl = popupEl.querySelector("img");

    // getComputedStyle always returns colour in rgb()/rgba() form — even when
    // the source CSS uses a custom property (var(--brand)), the computed
    // value is the browser's fully resolved colour, never the literal
    // "var(...)" string — but it's never "#rrggbb" either, so this has to be
    // converted or every entry silently fails the "#rrggbb" check wherever
    // this palette gets consumed downstream (industryFallbackColor).
    const toHex = (rgbStr) => {
      const m = rgbStr.match(/^rgba?\(([^)]+)\)$/i);
      if (!m) return null;
      const p = m[1].split(",").map((x) => parseFloat(x.trim()));
      if (p.length < 3 || p.slice(0, 3).some((n) => !Number.isFinite(n))) return null;
      const c = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
      return "#" + c(p[0]) + c(p[1]) + c(p[2]);
    };

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
        const hex = toHex(c);
        if (!hex) continue;
        paint.set(hex, (paint.get(hex) || 0) + area);
      }
    }
    const totalArea = [...paint.values()].reduce((a, b) => a + b, 0) || 1;
    const palette = [...paint.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([hex, area]) => ({ hex, areaShare: area / totalArea }));

    // Card-level: the popup's own background, corner radius, padding/density,
    // and whether it has a visible shadow — read straight off popupEl itself,
    // not inferred from the painted-area sweep above.
    const backgroundColor = toHex(style.backgroundColor);
    const cornerRadius = style.borderRadius || null;
    const padding = style.padding || null;
    const hasShadow = Boolean(style.boxShadow) && style.boxShadow !== "none";
    let density = null;
    const padNums = padding && padding.match(/[\d.]+/g);
    if (padNums) {
      const maxPad = Math.max(...padNums.map(Number));
      density = maxPad < 16 ? "compact" : maxPad > 32 ? "airy" : "regular";
    }

    // Button-level: the CTA's own fill colour, corner radius (→ shape), and
    // whether it's filled or outline — read off ctaEl specifically, so
    // "accentColor" answers "what colour IS the button", not just "some
    // colour appeared somewhere in the popup".
    let accentColor = null, buttonRadius = null, buttonShape = null, buttonFill = null;
    if (ctaEl) {
      const btnStyle = getComputedStyle(ctaEl);
      const btnRect = ctaEl.getBoundingClientRect();
      accentColor = toHex(btnStyle.backgroundColor);
      buttonRadius = btnStyle.borderRadius || null;
      const radiusPx = parseFloat(btnStyle.borderRadius) || 0;
      buttonShape = radiusPx >= btnRect.height / 2 - 1 && btnRect.height > 0 ? "pill" : radiusPx > 4 ? "rounded" : "rect";
      const hasBg = btnStyle.backgroundColor && btnStyle.backgroundColor !== "rgba(0, 0, 0, 0)" && btnStyle.backgroundColor !== "transparent";
      const hasBorder = parseFloat(btnStyle.borderWidth) > 0 && btnStyle.borderStyle !== "none";
      buttonFill = hasBg ? "solid" : hasBorder ? "outline" : "solid";
    }

    // Typography: headline's own font/size/weight/colour, body's own font —
    // not the popup's aggregate style, the specific element's.
    let headlineFont = null, headlineFontSize = null, fontWeight = null, textColor = null;
    if (headlineEl) {
      const hStyle = getComputedStyle(headlineEl);
      headlineFont = hStyle.fontFamily || null;
      headlineFontSize = hStyle.fontSize || null;
      fontWeight = hStyle.fontWeight || null;
      textColor = toHex(hStyle.color);
    }
    const bodyFont = subheadEl ? (getComputedStyle(subheadEl).fontFamily || null) : null;

    // Imagery: presence + position, from the image's own geometry relative
    // to the popup card (large + tall → background; wide + upper → top band;
    // anything else with an image → side).
    let imagePosition = "none";
    if (imgEl) {
      const imgRect = imgEl.getBoundingClientRect();
      if (imgRect.width >= rect.width * 0.8 && imgRect.height >= rect.height * 0.5) {
        imagePosition = "background";
      } else if (imgRect.top < rect.top + rect.height * 0.3 && imgRect.width >= rect.width * 0.7) {
        imagePosition = "top";
      } else {
        imagePosition = "side";
      }
    }

    return {
      present: true,
      selector: popupEl.className || popupEl.tagName,
      html: popupEl.outerHTML.slice(0, 20000),
      design: {
        template: templateGuess,
        layout: layoutGuess,
        headline: txt(headlineEl),
        subhead: txt(subheadEl),
        ctaText: txt(ctaEl),
        palette,
        backgroundColor,
        accentColor,
        textColor,
        headlineFont,
        bodyFont,
        headlineFontSize,
        fontWeight,
        cornerRadius,
        buttonRadius,
        buttonShape,
        buttonFill,
        padding,
        density,
        hasImage: Boolean(imgEl),
        imagePosition,
        hasShadow,
      },
    };
  });

  // Built out here, not inside page.evaluate() above — that callback runs in
  // the browser context with no closure over pageSignal (a plain Node/outer
  // variable at this point).
  data.industrySignal = [pageSignal, data.design && data.design.headline, data.design && data.design.subhead].filter(Boolean).join(" . ");

  if (!data.present) {
    return { data, type: "application/json" };
  }

  // Screenshot the matched element specifically, cropped rather than a full
  // viewport capture — this has to happen from the outer Puppeteer context,
  // not inside page.evaluate(), since it needs an ElementHandle. Re-selects
  // via the data-asmos-scrape-target marker set above, so this is guaranteed
  // to be the exact same (non-cookie-notice) element, not a re-run of the
  // selection logic that could drift from it.
  try {
    const el = await page.$("[data-asmos-scrape-target]");
    if (el) {
      data.screenshot = await el.screenshot({ encoding: "base64", type: "jpeg", quality: 80 });
    }
  } catch {
    // Screenshot is a nice-to-have; the structured data above is still useful without it.
  }

  return { data, type: "application/json" };
}
`.trim();
