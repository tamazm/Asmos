import { prisma } from "@/lib/prisma";
import type { BrandTokens, ComputedStyles } from "@/lib/popupGeneration";
import type { DomExtraction, PaletteEntry, Provenance } from "@/lib/storeExtraction";

/**
 * lib/storeProfile.ts
 *
 * Persisting what we learned about a store, and handing it back to generation.
 *
 * The problem this solves: `Account` had exactly two brand columns, `industry`
 * and `brandColor`. Everything else /api/analyze produced — palette, typefaces,
 * imagery style, signature element, detected popup — lived in sessionStorage
 * through onboarding and was dropped at signup, survived into a campaign only
 * because NewCampaignForm spread the raw blob into generationContext, and was
 * explicitly discarded by evaluateKnockout from round two onward.
 *
 * So the brand was at its strongest in round one and gone by round two, which
 * is exactly the window in which the bandit decides what works for this store.
 */

export type StoreProfileInput = {
  websiteId: string;
  category?: string | null;
  subcategories?: string[];
  audience?: string | null;
  priceBandMin?: number | null;
  priceBandMax?: number | null;
  priceBandMedian?: number | null;
  currency?: string | null;
  productCount?: number | null;
  palette?: PaletteEntry[] | null;
  typeDisplay?: string | null;
  typeBody?: string | null;
  buttonStyle?: DomExtraction["buttonStyle"];
  borderRadius?: string | null;
  logoUrl?: string | null;
  productImages?: string[];
  brandVoice?: string | null;
  valueProps?: string[];
  signatureDetail?: string | null;
  platform?: string | null;
  detectedPopup?: unknown;
  sources?: Provenance;
};

export type StoreProfileRecord = StoreProfileInput & {
  id: string;
  confirmedByUser: boolean;
  analyzedAt: Date;
};

/**
 * Writes the profile, preserving anything the merchant has confirmed by hand.
 *
 * A re-analysis must never silently overwrite a correction: the whole value of
 * the confirmation screen is that a merchant who fixes "Ecommerce / Retail" to
 * "children's sleepwear" sees that stick.
 */
export async function upsertStoreProfile(input: StoreProfileInput) {
  const existing = await prisma.storeProfile.findUnique({
    where: { websiteId: input.websiteId },
    select: { confirmedByUser: true },
  });

  const data = {
    category: input.category ?? null,
    subcategories: input.subcategories ?? [],
    audience: input.audience ?? null,
    priceBandMin: input.priceBandMin ?? null,
    priceBandMax: input.priceBandMax ?? null,
    priceBandMedian: input.priceBandMedian ?? null,
    currency: input.currency ?? null,
    productCount: input.productCount ?? null,
    palette: (input.palette ?? null) as never,
    typeDisplay: input.typeDisplay ?? null,
    typeBody: input.typeBody ?? null,
    buttonStyle: (input.buttonStyle ?? null) as never,
    borderRadius: input.borderRadius ?? null,
    logoUrl: input.logoUrl ?? null,
    productImages: input.productImages ?? [],
    brandVoice: input.brandVoice ?? null,
    valueProps: input.valueProps ?? [],
    signatureDetail: input.signatureDetail ?? null,
    platform: input.platform ?? null,
    detectedPopup: (input.detectedPopup ?? null) as never,
    sources: (input.sources ?? null) as never,
    analyzedAt: new Date(),
  };

  if (existing?.confirmedByUser) {
    // Refresh only the measured half. Category, audience and voice are the
    // fields a merchant is most likely to have corrected, and re-deriving them
    // from a fresh screenshot is exactly how a correction gets lost.
    return prisma.storeProfile.update({
      where: { websiteId: input.websiteId },
      data: {
        palette: data.palette,
        typeDisplay: data.typeDisplay,
        typeBody: data.typeBody,
        buttonStyle: data.buttonStyle,
        borderRadius: data.borderRadius,
        logoUrl: data.logoUrl,
        productImages: data.productImages,
        platform: data.platform,
        detectedPopup: data.detectedPopup,
        sources: data.sources,
        analyzedAt: data.analyzedAt,
      },
    });
  }

  return prisma.storeProfile.upsert({
    where: { websiteId: input.websiteId },
    create: { websiteId: input.websiteId, ...data },
    update: data,
  });
}

export async function getStoreProfile(websiteId: string) {
  return prisma.storeProfile.findUnique({ where: { websiteId } });
}

// ─── Mapping into generation ─────────────────────────────────────────────────

type ProfileLike = {
  palette?: unknown;
  typeDisplay?: string | null;
  typeBody?: string | null;
  borderRadius?: string | null;
  category?: string | null;
  audience?: string | null;
  signatureDetail?: string | null;
  productImages?: string[];
} | null | undefined;

function paletteHexes(palette: unknown): string[] {
  if (!Array.isArray(palette)) return [];
  return palette
    .map((p) => (p && typeof p === "object" ? (p as { hex?: unknown }).hex : null))
    .filter((h): h is string => typeof h === "string" && /^#[0-9a-f]{6}$/i.test(h));
}

/**
 * The profile as BrandTokens, or null when there is nothing measured to offer —
 * so callers fall through to their existing source rather than to a palette of
 * one synthetic colour.
 */
export function brandTokensFromStoreProfile(profile: ProfileLike): BrandTokens | null {
  if (!profile) return null;
  const palette = paletteHexes(profile.palette);
  if (palette.length === 0 && !profile.typeDisplay) return null;

  return {
    palette,
    type_display: profile.typeDisplay ?? "system-ui",
    type_body: profile.typeBody ?? profile.typeDisplay ?? "system-ui",
    imagery_style: (profile.productImages?.length ?? 0) > 0 ? "product-forward" : "minimal",
    signature_element_suggestion:
      profile.signatureDetail ??
      "the store's own product photography, keyed to the brand palette",
  } as BrandTokens;
}

export function computedStylesFromStoreProfile(profile: ProfileLike): ComputedStyles | null {
  if (!profile) return null;
  const palette = paletteHexes(profile.palette);
  if (palette.length === 0) return null;
  return {
    colors_in_use: palette,
    font_stack: [profile.typeDisplay, profile.typeBody].filter((f): f is string => !!f),
    common_border_radius: profile.borderRadius ?? "8px",
  } as ComputedStyles;
}

/**
 * The store, in the words the copywriter needs.
 *
 * This is the block that answers what the prompt could never previously ask:
 * what is sold here, to whom, at what price. Returns null when the profile has
 * nothing real, so the prompt says "unknown" rather than "Ecommerce / Retail".
 */
export function storeProfileForPrompt(profile: ProfileLike & { priceBandMedian?: number | null; currency?: string | null; audience?: string | null; brandVoice?: string | null; valueProps?: string[] } | null | undefined): string | null {
  if (!profile) return null;
  const lines: string[] = [];
  if (profile.category) lines.push(`sells: ${profile.category}`);
  if (profile.audience) lines.push(`audience: ${profile.audience}`);
  if (typeof profile.priceBandMedian === "number") {
    const cur = profile.currency ?? "";
    lines.push(`typical item price: ${cur}${(profile.priceBandMedian / 100).toFixed(2)}`);
  }
  if (profile.brandVoice) lines.push(`brand voice: ${profile.brandVoice}`);
  if (profile.valueProps?.length) lines.push(`their own value propositions: ${profile.valueProps.join("; ")}`);
  if (profile.signatureDetail) lines.push(`distinctive: ${profile.signatureDetail}`);
  return lines.length > 0 ? lines.join("\n") : null;
}
