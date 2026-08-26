/**
 * lib/templates/fonts.ts
 *
 * Typography for generated popups, served from Google Fonts.
 *
 * WHY THIS EXISTS
 * ---------------
 * Every template hardcoded `font-family: system-ui, -apple-system, "Segoe UI",
 * sans-serif`. One face, one voice, on every popup the product has ever
 * generated - which is most of the reason the output reads as "a div with text
 * in it" rather than as design. Typography is the single largest lever on
 * perceived quality and it was the one knob the DNA couldn't turn.
 *
 * Worse, the pipeline to do better already existed and was being thrown away:
 * `/api/analyze` extracts the store's real display and body fonts (from their
 * CSS and from a vision pass over a screenshot), carries them through
 * `popupGeneration.ts` as `design_tokens.type_display` / `type_body` - and then
 * no template ever reads them. `brand` pairing below is what finally uses that.
 *
 * DELIVERY
 * --------
 * A `@import` emitted as the *first* rule of the popup's own <style> block.
 * @import is only honoured when it precedes every other rule in its stylesheet,
 * so `fontImportCss()` must stay at the very top of each template's <style> -
 * see the call sites in splitScreen/cornerToast/fullscreenTakeover.
 *
 * This runs on a merchant's production site, so two rules hold:
 *  1. Every pairing declares a complete fallback stack. A merchant with a
 *     `font-src`/`style-src` CSP that excludes Google, or a visitor behind a
 *     network that blocks it, gets a deliberate second choice rather than
 *     whatever the browser's default serif happens to be.
 *  2. `display=swap`, always. A popup that renders invisible text while a font
 *     downloads is a popup that converts at zero.
 */

import type { PopupDna, TypePairing } from "@/lib/popupDna";

type FontSpec = {
  /** Google Fonts family name, or null for "use what's already on the device". */
  family: string | null;
  /** css2 `wght` axis values to request. Keep these tight - every weight is bytes. */
  weights: number[];
  /** Full CSS stack, including the Google family when there is one. */
  stack: string;
};

type Pairing = {
  display: FontSpec;
  body: FontSpec;
  /**
   * Display faces vary wildly in apparent size at the same px value. Playfair
   * runs small, Archivo Black runs huge. This multiplies --asmos-headline-size
   * so `type_scale: large` means the same *optical* thing across pairings.
   */
  displayScale: number;
  /** Tracking for the headline. Display serifs want less; condensed wants none. */
  displayTracking: string;
  /** Weight the headline renders at. */
  displayWeight: number;
};

const SYSTEM_SANS = `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
const SYSTEM_SERIF = `Georgia, "Times New Roman", Times, serif`;

const PAIRINGS: Record<TypePairing, Pairing> = {
  /**
   * Editorial - a high-contrast display serif over a neutral sans. The look
   * that reads as "considered" rather than "marketing", and the reason a
   * fashion or beauty store's popup can stop looking like an ad.
   */
  editorial: {
    display: {
      family: "Playfair Display",
      weights: [500, 600],
      stack: `"Playfair Display", ${SYSTEM_SERIF}`,
    },
    body: { family: "Inter", weights: [400, 500], stack: `"Inter", ${SYSTEM_SANS}` },
    displayScale: 1.18,
    displayTracking: "-0.012em",
    displayWeight: 500,
  },

  /**
   * Bold - a heavy grotesque with almost no counter space, sized to be the
   * loudest object on the page. Pairs with `art_direction: bold`, where the
   * discount number is the hero rather than the sentence around it.
   */
  bold: {
    display: {
      family: "Archivo Black",
      weights: [400],
      stack: `"Archivo Black", "Helvetica Neue", Arial Black, ${SYSTEM_SANS}`,
    },
    body: { family: "Inter", weights: [400, 600], stack: `"Inter", ${SYSTEM_SANS}` },
    displayScale: 1.02,
    displayTracking: "-0.03em",
    displayWeight: 400,
  },

  /**
   * Geometric - round, even, friendly. The safest choice for a store with no
   * strong identity of its own, and the one least likely to clash with
   * whatever the merchant's own site is using.
   */
  geometric: {
    display: {
      family: "Poppins",
      weights: [600, 700],
      stack: `"Poppins", ${SYSTEM_SANS}`,
    },
    body: { family: "Poppins", weights: [400, 500], stack: `"Poppins", ${SYSTEM_SANS}` },
    displayScale: 1.0,
    displayTracking: "-0.02em",
    displayWeight: 700,
  },

  /**
   * Grotesque - contemporary, slightly technical. Reads as software rather
   * than retail, which is exactly right for the soft/glass direction.
   */
  grotesque: {
    display: {
      family: "Plus Jakarta Sans",
      weights: [600, 700],
      stack: `"Plus Jakarta Sans", ${SYSTEM_SANS}`,
    },
    body: {
      family: "Plus Jakarta Sans",
      weights: [400, 500],
      stack: `"Plus Jakarta Sans", ${SYSTEM_SANS}`,
    },
    displayScale: 1.0,
    displayTracking: "-0.022em",
    displayWeight: 700,
  },

  /**
   * Brand - the store's own typeface, when `/api/analyze` managed to identify
   * one that Google serves. Resolved at render time by `resolveBrandPairing`;
   * this entry is the fallback for when it didn't.
   */
  brand: {
    display: {
      family: "Inter",
      weights: [600, 700],
      stack: `"Inter", ${SYSTEM_SANS}`,
    },
    body: { family: "Inter", weights: [400, 500], stack: `"Inter", ${SYSTEM_SANS}` },
    displayScale: 1.0,
    displayTracking: "-0.02em",
    displayWeight: 700,
  },

  /**
   * System - no network request at all. Not a cop-out: it's the correct choice
   * for a corner toast, for a merchant on a strict CSP, and as the control arm
   * when the campaign is testing whether typography moves conversion at all.
   */
  system: {
    display: { family: null, weights: [], stack: SYSTEM_SANS },
    body: { family: null, weights: [], stack: SYSTEM_SANS },
    displayScale: 1.0,
    displayTracking: "-0.015em",
    displayWeight: 800,
  },
};

/**
 * Google-served families common enough on real ecommerce sites to be worth
 * matching a scraped font name against. Deliberately not exhaustive - a wrong
 * match is worse than no match, because it ships a font that isn't the
 * merchant's and claims it is.
 */
const BRAND_SAFE_GOOGLE_FAMILIES: { match: RegExp; family: string; serif: boolean }[] = [
  { match: /^inter$/i, family: "Inter", serif: false },
  { match: /^poppins$/i, family: "Poppins", serif: false },
  { match: /^montserrat$/i, family: "Montserrat", serif: false },
  { match: /^lato$/i, family: "Lato", serif: false },
  { match: /^raleway$/i, family: "Raleway", serif: false },
  { match: /^nunito(\s+sans)?$/i, family: "Nunito Sans", serif: false },
  { match: /^open\s*sans$/i, family: "Open Sans", serif: false },
  { match: /^work\s*sans$/i, family: "Work Sans", serif: false },
  { match: /^dm\s*sans$/i, family: "DM Sans", serif: false },
  { match: /^manrope$/i, family: "Manrope", serif: false },
  { match: /^outfit$/i, family: "Outfit", serif: false },
  { match: /^rubik$/i, family: "Rubik", serif: false },
  { match: /^karla$/i, family: "Karla", serif: false },
  { match: /^figtree$/i, family: "Figtree", serif: false },
  { match: /^space\s*grotesk$/i, family: "Space Grotesk", serif: false },
  { match: /^jost$/i, family: "Jost", serif: false },
  { match: /^playfair\s*display$/i, family: "Playfair Display", serif: true },
  { match: /^lora$/i, family: "Lora", serif: true },
  { match: /^merriweather$/i, family: "Merriweather", serif: true },
  { match: /^cormorant(\s+garamond)?$/i, family: "Cormorant Garamond", serif: true },
  { match: /^libre\s*baskerville$/i, family: "Libre Baskerville", serif: true },
  { match: /^dm\s*serif\s*(display|text)$/i, family: "DM Serif Display", serif: true },
  { match: /^fraunces$/i, family: "Fraunces", serif: true },
  { match: /^eb\s*garamond$/i, family: "EB Garamond", serif: true },
];

/**
 * Pulls the first concrete family name out of a CSS font stack.
 * `"Gotham", 'Helvetica Neue', sans-serif` -> `Gotham`.
 */
function firstFamily(stack: string | null | undefined): string | null {
  if (!stack) return null;
  const first = stack.split(",")[0]?.trim().replace(/^["']|["']$/g, "");
  if (!first) return null;
  // Generic keywords carry no identity - treat them as "we found nothing".
  if (/^(system-ui|-apple-system|sans-serif|serif|monospace|inherit|initial|ui-\w+)$/i.test(first)) {
    return null;
  }
  return first;
}

/**
 * `type_pairing: "brand"` with a store font Google actually serves. Returns
 * null when the scraped name isn't on the safe list, so the caller falls back
 * to the generic `brand` pairing rather than requesting a family that 404s.
 */
function resolveBrandPairing(displayStack?: string | null, bodyStack?: string | null): Pairing | null {
  const displayName = firstFamily(displayStack);
  if (!displayName) return null;

  const hit = BRAND_SAFE_GOOGLE_FAMILIES.find((f) => f.match.test(displayName));
  if (!hit) return null;

  const bodyName = firstFamily(bodyStack);
  const bodyHit = bodyName ? BRAND_SAFE_GOOGLE_FAMILIES.find((f) => f.match.test(bodyName)) : undefined;

  const fallback = hit.serif ? SYSTEM_SERIF : SYSTEM_SANS;

  return {
    display: {
      family: hit.family,
      weights: [600, 700],
      stack: `"${hit.family}", ${fallback}`,
    },
    body: bodyHit
      ? { family: bodyHit.family, weights: [400, 500], stack: `"${bodyHit.family}", ${SYSTEM_SANS}` }
      : { family: "Inter", weights: [400, 500], stack: `"Inter", ${SYSTEM_SANS}` },
    displayScale: hit.serif ? 1.12 : 1.0,
    displayTracking: hit.serif ? "-0.012em" : "-0.02em",
    displayWeight: 700,
  };
}

export type ResolvedFonts = {
  displayStack: string;
  bodyStack: string;
  displayScale: number;
  displayTracking: string;
  displayWeight: number;
  /** The `@import` line, or "" when the pairing needs no network request. */
  importCss: string;
};

export type BrandFontHints = {
  type_display?: string | null;
  type_body?: string | null;
};

/**
 * Builds one css2 request covering every family the popup needs. One request,
 * not two - a second round trip to fonts.googleapis.com on a merchant's
 * critical path for the sake of tidier code is not a trade worth making.
 */
function buildImport(specs: FontSpec[]): string {
  const families = new Map<string, Set<number>>();
  for (const spec of specs) {
    if (!spec.family) continue;
    const weights = families.get(spec.family) ?? new Set<number>();
    for (const w of spec.weights) weights.add(w);
    families.set(spec.family, weights);
  }
  if (families.size === 0) return "";

  const params = [...families.entries()]
    .map(([family, weights]) => {
      const name = family.replace(/ /g, "+");
      const list = [...weights].sort((a, b) => a - b).join(";");
      return `family=${name}:wght@${list}`;
    })
    .join("&");

  return `@import url('https://fonts.googleapis.com/css2?${params}&display=swap');`;
}

export function resolveFonts(dna: PopupDna, brand?: BrandFontHints | null): ResolvedFonts {
  const pairing =
    (dna.type_pairing === "brand" ? resolveBrandPairing(brand?.type_display, brand?.type_body) : null) ??
    PAIRINGS[dna.type_pairing] ??
    PAIRINGS.system;

  return {
    displayStack: pairing.display.stack,
    bodyStack: pairing.body.stack,
    displayScale: pairing.displayScale,
    displayTracking: pairing.displayTracking,
    displayWeight: pairing.displayWeight,
    importCss: buildImport([pairing.display, pairing.body]),
  };
}

/**
 * MUST be emitted as the first thing inside a template's <style> block -
 * a stylesheet ignores any @import that follows another rule.
 */
export function fontImportCss(fonts: ResolvedFonts): string {
  return fonts.importCss;
}
