/**
 * lib/storeExtraction.ts
 *
 * Measuring a store, rather than guessing at it.
 *
 * WHAT WAS WRONG
 * --------------
 * `/api/analyze` took a 1280x900 above-the-fold JPEG of the homepage and asked
 * a vision model to name hex codes and identify typefaces from it, with an HTML
 * regex pass as backup. Almost every field it produced was a guess:
 *
 *  - Colours came from a language model reading a quality-75 JPEG. Vision
 *    models are unreliable at naming exact hex, which is why output could feel
 *    almost-but-not-quite on-brand even when the pipeline "worked".
 *  - Fonts came from the same guess, or from regexing `--font-heading` out of
 *    the raw HTML string — which is not where a modern Shopify or Next
 *    storefront keeps its CSS.
 *  - `brandColor` fell back to `#165DFF`, Asmos's own blue, indistinguishable
 *    downstream from a successful extraction.
 *  - `logoUrl` was `og:image`: the social share card, which is a product or
 *    lifestyle shot on approximately every store.
 *  - "What the store is about" was the meta description, truncated to 160
 *    characters of SEO boilerplate.
 *  - Nothing looked at the catalogue at all.
 *
 * WHAT THIS DOES INSTEAD
 * ----------------------
 * Four sources, ranked by confidence, each recording its provenance:
 *
 *  1. `fetchCatalogue`  — the store's own product data. Shopify exposes the
 *     whole catalogue at /products.json with no key; WooCommerce has the Store
 *     API; everything else usually emits JSON-LD Product schema for SEO. This
 *     single request answers what they sell, who for, and at what price — every
 *     question the screenshot could only guess at.
 *  2. `DOM_EXTRACTION_FN` — real `getComputedStyle` values via Browserless's
 *     /function endpoint. We were already paying for a headless browser and
 *     only asking it for a photograph.
 *  3. `paletteFromPixels`  — colour measured from the screenshot's actual
 *     pixels when the DOM pass is unavailable.
 *  4. A vision/text model, for judgment only: voice, audience, what is
 *     distinctive. See the prompt in /api/analyze/route.ts.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type FieldSource = "catalogue" | "dom" | "pixels" | "model" | "html" | "default";

export type Provenance = Record<string, { source: FieldSource; confidence: number }>;

export type PaletteEntry = { hex: string; areaShare: number; role?: string };

export type DomExtraction = {
  displayFont: string | null;
  bodyFont: string | null;
  buttonStyle: {
    bg: string | null;
    fg: string | null;
    radius: string | null;
    textTransform: string | null;
    letterSpacing: string | null;
    fontWeight: string | null;
  } | null;
  colorsByArea: { color: string; area: number }[];
  borderRadius: string | null;
  logo: string | null;
  productImages: string[];
  h1: string | null;
  heroText: string | null;
  detectedPopup: { present: boolean; selector: string | null } | null;
  platform: "shopify" | "woocommerce" | "custom" | null;
  currency: string | null;
};

export type CatalogueSummary = {
  productCount: number;
  productTypes: string[];
  tags: string[];
  titles: string[];
  vendors: string[];
  priceMin: number | null;
  priceMax: number | null;
  priceMedian: number | null;
  currency: string | null;
  images: string[];
  source: "shopify" | "woocommerce" | "jsonld" | null;
};

// ─── 1. Catalogue ────────────────────────────────────────────────────────────

const CATALOGUE_TIMEOUT_MS = 7000;
const MAX_PRODUCTS = 250;

async function getJson(url: string, timeoutMs = CATALOGUE_TIMEOUT_MS): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "AsmosBot/1.0 (+https://asmos.io)", Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "follow",
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("json")) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

function topN(values: string[], n: number): string[] {
  const counts = new Map<string, number>();
  for (const v of values) {
    const key = v.trim().toLowerCase();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
}

/** Prices arrive as "24.00" (Shopify) or 2400 (Store API, minor units). Normalise to minor units. */
function toMinorUnits(value: unknown, alreadyMinor: boolean): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return alreadyMinor ? Math.round(value) : Math.round(value * 100);
  }
  if (typeof value === "string") {
    const n = parseFloat(value);
    if (!Number.isFinite(n)) return null;
    return alreadyMinor ? Math.round(n) : Math.round(n * 100);
  }
  return null;
}

type ShopifyProduct = {
  title?: string;
  product_type?: string;
  vendor?: string;
  tags?: string[] | string;
  images?: { src?: string }[];
  variants?: { price?: string; compare_at_price?: string | null }[];
};

async function fetchShopifyCatalogue(origin: string): Promise<CatalogueSummary | null> {
  const data = (await getJson(`${origin}/products.json?limit=${MAX_PRODUCTS}`)) as
    | { products?: ShopifyProduct[] }
    | null;
  const products = data?.products;
  if (!Array.isArray(products) || products.length === 0) return null;

  const prices: number[] = [];
  const images: string[] = [];
  const titles: string[] = [];
  const types: string[] = [];
  const tags: string[] = [];
  const vendors: string[] = [];

  for (const p of products) {
    if (p.title) titles.push(p.title);
    if (p.product_type) types.push(p.product_type);
    if (p.vendor) vendors.push(p.vendor);
    // `tags` is an array on /products.json and a comma-joined string in some
    // theme payloads. Both shapes appear in the wild.
    if (Array.isArray(p.tags)) tags.push(...p.tags);
    else if (typeof p.tags === "string") tags.push(...p.tags.split(",").map((t) => t.trim()));
    for (const img of p.images ?? []) if (img.src) images.push(img.src);
    for (const v of p.variants ?? []) {
      const price = toMinorUnits(v.price, false);
      if (price !== null && price > 0) prices.push(price);
    }
  }

  return {
    productCount: products.length,
    productTypes: topN(types, 8),
    tags: topN(tags, 20),
    titles: titles.slice(0, 40),
    vendors: topN(vendors, 5),
    priceMin: prices.length ? Math.min(...prices) : null,
    priceMax: prices.length ? Math.max(...prices) : null,
    priceMedian: median(prices),
    currency: null, // Shopify's products.json omits it; the DOM pass supplies it.
    images: images.slice(0, 24),
    source: "shopify",
  };
}

type WooProduct = {
  name?: string;
  categories?: { name?: string }[];
  images?: { src?: string }[];
  prices?: { price?: string; currency_code?: string; currency_minor_unit?: number };
};

async function fetchWooCatalogue(origin: string): Promise<CatalogueSummary | null> {
  const data = (await getJson(`${origin}/wp-json/wc/store/v1/products?per_page=100`)) as
    | WooProduct[]
    | null;
  if (!Array.isArray(data) || data.length === 0) return null;

  const prices: number[] = [];
  const images: string[] = [];
  const titles: string[] = [];
  const types: string[] = [];
  let currency: string | null = null;

  for (const p of data) {
    if (p.name) titles.push(p.name);
    for (const c of p.categories ?? []) if (c.name) types.push(c.name);
    for (const img of p.images ?? []) if (img.src) images.push(img.src);
    // The Store API already returns minor units, with the exponent alongside.
    const price = toMinorUnits(p.prices?.price, true);
    if (price !== null && price > 0) prices.push(price);
    if (!currency && p.prices?.currency_code) currency = p.prices.currency_code;
  }

  return {
    productCount: data.length,
    productTypes: topN(types, 8),
    tags: [],
    titles: titles.slice(0, 40),
    vendors: [],
    priceMin: prices.length ? Math.min(...prices) : null,
    priceMax: prices.length ? Math.max(...prices) : null,
    priceMedian: median(prices),
    currency,
    images: images.slice(0, 24),
    source: "woocommerce",
  };
}

/**
 * Last resort for stores on neither platform (and for the significant minority
 * of Shopify stores that disable /products.json): read JSON-LD Product schema
 * off a few pages. Nearly every ecommerce platform emits it for SEO.
 */
async function fetchJsonLdCatalogue(html: string): Promise<CatalogueSummary | null> {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const titles: string[] = [];
  const types: string[] = [];
  const images: string[] = [];
  const prices: number[] = [];
  let currency: string | null = null;

  const visit = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== "object") return;
    const obj = node as Record<string, unknown>;
    const type = obj["@type"];
    const isProduct = type === "Product" || (Array.isArray(type) && type.includes("Product"));
    if (isProduct) {
      if (typeof obj.name === "string") titles.push(obj.name);
      if (typeof obj.category === "string") types.push(obj.category);
      const img = obj.image;
      if (typeof img === "string") images.push(img);
      else if (Array.isArray(img)) img.forEach((i) => typeof i === "string" && images.push(i));
      const offers = obj.offers as Record<string, unknown> | Record<string, unknown>[] | undefined;
      for (const offer of Array.isArray(offers) ? offers : offers ? [offers] : []) {
        const price = toMinorUnits(offer.price, false);
        if (price !== null && price > 0) prices.push(price);
        if (!currency && typeof offer.priceCurrency === "string") currency = offer.priceCurrency;
      }
    }
    // ItemList / @graph wrappers are common; walk everything.
    for (const value of Object.values(obj)) if (value && typeof value === "object") visit(value);
  };

  for (const block of blocks) {
    try { visit(JSON.parse(block[1])); } catch { /* malformed JSON-LD is common; skip it */ }
  }
  if (titles.length === 0) return null;

  return {
    productCount: titles.length,
    productTypes: topN(types, 8),
    tags: [],
    titles: titles.slice(0, 40),
    vendors: [],
    priceMin: prices.length ? Math.min(...prices) : null,
    priceMax: prices.length ? Math.max(...prices) : null,
    priceMedian: median(prices),
    currency,
    images: images.slice(0, 24),
    source: "jsonld",
  };
}

/**
 * Tries every catalogue source in confidence order. Returns null only when the
 * store exposes nothing — in which case the caller should say so rather than
 * inventing a category.
 */
export async function fetchCatalogue(storeUrl: string, html = ""): Promise<CatalogueSummary | null> {
  let origin: string;
  try { origin = new URL(storeUrl).origin; } catch { return null; }

  const shopify = await fetchShopifyCatalogue(origin);
  if (shopify) return shopify;

  const woo = await fetchWooCatalogue(origin);
  if (woo) return woo;

  if (html) {
    const jsonld = await fetchJsonLdCatalogue(html);
    if (jsonld) return jsonld;
  }
  return null;
}

// ─── 2. DOM extraction ───────────────────────────────────────────────────────

/**
 * The body of a Browserless `/function` call.
 *
 * Everything in here is a value the vision pass was previously being asked to
 * guess. `getComputedStyle` knows the answers exactly, and we are already
 * paying for the browser that can read them.
 *
 * Kept as a string rather than a real function so it can be posted verbatim,
 * and deliberately dependency-free — it runs in the merchant's page context.
 */
export const DOM_EXTRACTION_FN = `
export default async function ({ page, context }) {
  const { url } = context;
  await page.goto(url, { waitUntil: "networkidle2", timeout: 25000 });
  // Give lazy hero imagery and webfonts a beat, but not long enough for the
  // store's own popup to take over the viewport.
  await new Promise((r) => setTimeout(r, 1200));

  const data = await page.evaluate(() => {
    const cs = (el) => (el ? getComputedStyle(el) : null);
    const txt = (el) => (el && el.textContent ? el.textContent.trim().slice(0, 300) : null);

    const h1 = document.querySelector("h1");
    const button =
      document.querySelector("button[type=submit], .btn, [class*='button'], a[class*='btn'], button") || null;

    // Colour by painted area. A language model reading a JPEG cannot do this;
    // the layout engine already has the numbers.
    const paint = new Map();
    const nodes = document.querySelectorAll("body *");
    const limit = Math.min(nodes.length, 4000);
    for (let i = 0; i < limit; i++) {
      const el = nodes[i];
      const r = el.getBoundingClientRect();
      if (r.width < 6 || r.height < 6) continue;
      if (r.top > 4000) continue;
      const s = getComputedStyle(el);
      const area = r.width * r.height;
      for (const c of [s.backgroundColor, s.color, s.borderTopColor]) {
        if (!c || c === "rgba(0, 0, 0, 0)" || c === "transparent") continue;
        paint.set(c, (paint.get(c) || 0) + area);
      }
    }
    const colorsByArea = [...paint.entries()]
      .sort((a, b) => b[1] - a[1]).slice(0, 30)
      .map(([color, area]) => ({ color, area }));

    const imgSrc = (i) => i.currentSrc || i.src || "";
    const productImages = [...document.querySelectorAll(
      "[class*='product'] img, [class*='card'] img, [class*='grid'] img, main img"
    )]
      .filter((i) => { const r = i.getBoundingClientRect(); return r.width > 120 && r.height > 120; })
      .map(imgSrc).filter(Boolean).slice(0, 16);

    const logoEl =
      document.querySelector("header [class*='logo'] img, [class*='logo'] img, header a[href='/'] img, header img") ||
      null;

    const popupEl = document.querySelector(
      "[class*='modal'][class*='open'], [class*='popup']:not([hidden]), [role='dialog'], [class*='newsletter'][class*='modal']"
    );

    const currencyMeta =
      document.querySelector("meta[property='product:price:currency'], meta[itemprop='priceCurrency']");

    return {
      displayFont: cs(h1) ? cs(h1).fontFamily : null,
      bodyFont: cs(document.body) ? cs(document.body).fontFamily : null,
      buttonStyle: button ? {
        bg: cs(button).backgroundColor, fg: cs(button).color,
        radius: cs(button).borderRadius,
        textTransform: cs(button).textTransform,
        letterSpacing: cs(button).letterSpacing,
        fontWeight: cs(button).fontWeight,
      } : null,
      colorsByArea,
      borderRadius: button ? cs(button).borderRadius : null,
      logo: logoEl ? imgSrc(logoEl) : null,
      productImages,
      h1: txt(h1),
      heroText: txt(document.querySelector("main p, header + section p, h1 + p")),
      detectedPopup: { present: !!popupEl, selector: popupEl ? (popupEl.className || popupEl.tagName) : null },
      platform: window.Shopify ? "shopify"
        : document.querySelector("[class*='woocommerce'], body.woocommerce") ? "woocommerce"
        : "custom",
      currency: currencyMeta ? currencyMeta.getAttribute("content") : null,
    };
  });

  return { data, type: "application/json" };
}
`.trim();

/** Normalises whatever the /function call returned into a typed shape. */
export function normalizeDomExtraction(raw: unknown): DomExtraction | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const colors = Array.isArray(d.colorsByArea)
    ? (d.colorsByArea as { color?: unknown; area?: unknown }[])
        .filter((c) => typeof c.color === "string" && typeof c.area === "number")
        .map((c) => ({ color: c.color as string, area: c.area as number }))
    : [];
  return {
    displayFont: str(d.displayFont),
    bodyFont: str(d.bodyFont),
    buttonStyle: (d.buttonStyle as DomExtraction["buttonStyle"]) ?? null,
    colorsByArea: colors,
    borderRadius: str(d.borderRadius),
    logo: str(d.logo),
    productImages: Array.isArray(d.productImages)
      ? (d.productImages as unknown[]).filter((i): i is string => typeof i === "string")
      : [],
    h1: str(d.h1),
    heroText: str(d.heroText),
    detectedPopup: (d.detectedPopup as DomExtraction["detectedPopup"]) ?? null,
    platform: (str(d.platform) as DomExtraction["platform"]) ?? null,
    currency: str(d.currency),
  };
}

// ─── 3. Palette ──────────────────────────────────────────────────────────────

function parseCssColor(value: string): { r: number; g: number; b: number; a: number } | null {
  const rgba = value.match(/^rgba?\(([^)]+)\)$/i);
  if (rgba) {
    const p = rgba[1].split(",").map((x) => parseFloat(x.trim()));
    if (p.length < 3 || p.slice(0, 3).some((n) => !Number.isFinite(n))) return null;
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }
  const hex = value.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: 1,
    };
  }
  return null;
}

function hex({ r, g, b }: { r: number; g: number; b: number }): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/**
 * Turns painted-area measurements into a brand palette.
 *
 * Drops neutrals (near-white, near-black, near-grey), which are page chrome
 * rather than brand, and merges colours that are close enough to read as one —
 * two near-identical blues in the output look like a rendering mistake, not a
 * two-colour identity.
 */
export function paletteFromDom(colorsByArea: { color: string; area: number }[]): PaletteEntry[] {
  const candidates: { r: number; g: number; b: number; area: number }[] = [];
  let totalArea = 0;

  for (const entry of colorsByArea) {
    const c = parseCssColor(entry.color);
    if (!c || c.a < 0.8) continue;
    const max = Math.max(c.r, c.g, c.b);
    const min = Math.min(c.r, c.g, c.b);
    totalArea += entry.area;
    if (max - min < 26) continue;      // greyscale
    if (max > 246 || max < 22) continue; // near-white / near-black
    candidates.push({ r: c.r, g: c.g, b: c.b, area: entry.area });
  }
  if (candidates.length === 0) return [];

  const merged: { r: number; g: number; b: number; area: number }[] = [];
  for (const c of candidates) {
    const near = merged.find(
      (m) => Math.abs(m.r - c.r) + Math.abs(m.g - c.g) + Math.abs(m.b - c.b) < 70,
    );
    if (near) {
      // Area-weighted mean, so the dominant instance pulls the merged value.
      const w = near.area + c.area;
      near.r = (near.r * near.area + c.r * c.area) / w;
      near.g = (near.g * near.area + c.g * c.area) / w;
      near.b = (near.b * near.area + c.b * c.area) / w;
      near.area = w;
    } else {
      merged.push({ ...c });
    }
  }

  return merged
    .sort((a, b) => b.area - a.area)
    .slice(0, 6)
    .map((m) => ({
      hex: hex(m),
      areaShare: totalArea > 0 ? Math.round((m.area / totalArea) * 1000) / 1000 : 0,
    }));
}

// ─── 4. Inference ────────────────────────────────────────────────────────────

/**
 * A price-aware offer recommendation.
 *
 * `ai_choice` previously mapped a category to an offer through five hardcoded
 * lines in the prompt (fashion → percentage, home goods → free shipping…). With
 * a real price band this becomes a defensible calculation: a £15 average order
 * should not be offering 15% off — £2.25 is not an incentive, it is a rounding
 * error — where free shipping over £30 both converts and raises basket size.
 * A £400 order should not be discounted at all.
 */
export function recommendOffer(catalogue: CatalogueSummary | null): {
  type: "percentage" | "free_shipping" | "fixed_amount" | "value_only";
  rationale: string;
  suggestedPercent?: number;
  suggestedThresholdMinor?: number;
} {
  const median = catalogue?.priceMedian ?? null;
  if (median === null) {
    return { type: "percentage", suggestedPercent: 10, rationale: "No catalogue data; conservative default." };
  }
  if (median < 2500) {
    return {
      type: "free_shipping",
      suggestedThresholdMinor: Math.round((median * 1.8) / 500) * 500,
      rationale: `Median item ${(median / 100).toFixed(2)}. A percentage discount is worth too little to move anyone; a shipping threshold above the median item raises basket size instead.`,
    };
  }
  if (median < 12000) {
    return {
      type: "percentage",
      suggestedPercent: 10,
      rationale: `Median item ${(median / 100).toFixed(2)}. A first-order percentage is meaningful at this price without giving away the margin.`,
    };
  }
  if (median < 40000) {
    return {
      type: "fixed_amount",
      suggestedThresholdMinor: Math.round((median * 0.08) / 500) * 500,
      rationale: `Median item ${(median / 100).toFixed(2)}. A stated amount reads as larger than the equivalent percentage and is easier to cap.`,
    };
  }
  return {
    type: "value_only",
    rationale: `Median item ${(median / 100).toFixed(2)}. At this price a discount signals the item was overpriced; early access and expertise convert better.`,
  };
}

/** Compact catalogue digest for the brand-analyst prompt. */
export function catalogueForPrompt(catalogue: CatalogueSummary | null): string {
  if (!catalogue) return "No catalogue data available (store exposes no product feed).";
  const price = (v: number | null) => (v === null ? "?" : (v / 100).toFixed(2));
  return [
    `source: ${catalogue.source}`,
    `products sampled: ${catalogue.productCount}`,
    catalogue.productTypes.length ? `product types: ${catalogue.productTypes.join(", ")}` : null,
    catalogue.tags.length ? `tags: ${catalogue.tags.slice(0, 15).join(", ")}` : null,
    `price range: ${price(catalogue.priceMin)} - ${price(catalogue.priceMax)} (median ${price(catalogue.priceMedian)})`,
    catalogue.titles.length ? `example products:\n  - ${catalogue.titles.slice(0, 18).join("\n  - ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}
