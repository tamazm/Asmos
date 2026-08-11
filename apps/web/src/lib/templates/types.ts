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
}

/** Props after normalization — what each template actually receives. */
export interface ResolvedTemplateProps extends Omit<PopupTemplateProps, "dna"> {
  dna: PopupDna;
}
