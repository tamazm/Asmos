// Curated Unsplash placeholder image library for AI popup generation.
//
// Single source of truth for every Unsplash hotlink used across the app -
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
// signs, price tags, and signage. This is not a style preference - it is a
// correctness requirement, because the popup's copy is generated independently
// of the image and the two will contradict each other.
//
// This rule exists because it was already violated. The library used to carry a
// "General / Abstract / Discount" category whose only entry was a photograph of
// gift boxes with "SALE" and a large "50%" printed across it. The generator was
// explicitly told to reach for that category when no other one fit - so a store
// running a 10% offer shipped a popup reading "A 10% welcome credit" directly
// underneath a photo of the number 50%. There is no prompt wording that fixes
// that; the only fix is not to have such an image in the pool.
//
// The whole discount/abstract category is gone with it. A popup with nothing
// relevant to show should show nothing - see `image_treatment: "none"` and the
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
/**
 * Each photo carries a description, and the description is sent to the model.
 *
 * This is the fix for a specific and embarrassing failure: a children's
 * clothing store got a popup backed by a photograph of a dark adult menswear
 * shop. The model had not chosen badly - it had chosen *blind*. The prompt menu
 * emitted bare URLs grouped under a category name, so "Fashion / Apparel" was
 * the only information available, and these descriptions existed solely as
 * comments in this file that nothing ever read.
 *
 * A model that can see "male model in dark outerwear, moody studio light" will
 * not pick it for a kids' store. One that sees only a URL under the heading
 * "Fashion / Apparel" has no way not to.
 */
type LibraryPhoto = { id: string; description: string };

const PHOTO_IDS: Record<ImageCategory, LibraryPhoto[]> = {
  fashion_apparel: [
    {
      id: "1483985988355-763728e1935b",
      description: "adult womenswear rail in a dim boutique, moody and monochrome - adult fashion only",
    },
    {
      id: "1560472354-b33ff0c44a43",
      description: "pair of sneakers on a bright block-colour background, playful and youthful",
    },
    {
      id: "1512436991641-6745cdb1723f",
      description: "sunglasses on a flat pastel surface, minimal accessory flatlay",
    },
  ],
  beauty_skincare: [
    {
      id: "1596462502278-27bf85033e5a",
      description: "single unbranded skincare bottle in soft daylight, calm and neutral",
    },
    {
      id: "1556228720-195a672e8a03",
      description: "several skincare jars arranged flat on a pale surface",
    },
  ],
  food_beverage: [
    {
      id: "1441984904996-e0b6ba687e04",
      description: "cup of coffee on a dark wooden table, warm and homely",
    },
    {
      id: "1441123285228-1448e608f3d5",
      description: "overhead spread of prepared food on a table",
    },
  ],
  home_lifestyle: [
    {
      id: "1441986300917-64674bd600d8",
      description: "bright airy interior with plants and pale furniture, no people",
    },
  ],
  electronics_accessories: [
    {
      id: "1523275335684-37898b6baf30",
      description: "wristwatch shot on a plain background under product lighting",
    },
  ],
  fitness_wellness: [
    {
      id: "1441986300917-64674bd600d8",
      description: "bright airy interior with plants, used here as a calm neutral backdrop",
    },
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
    out[key] = PHOTO_IDS[key].map((p) => unsplashUrl(p.id, width));
  }
  return out;
}

export function allImageUrls(width = 800): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const photos of Object.values(PHOTO_IDS)) {
    for (const photo of photos) {
      if (seen.has(photo.id)) continue;
      seen.add(photo.id);
      urls.push(unsplashUrl(photo.id, width));
    }
  }
  return urls;
}

const KNOWN_PHOTO_IDS: ReadonlySet<string> = new Set(
  Object.values(PHOTO_IDS).flat().map((p) => p.id),
);

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
// explicit menu - rather than "here are 3 examples, invent similar ones" -
// is deliberate: it removes the incentive/need for the model to hallucinate
// a plausible-looking but nonexistent Unsplash URL.
export function formatImageLibraryForPrompt(): string {
  const labels: Record<ImageCategory, string> = {
    fashion_apparel: "Fashion / Apparel (ADULT clothing only)",
    beauty_skincare: "Beauty / Skincare",
    food_beverage: "Food / Beverage",
    home_lifestyle: "Home / Lifestyle",
    electronics_accessories: "Electronics / Accessories",
    fitness_wellness: "Fitness / Wellness",
  };

  return (Object.keys(PHOTO_IDS) as ImageCategory[])
    .map((key) => {
      const rows = PHOTO_IDS[key]
        .map((p) => `      • ${p.description}\n        ${unsplashUrl(p.id, 1200)}`)
        .join("\n");
      return `  ${labels[key]}:\n${rows}`;
    })
    .join("\n");
}

/**
 * Store types this library genuinely cannot serve.
 *
 * Named explicitly because "pick the closest category" is the instruction that
 * put an adult menswear boutique behind a children's store's popup. There is no
 * closest category for a toy shop - there is only a wrong one.
 */
export const UNSERVED_STORE_TYPES = [
  "children's / baby / kids' clothing, toys or nursery",
  "pets and pet supplies",
  "jewellery and watches (beyond the single watch shot)",
  "books, stationery and print",
  "automotive and tools",
  "garden and outdoor",
  "art, craft and hobby supplies",
  "digital products, services and software",
] as const;
