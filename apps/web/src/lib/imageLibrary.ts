// Curated Unsplash placeholder image library for AI popup generation.
//
// Single source of truth for every Unsplash hotlink used across the app —
// previously the same ~3-4 photo IDs were hardcoded independently in
// popupGeneration.ts's prompt, splitScreen.ts's fallback, and
// VisualEditor.tsx's manual picker, so "unique popup every time" broke down
// on the image axis: almost every generated popup ended up with one of the
// same 3 pictures. This module widens that pool and groups it by store
// category so the AI (and the manual editor) can pick something that
// actually fits the store instead of reaching for the same generic shot.
//
// There's no Unsplash API key configured for this project (no
// UNSPLASH_ACCESS_KEY anywhere), so these are direct images.unsplash.com
// CDN hotlinks to specific, individually-chosen photo IDs rather than a
// live search API.
//
// ─── CURATION CONTRACT ──────────────────────────────────────────────────────
//
// EVERY image in this file must be free of legible text, numerals, percentage
// signs, price tags, and signage. This is not a style preference — it is a
// correctness requirement, because the popup's copy is generated independently
// of the image and the two will contradict each other.
//
// This rule exists because it was already violated. The library used to carry a
// "General / Abstract / Discount" category whose only entry was a photograph of
// gift boxes with "SALE" and a large "50%" printed across it. The generator was
// explicitly told to reach for that category when no other one fit — so a store
// running a 10% offer shipped a popup reading "A 10% welcome credit" directly
// underneath a photo of the number 50%. There is no prompt wording that fixes
// that; the only fix is not to have such an image in the pool.
//
// The whole discount/abstract category is gone with it. A popup with nothing
// relevant to show should show nothing — see `image_treatment: "none"` and the
// null-image handling in splitScreen.ts / fullscreenTakeover.ts. An irrelevant
// image is strictly worse than no image.
//
// When adding an entry: open the photo at full size and read it. If it contains
// any character a customer could read, it does not go in.

export type ImageCategory =
  | "fashion_apparel"
  | "beauty_skincare"
  | "food_beverage"
  | "home_lifestyle"
  | "electronics_accessories"
  | "fitness_wellness";

// Bare photo IDs (the part of an Unsplash URL after "/photo-"). Grouped so a
// generation can stay within the right category across variants (unless the
// variant's test_axis is specifically "visual", in which case switching
// category/photo is the point).
const PHOTO_IDS: Record<ImageCategory, string[]> = {
  fashion_apparel: [
    "1483985988355-763728e1935b", // model in outerwear
    "1560472354-b33ff0c44a43", // sneakers, colorful background
    "1512436991641-6745cdb1723f", // sunglasses flatlay
  ],
  beauty_skincare: [
    "1596462502278-27bf85033e5a", // skincare bottle, soft light
    "1556228720-195a672e8a03", // skincare products flatlay
  ],
  food_beverage: [
    "1441984904996-e0b6ba687e04", // coffee cup, wood table
    "1441123285228-1448e608f3d5", // food flatlay
  ],
  home_lifestyle: [
    "1441986300917-64674bd600d8", // bright home interior
  ],
  electronics_accessories: [
    "1523275335684-37898b6baf30", // watch, product-shot lighting
  ],
  fitness_wellness: [
    "1441986300917-64674bd600d8", // shared with home_lifestyle as a safe neutral shot
  ],
};

export function unsplashUrl(photoId: string, width = 1200): string {
  return `https://images.unsplash.com/photo-${photoId}?q=80&w=${width}&auto=format&fit=crop`;
}

// Last-resort fallback for an image that fails to LOAD (a dead CDN link), used
// in the templates' onerror handler only.
//
// Deliberately not used for "the spec has no image": falling back to a stock
// living room because a store had no suitable photo is how you end up with
// imagery that has nothing to do with the offer. A null image_url means the
// popup renders with no image at all.
export const DEFAULT_FALLBACK_IMAGE = unsplashUrl("1441986300917-64674bd600d8", 800);

export function imagesByCategory(width = 1200): Record<ImageCategory, string[]> {
  const out = {} as Record<ImageCategory, string[]>;
  for (const key of Object.keys(PHOTO_IDS) as ImageCategory[]) {
    out[key] = PHOTO_IDS[key].map((id) => unsplashUrl(id, width));
  }
  return out;
}

export function allImageUrls(width = 800): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const ids of Object.values(PHOTO_IDS)) {
    for (const id of ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      urls.push(unsplashUrl(id, width));
    }
  }
  return urls;
}

const KNOWN_PHOTO_IDS: ReadonlySet<string> = new Set(Object.values(PHOTO_IDS).flat());

/**
 * Whether a URL is one of ours.
 *
 * The generation schema types `image_url` as a free string, so nothing stopped
 * a model returning a hallucinated Unsplash ID (which 404s) or a URL it
 * remembered from training (which is uncurated, and may well have text baked
 * into it). Callers use this to drop anything off-list rather than shipping it.
 *
 * Matches on the photo ID rather than the full URL so a different width or
 * query string still validates.
 */
export function isLibraryImage(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  const id = url.match(/images\.unsplash\.com\/photo-([A-Za-z0-9_-]+)/)?.[1];
  return Boolean(id && KNOWN_PHOTO_IDS.has(id));
}

// Formats the library as a prompt-ready menu, grouped by category, for the
// AI popup generation system prompt (see popupGeneration.ts). Presenting an
// explicit menu — rather than "here are 3 examples, invent similar ones" —
// is deliberate: it removes the incentive/need for the model to hallucinate
// a plausible-looking but nonexistent Unsplash URL.
export function formatImageLibraryForPrompt(): string {
  const byCategory = imagesByCategory(1200);
  const labels: Record<ImageCategory, string> = {
    fashion_apparel: "Fashion / Apparel",
    beauty_skincare: "Beauty / Skincare",
    food_beverage: "Food / Beverage",
    home_lifestyle: "Home / Lifestyle",
    electronics_accessories: "Electronics / Accessories",
    fitness_wellness: "Fitness / Wellness",
  };
  return (Object.keys(byCategory) as ImageCategory[])
    .map((key) => `  - ${labels[key]}: ${byCategory[key].join(" | ")}`)
    .join("\n");
}
