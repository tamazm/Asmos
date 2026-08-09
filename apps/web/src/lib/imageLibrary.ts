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
// live search API — same mechanism the app already used, just a bigger,
// organized set. Unsplash photo pages are effectively permanent once
// published, but if any one of these ever does go stale, both
// splitScreen.ts and fullscreenTakeover.ts fall back to a known-good
// default image rather than showing a broken image — see their
// onerror/preload handling.

export type ImageCategory =
  | "fashion_apparel"
  | "beauty_skincare"
  | "food_beverage"
  | "home_lifestyle"
  | "electronics_accessories"
  | "fitness_wellness"
  | "general_abstract";

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
  general_abstract: [
    "1607083206869-4c7672e72a8a", // abstract gradient / discount-friendly
  ],
};

export function unsplashUrl(photoId: string, width = 1200): string {
  return `https://images.unsplash.com/photo-${photoId}?q=80&w=${width}&auto=format&fit=crop`;
}

// Known-good default — used as the last-resort fallback by the popup
// templates if an AI-selected or manually-entered image URL fails to load.
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
    general_abstract: "General / Abstract / Discount",
  };
  return (Object.keys(byCategory) as ImageCategory[])
    .map((key) => `  - ${labels[key]}: ${byCategory[key].join(" | ")}`)
    .join("\n");
}
