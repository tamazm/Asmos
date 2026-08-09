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
}

/** Props after normalization — what each template actually receives. */
export interface ResolvedTemplateProps extends Omit<PopupTemplateProps, "dna"> {
  dna: PopupDna;
}
