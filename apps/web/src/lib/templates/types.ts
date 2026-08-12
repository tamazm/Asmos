import type { PopupDna } from "@/lib/popupDna";

// Shared prop shape for every popup template. Each template in this directory
// implements a `render*Template` function with this signature — see
// lib/templates/index.ts for the template_id -> render function dispatch.
export interface PopupTemplateProps {
  headline: string;
  subhead: string;
  cta: string;
  primaryColor: string;
  couponCode?: string | null;
  imageUrl?: string | null;
  goal?: "EMAIL" | "DISCOUNT" | "BOTH";
  layoutStyle?: "split-left" | "split-right" | "centered" | "minimal";
  /**
   * The design DNA (see lib/popupDna.ts) — the ~30 composable knobs that make
   * two popups genuinely different rather than the same skeleton with
   * different words. Optional at the call site: `renderPopupTemplate` runs
   * `normalizeDna`, so a Variant row written before the DNA existed still
   * renders with quiet, safe defaults instead of crashing.
   */
  dna?: Partial<PopupDna> | null;
  /**
   * The store's own typefaces, as identified by /api/analyze and carried
   * through popupGeneration as `design_tokens.type_display` / `type_body`.
   *
   * Only consulted when `dna.type_pairing` is "brand" — and only honoured when
   * the name matches a family Google actually serves (see fonts.ts). This is
   * the first time that extraction has been used for anything; before it, every
   * template hardcoded system-ui and the scraped fonts were dead data.
   */
  brandFonts?: { type_display?: string | null; type_body?: string | null } | null;
  /**
   * The store's full extracted brand palette, not just the primary.
   *
   * `/api/analyze` pulls 3-6 colours per store and every call site read
   * `palette[0]` and dropped the rest — so a brand with a genuine two-colour
   * identity rendered as a white card with one coloured button. See
   * `pickSecondAccent` in dnaCss.ts for how a usable second colour is chosen.
   */
  palette?: readonly string[] | null;
  /**
   * The offer, for `offer_display: "hero"`. Already present on every generated
   * spec as `discount_percent` and never rendered until now.
   */
  discountPercent?: number | null;
}

/** Props after normalization — what each template actually receives. */
export interface ResolvedTemplateProps extends Omit<PopupTemplateProps, "dna"> {
  dna: PopupDna;
}
