import type { PopupDna } from "@/lib/popupDna";

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

const DENSITY_PAD: Record<PopupDna["density"], string> = {
  compact: "24px 24px",
  regular: "40px 36px",
  airy: "56px 48px",
};

const DENSITY_GAP: Record<PopupDna["density"], string> = {
  compact: "8px",
  regular: "12px",
  airy: "18px",
};

const TYPE_HEADLINE: Record<PopupDna["type_scale"], string> = {
  small: "22px",
  medium: "30px",
  large: "42px",
};

const TYPE_SUB: Record<PopupDna["type_scale"], string> = {
  small: "13px",
  medium: "15px",
  large: "17px",
};

const OVERLAY_RGBA: Record<PopupDna["overlay_weight"], string> = {
  none: "rgba(0,0,0,0)",
  light: "rgba(0,0,0,0.28)",
  medium: "rgba(0,0,0,0.55)",
  heavy: "rgba(0,0,0,0.8)",
};

// ─── Theme ───────────────────────────────────────────────────────────────────

type ThemeColors = { bg: string; fg: string; muted: string; border: string; field: string };

function themeColors(dna: PopupDna, accent: string): ThemeColors {
  switch (dna.theme) {
    case "dark":
      return {
        bg: "#111114",
        fg: "#f5f5f7",
        muted: "rgba(245,245,247,0.62)",
        border: "rgba(255,255,255,0.16)",
        field: "rgba(255,255,255,0.06)",
      };
    case "brand":
      // The accent becomes the surface, not just the button. A genuinely
      // different-looking popup from the same palette — no new colors invented.
      return {
        bg: accent,
        fg: "#ffffff",
        muted: "rgba(255,255,255,0.78)",
        border: "rgba(255,255,255,0.28)",
        field: "rgba(255,255,255,0.14)",
      };
    default:
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
function buttonColors(dna: PopupDna, accent: string): { bg: string; fg: string; border: string } {
  if (dna.theme === "brand") {
    return dna.button_fill === "outline"
      ? { bg: "transparent", fg: "#ffffff", border: "rgba(255,255,255,0.75)" }
      : { bg: "#ffffff", fg: accent, border: "#ffffff" };
  }
  switch (dna.button_fill) {
    case "outline":
      return { bg: "transparent", fg: accent, border: accent };
    case "dark":
      return { bg: dna.theme === "dark" ? "#f5f5f7" : "#141417", fg: dna.theme === "dark" ? "#141417" : "#ffffff", border: "transparent" };
    default:
      return { bg: accent, fg: "#ffffff", border: accent };
  }
}

// ─── Public helpers ──────────────────────────────────────────────────────────

export function overlayColor(dna: PopupDna): string {
  return OVERLAY_RGBA[dna.overlay_weight];
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
 * The `:root`-level custom properties every template shares. Emitted scoped to
 * `#asmosPopupOverlay` rather than `:root` so a popup can never leak variables
 * into the merchant's own stylesheet.
 */
export function dnaTokens(dna: PopupDna, accentInput: string): string {
  const accent = accentInput || "#165DFF";
  const c = themeColors(dna, accent);
  const btn = buttonColors(dna, accent);
  const entrance = entranceTransforms(dna);

  return `
    #asmosPopupOverlay {
      --asmos-accent: ${accent};
      --asmos-bg: ${c.bg};
      --asmos-fg: ${c.fg};
      --asmos-muted: ${c.muted};
      --asmos-border: ${c.border};
      --asmos-field-bg: ${c.field};
      --asmos-radius: ${RADIUS[dna.corner_radius]};
      --asmos-btn-radius: ${BUTTON_RADIUS[dna.button_shape]};
      --asmos-btn-bg: ${btn.bg};
      --asmos-btn-fg: ${btn.fg};
      --asmos-btn-border: ${btn.border};
      --asmos-pad: ${DENSITY_PAD[dna.density]};
      --asmos-gap: ${DENSITY_GAP[dna.density]};
      --asmos-headline-size: ${TYPE_HEADLINE[dna.type_scale]};
      --asmos-sub-size: ${TYPE_SUB[dna.type_scale]};
      --asmos-overlay: ${OVERLAY_RGBA[dna.overlay_weight]};
      --asmos-enter-from: ${entrance.from};
      --asmos-enter-to: ${entrance.to};
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
    #asmosPopupOverlay .asmos-headline {
      font-size: var(--asmos-headline-size);
      line-height: 1.12;
      margin: 0 0 var(--asmos-gap);
      font-weight: 800;
      letter-spacing: -0.015em;
      text-wrap: balance;
      color: ${accentHeadline && dna.theme === "light" ? "var(--asmos-accent)" : "var(--asmos-fg)"};
    }
    #asmosPopupOverlay .asmos-sub {
      font-size: var(--asmos-sub-size);
      line-height: 1.5;
      margin: 0 0 calc(var(--asmos-gap) * 1.6);
      color: var(--asmos-muted);
      max-width: 36ch;
    }
    #asmosPopupOverlay .asmos-eyebrow {
      font-size: 11px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      font-weight: 700;
      margin: 0 0 var(--asmos-gap);
      color: var(--asmos-accent);
    }
    #asmosPopupOverlay .asmos-proof {
      font-size: 12px;
      color: var(--asmos-muted);
      margin: var(--asmos-gap) 0 0;
    }
    #asmosPopupOverlay .asmos-privacy {
      font-size: 11px;
      color: var(--asmos-muted);
      margin: 10px 0 0;
      opacity: 0.85;
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
    }
    #asmosPopupOverlay .asmos-cta:hover { opacity: 0.92; transform: translateY(-1px); }
    #asmosPopupOverlay .asmos-cta:active { transform: translateY(0); }
    #asmosPopupOverlay .asmos-cta[disabled] { opacity: 0.6; cursor: default; transform: none; }

    #asmosPopupOverlay .asmos-form {
      width: 100%;
      display: ${dna.form_layout === "inline" ? "flex" : "block"};
      ${dna.form_layout === "inline" ? "gap: 8px; align-items: stretch;" : ""}
    }
    #asmosPopupOverlay .asmos-form .asmos-cta { ${dna.form_layout === "inline" ? "flex: 0 0 auto;" : "width: 100%;"} }
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
      margin: 0 0 var(--asmos-gap);
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
      margin: 0 0 calc(var(--asmos-gap) * 1.4);
      padding: 13px 16px;
      border: 2px dashed var(--asmos-border);
      border-radius: var(--asmos-btn-radius);
      background: var(--asmos-field-bg);
      color: var(--asmos-fg);
      font-weight: 700;
      letter-spacing: 0.08em;
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
    @media (prefers-reduced-motion: reduce) {
      #asmosPopupOverlay *, #asmosPopupOverlay *::before, #asmosPopupOverlay *::after {
        transition-duration: 0.01ms !important;
        animation-duration: 0.01ms !important;
      }
    }`;
}
