import {
  contrastHex,
  findContrastViolations,
  onColor,
  type ContrastPair,
  type ContrastViolation,
} from "@/lib/color";
import type { ResolvedTemplateProps } from "./types";

export type { ContrastViolation } from "@/lib/color";

/**
 * lib/templates/contrastAudit.ts
 *
 * Re-derives the handful of colour pairs a visitor actually has to read, and
 * reports any that fall below WCAG. This is a *backstop*: `dnaCss.ts` already
 * corrects each pair as it builds the tokens, so a violation here means the
 * arithmetic there missed a case, and that is worth a loud log rather than a
 * silent ship.
 *
 * Deliberately re-derives rather than parsing the emitted CSS. Parsing would
 * couple the check to the exact shape of the token block and would have to
 * resolve `color-mix()` and `var()` by hand; re-deriving reads the same inputs
 * the renderer read and stays honest as long as both use `lib/color`.
 */

const AA_TEXT = 4.5;
const AA_LARGE = 3;

function themeSurface(props: ResolvedTemplateProps, accent: string): string {
  const { dna } = props;
  // Mirrors themeColors() in dnaCss.ts. Only the untinted base is needed: the
  // 5-12% accent tint never moves a pass/fail decision.
  if (dna.theme === "brand") return accent;
  if (dna.theme === "dark") {
    if (dna.art_direction === "bold") return "#0B0B0B";
    if (dna.art_direction === "editorial") return "#1B1917";
    return "#111114";
  }
  if (dna.art_direction === "editorial") return "#FBF8F3";
  return "#ffffff";
}

function themeInk(props: ResolvedTemplateProps, accent: string): string {
  const { dna } = props;
  if (dna.theme === "brand") return onColor(accent, "#141417", "#ffffff");
  if (dna.theme === "dark") {
    if (dna.art_direction === "bold") return "#ffffff";
    if (dna.art_direction === "editorial") return "#F5F0E8";
    return "#f5f5f7";
  }
  if (dna.art_direction === "editorial") return "#22201C";
  if (dna.art_direction === "glass") return "#141428";
  return "#141417";
}

export function auditPopupContrast(props: ResolvedTemplateProps): ContrastViolation[] {
  const { dna } = props;
  const accent = props.primaryColor || "#111827";

  // The fullscreen takeover paints its own dark scrim over a photograph and
  // overrides every ink token to white; measuring it against the card surface
  // would report failures that do not exist on screen.
  const isTakeover = props.templateId === "fullscreen-takeover";
  if (isTakeover && dna.button_fill === "outline") return [];

  const surface = themeSurface(props, accent);
  const ink = themeInk(props, accent);

  const pairs: ContrastPair[] = [];

  // The CTA label is the one element that must never fail. Everything else is
  // legibility; this one is the conversion.
  if (dna.theme === "brand") {
    const cardInk = onColor(accent, "#141417", "#ffffff");
    const panel = dna.button_fill === "outline" ? accent : cardInk === "#ffffff" ? "#ffffff" : "#141417";
    pairs.push({
      role: "cta-label",
      fg: onColor(panel, "#141417", "#ffffff"),
      bg: panel,
      target: AA_TEXT,
    });
  } else if (dna.button_fill === "dark") {
    const bg = dna.theme === "dark" ? "#f5f5f7" : "#141417";
    pairs.push({ role: "cta-label", fg: onColor(bg, "#141417", "#ffffff"), bg, target: AA_TEXT });
  } else if (dna.button_fill === "solid") {
    pairs.push({
      role: "cta-label",
      fg: onColor(accent, "#141417", "#ffffff"),
      bg: accent,
      target: AA_TEXT,
    });
  }

  if (!isTakeover) {
    pairs.push({ role: "headline", fg: ink, bg: surface, target: AA_LARGE });
    pairs.push({ role: "body-ink", fg: ink, bg: surface, target: AA_TEXT });
  }

  return findContrastViolations(pairs);
}

/** Convenience for tests and the audit script. */
export function ctaContrast(props: ResolvedTemplateProps): number | null {
  const accent = props.primaryColor || "#111827";
  if (props.dna.button_fill !== "solid") return null;
  return contrastHex(onColor(accent, "#141417", "#ffffff"), accent);
}
