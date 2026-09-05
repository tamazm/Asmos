import type { PopupDna } from "@/lib/popupDna";
import { accentReadableAsText, ensureContrast, mixHex, onColor, resolveToHex } from "@/lib/color";
import { resolveFonts, type BrandFontHints } from "./fonts";

/**
 * lib/templates/dnaCss.ts
 *
 * Turns a PopupDna into CSS custom properties + a handful of shared component
 * rules, so all three templates render the same knobs the same way instead of
 * each re-implementing (or, previously, hardcoding) them.
 *
 * Every template emits `dnaTokens(...)` followed by `sharedComponentCss()`
 * inside its own <style> block, then layers its own structural CSS on top.
 */

// ─── Scales ──────────────────────────────────────────────────────────────────

const RADIUS: Record<PopupDna["corner_radius"], string> = {
  sharp: "0px",
  soft: "8px",
  rounded: "18px",
  pill: "28px",
};

const BUTTON_RADIUS: Record<PopupDna["button_shape"], string> = {
  rect: "0px",
  rounded: "8px",
  pill: "999px",
};

const DENSITY_PAD: Record<PopupDna["density"], { y: string; x: string }> = {
  compact: { y: "26px", x: "24px" },
  regular: { y: "44px", x: "38px" },
  airy: { y: "60px", x: "52px" },
};

/**
 * Spacing as hierarchy, not as rhythm.
 *
 * Every gap used to be `--asmos-gap` or `calc(--asmos-gap * 1.6)` - a 12px and
 * a 19px, evenly distributed down the stack. Even spacing is the second-loudest
 * generated-design tell: it tells the eye that every element is equally related
 * to its neighbours, which is never true. An eyebrow belongs to the headline it
 * sits above; the form is a separate movement entirely.
 *
 * So: `tight` binds a label to the thing it labels, `text` separates lines of
 * the same thought, and `break` is a real gap - 3-5x tight - before the ask.
 * The ratio is what reads as considered, not the absolute values.
 */
const DENSITY_SPACE: Record<PopupDna["density"], { tight: string; text: string; brk: string }> = {
  compact: { tight: "6px", text: "9px", brk: "22px" },
  regular: { tight: "9px", text: "13px", brk: "32px" },
  airy: { tight: "11px", text: "17px", brk: "44px" },
};

/**
 * Type contrast.
 *
 * The old scale ran 22/30/42 headline against 13/15/17 sub - a ratio of about
 * 2.4:1 at every step. That is close enough that the two read as one texture,
 * which is why the result looked like a form with a bold label rather than
 * something with a voice. Premium layouts run 3.5-4:1 and let the supporting
 * line get genuinely small and quiet; the headline is doing the work.
 */
const TYPE_HEADLINE: Record<PopupDna["type_scale"], string> = {
  small: "26px",
  medium: "36px",
  large: "52px",
};

const TYPE_SUB: Record<PopupDna["type_scale"], string> = {
  small: "13px",
  medium: "14px",
  large: "15px",
};

/**
 * Backdrop weight.
 *
 * These were 0 / 0.28 / 0.55 / 0.8, and `overlay_weight` was drawn uniformly -
 * so one modal in four shipped with *no scrim at all*, floating over live page
 * content with nothing separating it. That reads as a rendering fault rather
 * than as a design choice: without figure/ground separation the merchant's own
 * headline competes with the popup's headline, and the card looks like it
 * failed to finish loading.
 *
 * `light` was also too light to do the job at 0.28. The floor is now the point
 * where page text behind the card stops competing for attention.
 */
const OVERLAY_RGBA: Record<PopupDna["overlay_weight"], string> = {
  none: "rgba(0,0,0,0.30)",
  light: "rgba(0,0,0,0.44)",
  medium: "rgba(0,0,0,0.62)",
  heavy: "rgba(0,0,0,0.82)",
};

/**
 * Shadow language.
 *
 * A single `box-shadow: 0 28px 60px -18px` - which is what every popup used to
 * ship with - reads as a blurred smudge under a rectangle. Real depth is
 * layered: a tight contact shadow that says the object has an edge, a mid
 * diffusion that says it's above the page, and a wide ambient that says how far
 * above. The inset hairline on the top edge is the light source; it's the
 * detail that separates "card" from "object".
 */
const ELEVATION_SHADOW: Record<PopupDna["elevation"], string> = {
  flat: "0 0 0 1px rgba(0,0,0,0.10)",
  raised: [
    "0 1px 2px rgba(16,24,40,0.08)",
    "0 10px 20px -8px rgba(16,24,40,0.16)",
    "0 28px 56px -20px rgba(16,24,40,0.34)",
  ].join(", "),
  floating: [
    "0 1px 2px rgba(16,24,40,0.08)",
    "0 14px 28px -10px rgba(16,24,40,0.20)",
    "0 46px 90px -28px rgba(16,24,40,0.48)",
  ].join(", "),
};

/** The light-source hairline. Only reads on a light surface - skip it on dark. */
function innerHighlight(dna: PopupDna): string {
  if (dna.elevation === "flat") return "";
  return dna.theme === "light" ? ", inset 0 1px 0 rgba(255,255,255,0.9)" : "";
}

// ─── Theme ───────────────────────────────────────────────────────────────────

type ThemeColors = { bg: string; fg: string; muted: string; border: string; field: string };

/**
 * How far the accent bleeds into the card surface itself.
 *
 * A card is the largest area on screen. Leaving it pure white while the brand
 * colour sits on one 48px button is why the output read as "a form" - the
 * palette was present but not perceptible. Even 5% of accent mixed into the
 * background changes the character of the whole popup, and at these levels
 * text contrast is unaffected.
 */
const SURFACE_TINT: Record<PopupDna["color_usage"], number> = {
  accent_only: 0,
  tinted_surface: 5,
  duo_accent: 7,
  saturated: 12,
};

/** The field sits *on* the tinted surface, so it needs its own separation. */
const FIELD_TINT: Record<PopupDna["color_usage"], number> = {
  accent_only: 0,
  tinted_surface: 2,
  duo_accent: 3,
  saturated: 5,
};

function themeColors(dna: PopupDna, accent: string): ThemeColors {
  // Art direction tints the theme rather than replacing it. The point is that
  // "light" stopped meaning one hex: editorial light is warm paper, glass light
  // is a cool near-white, bold light is a hard flat white. Three genuinely
  // different surfaces where there used to be `#ffffff`.
  const art = dna.art_direction;

  switch (dna.theme) {
    case "dark":
      if (art === "bold") {
        return {
          bg: "#0B0B0B",
          fg: "#ffffff",
          muted: "rgba(255,255,255,0.56)",
          border: "rgba(255,255,255,0.14)",
          field: "#161616",
        };
      }
      if (art === "editorial") {
        return {
          bg: "#1B1917",
          fg: "#F5F0E8",
          muted: "rgba(245,240,232,0.60)",
          border: "rgba(245,240,232,0.18)",
          field: "rgba(245,240,232,0.05)",
        };
      }
      if (art === "luxury") {
        // The black-box half of luxury's even light/dark split - premium
        // packaging black, not the cooler near-black the generic dark theme
        // uses below, and a warm off-white ink to match.
        return {
          bg: "#0A0A09",
          fg: "#F5F3EE",
          muted: "rgba(245,243,238,0.58)",
          border: "rgba(245,243,238,0.14)",
          field: "rgba(245,243,238,0.05)",
        };
      }
      return {
        bg: "#111114",
        fg: "#f5f5f7",
        muted: "rgba(245,245,247,0.62)",
        border: "rgba(255,255,255,0.16)",
        field: "rgba(255,255,255,0.06)",
      };
    case "brand": {
      // The accent becomes the surface, not just the button. A genuinely
      // different-looking popup from the same palette - no new colors invented.
      //
      // The ink is computed, not assumed. This theme used to hardcode white,
      // which meant a store whose brand colour is a yellow or a lime shipped a
      // popup where *nothing* on the card was readable - not the headline, not
      // the subhead, not the button label. It is the single worst contrast
      // failure the renderer could produce, because it fails the whole surface
      // at once rather than one element.
      const ink = onColor(accent, "#141417", "#ffffff");
      const light = ink === "#ffffff";
      return {
        bg: accent,
        fg: ink,
        muted: light ? "rgba(255,255,255,0.82)" : "rgba(20,20,23,0.72)",
        border: light ? "rgba(255,255,255,0.28)" : "rgba(20,20,23,0.22)",
        field: light ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.55)",
      };
    }
    default:
      if (art === "editorial") {
        // Warm paper. Pure white is a screen colour; paper is what makes a
        // serif headline read as print rather than as a web form.
        return {
          bg: "#FBF8F3",
          fg: "#22201C",
          muted: "#7C7161",
          border: "#E0D6C7",
          field: "#FBF8F3",
        };
      }
      if (art === "glass") {
        return {
          bg: "#ffffff",
          fg: "#141428",
          muted: "#6B6B85",
          border: "#E6E6F0",
          field: "#FAFAFF",
        };
      }
      if (art === "playful") {
        // Warm cream, not sterile white - cheerful without tipping into a
        // saturated background that would fight the accent block/mesh surface
        // treatment for attention.
        return {
          bg: "#FFFBF2",
          fg: "#231F16",
          muted: "#8A7F66",
          border: "#F2E9D2",
          field: "#FFFFFF",
        };
      }
      if (art === "luxury") {
        // The paper-white half of luxury's even light/dark split - cooler and
        // quieter than editorial's warm paper; restraint reads as neutral,
        // not cozy.
        return {
          bg: "#FAFAF9",
          fg: "#0F0F0E",
          muted: "#6E6B64",
          border: "#E5E3DE",
          field: "#FAFAF9",
        };
      }
      return {
        bg: "#ffffff",
        fg: "#141417",
        muted: "#6b7280",
        border: "#e2e5ea",
        field: "#ffffff",
      };
  }
}

/**
 * On a "brand" theme the surface already *is* the accent, so an accent-filled
 * button would vanish into it. Flip to a high-contrast neutral button instead.
 */
function buttonColors(
  dna: PopupDna,
  accent: string,
  surface: string,
): { bg: string; fg: string; border: string } {
  if (dna.theme === "brand") {
    // The card already *is* the accent, so the button has to separate itself
    // from it. A neutral panel in whichever direction the accent isn't.
    const cardInk = onColor(accent, "#141417", "#ffffff");
    if (dna.button_fill === "outline") {
      return {
        bg: "transparent",
        fg: cardInk,
        border: cardInk === "#ffffff" ? "rgba(255,255,255,0.75)" : "rgba(20,20,23,0.55)",
      };
    }
    const panel = cardInk === "#ffffff" ? "#ffffff" : "#141417";
    return { bg: panel, fg: onColor(panel, "#141417", "#ffffff"), border: panel };
  }

  switch (dna.button_fill) {
    case "outline": {
      // An outline button is text on the card, so it has to clear text contrast
      // against the *surface*, not against itself.
      const fg = ensureContrast(accent, surface, 4.5);
      return { bg: "transparent", fg, border: accent };
    }
    case "dark": {
      const bg = dna.theme === "dark" ? "#f5f5f7" : "#141417";
      return { bg, fg: onColor(bg, "#141417", "#ffffff"), border: "transparent" };
    }
    default: {
      // The former `fg: "#ffffff"` unconditionally. Measured across 400
      // generated popups, that put 34.5% of CTA labels below 4.5:1 - entirely
      // determined by how light the store's brand colour happens to be.
      const fg = onColor(accent, "#141417", "#ffffff");
      return { bg: accent, fg: ensureContrast(fg, accent, 4.5), border: accent };
    }
  }
}

// ─── Public helpers ──────────────────────────────────────────────────────────

/**
 * Only consumed by modal templates, which is why "none" is not honoured here:
 * a modal without a backdrop isn't a quieter modal, it's a broken one. The knob
 * still controls *how much*, just not *whether* - see OVERLAY_RGBA.
 */
export function overlayColor(dna: PopupDna): string {
  return OVERLAY_RGBA[dna.overlay_weight];
}

/**
 * The webfont `@import`, or "" when the pairing needs no network request.
 *
 * MUST be the first thing inside a template's <style> - a stylesheet silently
 * ignores an @import that follows any other rule, and the failure mode is
 * "everything renders in the fallback face and nobody can see why".
 */
export function dnaFontImport(dna: PopupDna, brand?: BrandFontHints | null): string {
  return resolveFonts(dna, brand).importCss;
}

/** Keyframe-free entrance transform pair: [from, to]. */
export function entranceTransforms(dna: PopupDna): { from: string; to: string } {
  switch (dna.entrance) {
    case "fade":
      return { from: "none", to: "none" };
    case "slide_up":
      return { from: "translateY(48px)", to: "translateY(0)" };
    case "slide_side":
      return { from: "translateX(56px)", to: "translateX(0)" };
    default:
      return { from: "translateY(16px) scale(0.96)", to: "translateY(0) scale(1)" };
  }
}

/**
 * Mixes a percentage of accent into a surface colour. Returns the base
 * untouched at 0% so `accent_only` emits no color-mix at all - one fewer thing
 * to go wrong on an old browser that doesn't support it.
 */
function tintedSurface(base: string, accent: string, percent: number): string {
  if (percent <= 0) return base;
  return `color-mix(in srgb, ${accent} ${percent}%, ${base})`;
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * Picks a usable second brand colour out of the extracted palette.
 *
 * Skips anything too close to the primary (two near-identical blues read as one
 * colour and just look like a rendering mistake) and anything that is really a
 * neutral - scrapers routinely return #fff, #000 and page-background greys
 * alongside the real brand colours, and using one of those as an "accent"
 * produces a grey badge on a white card.
 */
function pickSecondAccent(accent: string, palette?: readonly string[] | null): string {
  if (!palette?.length) return accent;

  const target = parseHex(accent);
  for (const candidate of palette) {
    if (typeof candidate !== "string" || !HEX.test(candidate.trim())) continue;
    const rgb = parseHex(candidate.trim());
    if (!rgb) continue;

    const { r, g, b } = rgb;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    // Near-greyscale, near-white or near-black: not an accent, whatever the
    // scraper thought.
    if (max - min < 28) continue;
    if (max > 244 || max < 26) continue;

    if (target) {
      const distance = Math.abs(r - target.r) + Math.abs(g - target.g) + Math.abs(b - target.b);
      if (distance < 90) continue;
    }
    return candidate.trim();
  }
  return accent;
}

function parseHex(value: string): { r: number; g: number; b: number } | null {
  if (!HEX.test(value)) return null;
  let hex = value.slice(1);
  if (hex.length === 3) hex = hex.split("").map((ch) => ch + ch).join("");
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

/**
 * The `:root`-level custom properties every template shares. Emitted scoped to
 * `#asmosPopupOverlay` rather than `:root` so a popup can never leak variables
 * into the merchant's own stylesheet.
 */
export function dnaTokens(
  dna: PopupDna,
  accentInput: string,
  brand?: BrandFontHints | null,
  palette?: readonly string[] | null,
): string {
  const accent = accentInput || "#111827";

  // The store's *second* brand colour. /api/analyze pulls 3-6 of them into
  // brandTokens.palette and every call site used palette[0] and threw the rest
  // away - so a brand with a real two-colour identity rendered as one blue
  // button. Falling back to the primary keeps single-colour brands unchanged.
  const accent2 = pickSecondAccent(accent, palette);

  const c = themeColors(dna, accent);

  // Every contrast decision below is made against the surface that actually
  // paints, tint included. Measuring against the untinted base leaves a 5-12%
  // error - small, but exactly enough to let a pair sit at 4.2:1 while the
  // maths believed it cleared 4.5:1.
  const surface = mixHex(c.bg, accent, SURFACE_TINT[dna.color_usage]);

  const btn = buttonColors(dna, accent, surface);
  const entrance = entranceTransforms(dna);
  const fonts = resolveFonts(dna, brand);

  // ── Contrast-corrected text tokens ──────────────────────────────────────
  // `muted` and the eyebrow accent were fixed values chosen for a white card.
  // On a tinted, dark or brand surface they drift below AA, which is how a
  // subhead ends up as a grey suggestion of text rather than a sentence.
  //
  // Dark themes express muted ink as `rgba(255,255,255,0.6)`, so it is
  // composited over the surface first and emitted as a solid hex: a translucent
  // token cannot be contrast-corrected without knowing what is behind it, and
  // now that it is resolved here, it is.
  const mutedResolved = resolveToHex(c.muted, surface);
  const mutedToken = mutedResolved ? ensureContrast(mutedResolved, surface, 4.5) : c.muted;

  // The eyebrow takes the second accent where there is one - but only when that
  // colour is legible as small uppercase type on this surface. A pale secondary
  // brand colour set at 11px is decoration, not a label.
  const eyebrowCandidate = dna.color_usage === "accent_only" ? accent : accent2;
  const eyebrowColor = accentReadableAsText(eyebrowCandidate, surface, 4.5)
    ? eyebrowCandidate
    : ensureContrast(eyebrowCandidate, surface, 4.5);

  // An accent headline is large text, so AA-large (3:1) is the honest bar.
  const headlineAccent = ensureContrast(accent, surface, 3);

  // Body ink too: "editorial light" is warm paper, "brand" is the accent
  // itself, and neither is guaranteed to carry the theme's chosen near-black.
  const fgResolved = resolveToHex(c.fg, surface);
  const fgToken = fgResolved ? ensureContrast(fgResolved, surface, 4.5) : c.fg;

  // Display faces differ in apparent size at the same px, so the headline scale
  // is corrected per pairing - otherwise `type_scale: large` means something
  // different depending on which font happened to be drawn.
  const headlinePx = Math.round(
    parseInt(TYPE_HEADLINE[dna.type_scale], 10) * fonts.displayScale,
  );

  return `
    #asmosPopupOverlay {
      --asmos-accent: ${accent};
      --asmos-accent-2: ${accent2};
      /* Ink that is legible ON the accent, wherever the accent becomes a fill
         (the "block" eyebrow, a top border label, any future accent panel). */
      --asmos-on-accent: ${onColor(accent, "#141417", "#ffffff")};
      --asmos-on-accent-2: ${onColor(accent2, "#141417", "#ffffff")};
      --asmos-font-display: ${fonts.displayStack};
      --asmos-font-body: ${fonts.bodyStack};
      --asmos-display-weight: ${fonts.displayWeight};
      --asmos-display-tracking: ${fonts.displayTracking};
      --asmos-shadow: ${ELEVATION_SHADOW[dna.elevation]}${innerHighlight(dna)};
      /* The surface carries brand colour now, not just the button. */
      --asmos-bg: ${tintedSurface(c.bg, accent, SURFACE_TINT[dna.color_usage])};
      --asmos-fg: ${fgToken};
      --asmos-muted: ${mutedToken};
      --asmos-eyebrow: ${eyebrowColor};
      --asmos-headline-accent: ${headlineAccent};
      --asmos-border: ${
        dna.color_usage === "accent_only"
          ? c.border
          : `color-mix(in srgb, var(--asmos-accent) 18%, ${c.border})`
      };
      --asmos-field-bg: ${tintedSurface(c.field, accent, FIELD_TINT[dna.color_usage])};
      --asmos-radius: ${RADIUS[dna.corner_radius]};
      --asmos-btn-radius: ${BUTTON_RADIUS[dna.button_shape]};
      --asmos-btn-bg: ${btn.bg};
      --asmos-btn-fg: ${btn.fg};
      --asmos-btn-border: ${btn.border};
      --asmos-pad: ${DENSITY_PAD[dna.density].y} ${DENSITY_PAD[dna.density].x};
      --asmos-pad-y: ${DENSITY_PAD[dna.density].y};
      --asmos-pad-x: ${DENSITY_PAD[dna.density].x};
      --asmos-space-tight: ${DENSITY_SPACE[dna.density].tight};
      --asmos-space-text: ${DENSITY_SPACE[dna.density].text};
      --asmos-space-break: ${DENSITY_SPACE[dna.density].brk};
      --asmos-align: ${dna.text_align};
      --asmos-align-items: ${dna.text_align === "left" ? "flex-start" : "center"};
      /* Retained so any template CSS still referencing it keeps working. */
      --asmos-gap: ${DENSITY_SPACE[dna.density].text};
      --asmos-headline-size: ${headlinePx}px;
      --asmos-sub-size: ${TYPE_SUB[dna.type_scale]};
      --asmos-overlay: ${OVERLAY_RGBA[dna.overlay_weight]};
      --asmos-enter-from: ${entrance.from};
      --asmos-enter-to: ${entrance.to};
    }`;
}

/**
 * What happens on the surface behind the copy.
 *
 * All of these are pure CSS - no images, no filters, nothing that costs a
 * request or blocks paint on a merchant's page. `mesh` and `glow` are layered
 * radial gradients; `paper` is a barely-there warm wash plus a hairline rule
 * under the eyebrow; `block` is a hard colour field. `backdrop-filter` is
 * deliberately absent: it is a real performance cost on a page we don't own.
 */
function surfaceCss(dna: PopupDna): string {
  switch (dna.surface_treatment) {
    case "glow":
      // An off-centre light source. Centred glows read as a vignette and get
      // ignored; putting it at 18% gives the card a direction and makes the
      // top-left corner the brightest point, which is where the eye starts.
      return `
    #asmosPopupOverlay .asmos-content { position: relative; }
    #asmosPopupOverlay .asmos-content::before {
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
      border-radius: inherit;
      background:
        radial-gradient(78% 58% at 18% -6%, color-mix(in srgb, var(--asmos-accent) 20%, transparent) 0%, transparent 68%),
        radial-gradient(52% 40% at 96% 104%, color-mix(in srgb, var(--asmos-accent-2) 16%, transparent) 0%, transparent 70%);
    }
    #asmosPopupOverlay .asmos-content > * { position: relative; }`;

    case "mesh":
      return `
    #asmosPopupOverlay .asmos-content { position: relative; }
    #asmosPopupOverlay .asmos-content::before {
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
      border-radius: inherit;
      opacity: 0.9;
      background:
        radial-gradient(58% 44% at 8% 4%, color-mix(in srgb, var(--asmos-accent) 22%, transparent), transparent 70%),
        radial-gradient(52% 40% at 96% 12%, color-mix(in srgb, var(--asmos-accent) 12%, transparent), transparent 68%),
        radial-gradient(70% 50% at 50% 108%, color-mix(in srgb, var(--asmos-fg) 8%, transparent), transparent 72%);
    }
    #asmosPopupOverlay .asmos-content > * { position: relative; }`;

    case "paper":
      // The rule runs the full width of the card, not the width of the text
      // column - it bleeds through the content padding to the card's own edges.
      // Elements that respect the padding box on all four sides are what makes
      // a layout read as a container with things dropped into it. One element
      // crossing that boundary is the cheapest signal that someone decided
      // where the edges were.
      return `
    #asmosPopupOverlay .asmos-eyebrow {
      padding-bottom: 14px;
      margin: 0 calc(var(--asmos-pad-x) * -1) 18px;
      padding-left: var(--asmos-pad-x);
      padding-right: var(--asmos-pad-x);
      border-bottom: 1px solid var(--asmos-border);
      width: calc(100% + var(--asmos-pad-x) * 2);
      box-sizing: border-box;
      color: color-mix(in srgb, var(--asmos-fg) 46%, transparent);
      letter-spacing: 0.24em;
    }
    #asmosPopupOverlay .asmos-email-input {
      border: 0;
      border-bottom: 1px solid var(--asmos-border);
      border-radius: 0;
      background: transparent;
      padding-left: 0;
      padding-right: 0;
    }
    #asmosPopupOverlay .asmos-email-input:focus {
      box-shadow: none;
      border-bottom-color: var(--asmos-fg);
    }`;

    case "block":
      // The colour block starts at the card's own corner rather than inside the
      // padding - it reads as a printed tab, not as a badge someone centred.
      // The headline gets negative tracking and a tighter leading than the type
      // system's default, because at poster size the default gaps between
      // letters and lines look like a bug.
      return `
    #asmosPopupOverlay .asmos-eyebrow {
      display: inline-block;
      padding: 8px 14px;
      margin: calc(var(--asmos-pad-y) * -1) 0 var(--asmos-space-text) calc(var(--asmos-pad-x) * -1);
      background: var(--asmos-accent);
      /* The eyebrow sits ON the accent here, so it needs ink chosen for the
         accent - not the surface-derived --asmos-eyebrow, and not a hardcoded
         white that vanishes on a pale brand colour. */
      color: var(--asmos-on-accent);
      letter-spacing: 0.16em;
      font-weight: 700;
    }
    #asmosPopupOverlay .asmos-headline {
      text-transform: uppercase;
      letter-spacing: -0.035em;
      line-height: 0.94;
    }
    #asmosPopupOverlay .asmos-email-input { border-width: 1.5px; }`;

    default:
      return "";
  }
}

/**
 * Keys the photograph to the brand palette.
 *
 * A full-colour stock photo dropped into a rectangle beside the copy always
 * reads as decoration - it has its own palette, its own light, and no
 * relationship to the card it's sitting in. Desaturating it and pushing the
 * brand colours back through it makes it part of the design instead of an
 * illustration next to the design, and it has the useful side effect of making
 * a merely-adequate stock photo look deliberate.
 *
 * Done with `filter` and a blended overlay rather than pre-processed assets, so
 * it costs no pipeline and works on any image_url.
 */
function imageStyleCss(dna: PopupDna): string {
  if (dna.image_style === "photo") return "";

  const overlay =
    dna.image_style === "duotone"
      ? `background: linear-gradient(160deg, var(--asmos-accent), var(--asmos-accent-2)); mix-blend-mode: color; opacity: 0.82;`
      : dna.image_style === "tinted"
      ? `background: var(--asmos-accent); mix-blend-mode: multiply; opacity: 0.34;`
      : `background: var(--asmos-fg); mix-blend-mode: color; opacity: 1;`;

  const base =
    dna.image_style === "duotone"
      ? "grayscale(1) contrast(1.16) brightness(1.02)"
      : dna.image_style === "mono"
      ? "grayscale(1) contrast(1.08)"
      : "saturate(0.8)";

  return `
    #asmosPopupOverlay .asmos-media { position: relative; isolation: isolate; }
    #asmosPopupOverlay .asmos-media img { filter: ${base}; }
    #asmosPopupOverlay .asmos-media::after {
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
      ${overlay}
    }`;
}

/**
 * The CTA is the one element where a little theatre pays for itself. A coloured
 * shadow in the button's own hue reads as the button emitting light rather than
 * casting a shadow - it is the cheapest "this was designed" signal available,
 * and it draws the eye to the only thing we want clicked.
 */
function ctaTreatmentCss(dna: PopupDna): string {
  if (dna.button_fill !== "solid") return "";
  // Editorial and bold are flat-by-intent schools; a glowing button undoes the
  // whole point of either. On a "brand" theme the button is white (see
  // buttonColors), and a white glow on a coloured surface is just a smudge.
  if (dna.art_direction === "editorial" || dna.art_direction === "bold") return "";
  if (dna.theme === "brand") return "";
  return `
    #asmosPopupOverlay .asmos-cta {
      box-shadow: 0 8px 20px -8px color-mix(in srgb, var(--asmos-btn-bg) 75%, transparent);
    }
    #asmosPopupOverlay .asmos-cta:hover {
      box-shadow: 0 12px 26px -8px color-mix(in srgb, var(--asmos-btn-bg) 85%, transparent);
    }`;
}

/**
 * Component rules driven entirely by the tokens above. Templates add structure
 * (grid, positioning, backdrop) but never re-declare these.
 */
export function sharedComponentCss(dna: PopupDna): string {
  const accentHeadline = dna.accent_placement === "headline";
  const topBorder = dna.accent_placement === "top_border";
  const bgBlock = dna.accent_placement === "background_block";

  return `
    #asmosPopupOverlay .asmos-content,
    #asmosPopupOverlay .popup-step,
    #asmosPopupOverlay .asmos-form,
    #asmosPopupOverlay .asmos-code {
      min-width: 0;
      max-width: 100%;
      box-sizing: border-box;
    }
    #asmosPopupOverlay .asmos-headline,
    #asmosPopupOverlay .asmos-sub,
    #asmosPopupOverlay .asmos-eyebrow,
    #asmosPopupOverlay .asmos-proof,
    #asmosPopupOverlay .asmos-privacy,
    #asmosPopupOverlay .asmos-cta,
    #asmosPopupOverlay .asmos-dismiss,
    #asmosPopupOverlay .asmos-field-label,
    #asmosPopupOverlay .asmos-code > span {
      /* break-word, not anywhere: anywhere offers a break opportunity between
         every pair of characters, not just at word boundaries - the headline
         and sub below also carry text-wrap: balance/pretty, and a balancer
         given a per-character break point will happily cut mid-word if that
         makes two lines look more equal in width, which is what produced
         headlines like "Example Heade" / "r" (a single orphaned trailing
         letter). break-word only allows a mid-word split as a last resort,
         when a single word is itself too wide to fit the container at all -
         still guards against a long URL or an unbroken brand name overflowing,
         without ever cutting an otherwise-fitting word for cosmetic balance. */
      overflow-wrap: break-word;
    }
    #asmosPopupOverlay .asmos-headline {
      font-family: var(--asmos-font-display);
      font-size: var(--asmos-headline-size);
      line-height: ${dna.type_pairing === "editorial" ? "1.14" : "1.06"};
      margin: 0 0 var(--asmos-space-text);
      font-weight: var(--asmos-display-weight);
      letter-spacing: var(--asmos-display-tracking);
      /* A headline set to the full width of the card is a paragraph. Capping
         the measure is what forces the 2-3 line block that reads as a title. */
      max-width: ${dna.type_scale === "large" ? "13ch" : "19ch"};
      ${dna.text_align === "center" ? "margin-left: auto; margin-right: auto;" : ""}
      text-wrap: balance;
      color: ${accentHeadline && dna.theme === "light" ? "var(--asmos-headline-accent)" : "var(--asmos-fg)"};
    }
    #asmosPopupOverlay .asmos-sub {
      font-size: var(--asmos-sub-size);
      line-height: 1.55;
      /* The break before the form, not another even gap. */
      margin: 0 0 var(--asmos-space-break);
      color: var(--asmos-muted);
      max-width: 34ch;
      ${dna.text_align === "center" ? "margin-left: auto; margin-right: auto;" : ""}
      text-wrap: pretty;
    }
    /* The eyebrow belongs to the headline - bound tight, not spaced evenly.
       It takes the *second* accent where there is one: a two-colour popup reads
       as a brand, a one-colour popup reads as a template with a colour setting. */
    #asmosPopupOverlay .asmos-eyebrow {
      font-size: 11px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      font-weight: 600;
      margin: 0 0 var(--asmos-space-tight);
      color: var(--asmos-eyebrow);
    }

    /* ── The offer as an object ────────────────────────────────────────────
       The heavy element the composition was missing. Set at display size with
       the percent sign optically reduced and raised, because a "%" at the same
       size as the numeral is what makes big type look like big text rather
       than like a designed figure. */
    #asmosPopupOverlay .asmos-offer {
      display: flex;
      align-items: flex-start;
      justify-content: ${dna.text_align === "left" ? "flex-start" : "center"};
      gap: 2px;
      margin: 0 0 var(--asmos-space-tight);
      font-family: var(--asmos-font-display);
      font-weight: ${dna.art_direction === "editorial" || dna.art_direction === "luxury" ? 500 : 800};
      line-height: 0.82;
      letter-spacing: -0.05em;
      /* luxury draws a hero offer only 5% of the time (heroOfferOdds), but
         when it does, a saturated accent-coloured numeral would fight the
         whole point of accent_only - render it in ink like bold's numeral,
         not in colour. */
      color: ${dna.art_direction === "bold" || dna.art_direction === "luxury" ? "var(--asmos-fg)" : "var(--asmos-accent)"};
      font-variant-numeric: lining-nums tabular-nums;
    }
    #asmosPopupOverlay .asmos-offer-value {
      font-size: clamp(56px, 13vw, ${dna.type_scale === "small" ? "78px" : "104px"});
    }
    #asmosPopupOverlay .asmos-offer-unit {
      font-size: clamp(24px, 5vw, 40px);
      line-height: 1;
      padding-top: 0.16em;
      letter-spacing: -0.02em;
    }
    #asmosPopupOverlay .asmos-offer-label {
      align-self: flex-end;
      margin-left: 10px;
      padding-bottom: 0.32em;
      font-family: var(--asmos-font-body);
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      line-height: 1;
      color: var(--asmos-muted);
    }
    #asmosPopupOverlay .asmos-proof {
      font-size: 12px;
      color: var(--asmos-muted);
      margin: var(--asmos-space-text) 0 0;
    }
    #asmosPopupOverlay .asmos-privacy {
      font-size: 11px;
      letter-spacing: 0.01em;
      color: var(--asmos-muted);
      margin: var(--asmos-space-tight) 0 0;
      opacity: 0.8;
    }
    #asmosPopupOverlay .asmos-cta {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 14px 24px;
      min-height: 48px;
      border-radius: var(--asmos-btn-radius);
      background: var(--asmos-btn-bg);
      color: var(--asmos-btn-fg);
      border: 1.5px solid var(--asmos-btn-border);
      font-size: 15px;
      font-weight: 650;
      cursor: pointer;
      text-decoration: none;
      transition: transform 140ms ease, opacity 140ms ease;
      font-family: inherit;
      max-width: 100%;
      white-space: normal;
    }
    #asmosPopupOverlay .asmos-cta:hover { opacity: 0.92; transform: translateY(-1px); }
    #asmosPopupOverlay .asmos-cta:active { transform: translateY(0); }
    #asmosPopupOverlay .asmos-cta[disabled] { opacity: 0.6; cursor: default; transform: none; }

    #asmosPopupOverlay .asmos-form {
      width: 100%;
      display: flex;
      ${
        dna.form_layout === "inline"
          // flex-wrap: a merchant who adds a name/phone field on top of the
          // default email input can put 3 inputs + a button in this row -
          // without wrap, that overflows the popup card on inline layouts
          // instead of dropping to a second line.
          ? "gap: 8px; align-items: stretch; flex-wrap: wrap;"
          : `flex-direction: column; align-items: ${dna.text_align === "left" ? "flex-start" : "stretch"};`
      }
    }
    /* A full-width button is a mobile convention that got applied everywhere.
       On a left-axis composition it flattens the layout back into a stack of
       equal bars - the button, the field and the headline all the same width.
       Schools built on a left axis get a button sized to its own label, which
       is what makes the composition look decided rather than filled in. */
    #asmosPopupOverlay .asmos-form .asmos-cta {
      ${
        dna.form_layout === "inline"
          ? "flex: 0 0 auto;"
          : dna.text_align === "left" &&
            (dna.art_direction === "editorial" || dna.art_direction === "bold" || dna.art_direction === "luxury")
          ? "width: auto; align-self: flex-start;"
          : "width: 100%;"
      }
    }
    #asmosPopupOverlay .asmos-field-label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      text-align: left;
      margin-bottom: 6px;
      color: var(--asmos-fg);
    }
    #asmosPopupOverlay .asmos-email-input {
      width: 100%;
      min-width: 0;
      box-sizing: border-box;
      ${dna.form_layout === "inline" ? "flex: 1 1 auto;" : "margin-bottom: 10px;"}
      padding: 13px 15px;
      min-height: 48px;
      box-sizing: border-box;
      border: 1.5px solid var(--asmos-border);
      border-radius: var(--asmos-btn-radius);
      background: var(--asmos-field-bg);
      color: var(--asmos-fg);
      font-size: 15px;
      font-family: inherit;
      outline: none;
      transition: border-color 140ms ease, box-shadow 140ms ease;
    }
    #asmosPopupOverlay .asmos-email-input::placeholder { color: var(--asmos-muted); opacity: 0.8; }
    #asmosPopupOverlay .asmos-email-input:focus {
      border-color: var(--asmos-accent);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--asmos-accent) 22%, transparent);
    }

    #asmosPopupOverlay .asmos-dismiss {
      margin-top: 14px;
      background: none;
      border: 0;
      padding: 4px;
      color: var(--asmos-muted);
      font-size: 13px;
      font-family: inherit;
      text-decoration: underline;
      cursor: pointer;
    }

    #asmosPopupOverlay .asmos-timer {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 var(--asmos-space-tight);
      font-weight: 700;
      font-size: 13px;
      font-variant-numeric: tabular-nums;
      color: var(--asmos-accent);
      ${
        dna.timer_style === "pill"
          ? `padding: 6px 14px; border-radius: 999px; background: color-mix(in srgb, var(--asmos-accent) 14%, transparent);`
          : dna.timer_style === "digits"
          ? `font-family: ui-monospace, "SF Mono", "Courier New", monospace; letter-spacing: 0.08em; font-size: 15px;`
          : `flex-direction: column; align-items: stretch; width: 100%; gap: 5px; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase;`
      }
    }
    #asmosPopupOverlay .asmos-timer-bar {
      display: ${dna.timer_style === "bar" ? "block" : "none"};
      height: 4px;
      width: 100%;
      border-radius: 999px;
      background: color-mix(in srgb, var(--asmos-accent) 20%, transparent);
      overflow: hidden;
    }
    #asmosPopupOverlay .asmos-timer-bar > i {
      display: block;
      height: 100%;
      width: 100%;
      background: var(--asmos-accent);
      transition: width 1000ms linear;
    }

    #asmosPopupOverlay .asmos-code {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      width: 100%;
      box-sizing: border-box;
      margin: 0 0 var(--asmos-space-break);
      padding: 13px 16px;
      border: 2px dashed var(--asmos-border);
      border-radius: var(--asmos-btn-radius);
      background: var(--asmos-field-bg);
      color: var(--asmos-fg);
      font-weight: 700;
      letter-spacing: 0.08em;
      flex-wrap: wrap;
    }
    #asmosPopupOverlay .asmos-code > span {
      min-width: 0;
      flex: 1 1 12ch;
    }
    #asmosPopupOverlay .asmos-code button {
      background: var(--asmos-fg);
      color: var(--asmos-bg);
      border: 0;
      padding: 7px 13px;
      border-radius: 5px;
      font-size: 12px;
      font-weight: 650;
      font-family: inherit;
      cursor: pointer;
      flex: 0 0 auto;
    }

    #asmosPopupOverlay .asmos-close {
      position: absolute;
      border: 0;
      background: transparent;
      cursor: pointer;
      font-size: 26px;
      line-height: 1;
      width: 42px;
      height: 42px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--asmos-muted);
      z-index: 12;
      font-family: inherit;
    }
    #asmosPopupOverlay .asmos-close:hover { color: var(--asmos-fg); }
    ${
      dna.close_affordance === "text_link"
        ? `#asmosPopupOverlay .asmos-close { display: none; }`
        : ""
    }

    #asmosPopupOverlay .popup-step {
      width: 100%;
      transition: opacity 220ms ease, transform 220ms ease;
    }
    #asmosPopupOverlay .popup-step.is-exiting { opacity: 0; transform: translateY(-8px); pointer-events: none; }
    #asmosPopupOverlay .popup-step.is-entering { opacity: 0; transform: translateY(8px); }
    #asmosPopupOverlay .popup-step[hidden] { display: none !important; }

    /* Staggered entrance. A popup whose parts arrive in reading order reads as
       composed; one where everything lands at once reads as a page load. The
       delays are short enough that nobody consciously notices - which is the
       point. Children of a step revealed *later* (the capture screen after a
       teaser) are already settled, since .is-open is on by then. */
    #asmosPopupOverlay .popup-step > * {
      opacity: 0;
      transform: translateY(9px);
      transition: opacity 360ms ease-out, transform 460ms cubic-bezier(0.16,1,0.3,1);
    }
    #asmosPopupOverlay.is-open .popup-step > * { opacity: 1; transform: none; }
    #asmosPopupOverlay.is-open .popup-step > *:nth-child(1) { transition-delay: 90ms; }
    #asmosPopupOverlay.is-open .popup-step > *:nth-child(2) { transition-delay: 140ms; }
    #asmosPopupOverlay.is-open .popup-step > *:nth-child(3) { transition-delay: 190ms; }
    #asmosPopupOverlay.is-open .popup-step > *:nth-child(4) { transition-delay: 240ms; }
    #asmosPopupOverlay.is-open .popup-step > *:nth-child(n+5) { transition-delay: 290ms; }

    #asmosPopupOverlay .visually-hidden {
      position: absolute; width: 1px; height: 1px;
      overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap;
    }

    ${topBorder ? `#asmosPopupOverlay .asmos-modal { border-top: 6px solid var(--asmos-accent); }` : ""}
    ${
      bgBlock
        ? `#asmosPopupOverlay .asmos-content { background:
             linear-gradient(180deg, color-mix(in srgb, var(--asmos-accent) 12%, transparent) 0%, transparent 55%); }`
        : ""
    }

    ${surfaceCss(dna)}
    ${ctaTreatmentCss(dna)}
    ${imageStyleCss(dna)}
    @media (prefers-reduced-motion: reduce) {
      #asmosPopupOverlay *, #asmosPopupOverlay *::before, #asmosPopupOverlay *::after {
        transition-duration: 0.01ms !important;
        animation-duration: 0.01ms !important;
        /* Without this the stagger delays survive and the popup appears to
           arrive in pieces for someone who asked for no motion at all. */
        transition-delay: 0ms !important;
      }
      #asmosPopupOverlay .popup-step > * { opacity: 1; transform: none; }
    }`;
}
