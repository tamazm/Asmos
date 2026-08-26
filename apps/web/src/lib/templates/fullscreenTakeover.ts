import type { ResolvedTemplateProps } from "./types";
import { DEFAULT_FALLBACK_IMAGE } from "@/lib/imageLibrary";
import { dnaTokens, sharedComponentCss, dnaFontImport } from "./dnaCss";
import { closeMarkup, resolveFlow, runtimeScript, stepsMarkup } from "./runtime";

/**
 * FULLSCREEN TAKEOVER — edge-to-edge, maximum prominence.
 *
 * The DNA's `theme` doesn't apply the way it does on a card: content sits on a
 * photographic background, so text is always light-on-scrim regardless. What
 * the DNA still drives here is the scrim weight, type scale, density, button
 * treatment, timer, eyebrow, flow, and every word of copy.
 */
export function renderFullscreenTakeoverTemplate(props: ResolvedTemplateProps): string {
  const { primaryColor, imageUrl, dna, layoutStyle = "centered" } = props;
  const goal = props.goal ?? "BOTH";
  const flow = resolveFlow(goal, dna);

  const accent = primaryColor || "#165DFF";
  const bgImg = imageUrl || DEFAULT_FALLBACK_IMAGE;
  // No image_url means the accent gradient below, not a stock photo standing in
  // for one — see splitScreen.ts for the reasoning.
  const useImage = dna.image_treatment !== "none" && Boolean(imageUrl);

  // Scrim strength tracks overlay_weight, but never drops below the level that
  // keeps white text legible over an arbitrary photo.
  const scrim: Record<typeof dna.overlay_weight, string> = {
    none: "rgba(0,0,0,0.34), rgba(0,0,0,0.44)",
    light: "rgba(0,0,0,0.34), rgba(0,0,0,0.5)",
    medium: "rgba(0,0,0,0.42), rgba(0,0,0,0.68)",
    heavy: "rgba(0,0,0,0.58), rgba(0,0,0,0.84)",
  };

  const align =
    layoutStyle === "split-left"
      ? "align-items: flex-start; text-align: left; padding-left: clamp(28px, 9vw, 140px);"
      : layoutStyle === "split-right"
      ? "align-items: flex-end; text-align: right; padding-right: clamp(28px, 9vw, 140px);"
      : "align-items: center; text-align: center;";

  const headlineSize =
    dna.type_scale === "small"
      ? "clamp(24px, 4vw, 38px)"
      : dna.type_scale === "large"
      ? "clamp(36px, 7vw, 76px)"
      : "clamp(30px, 5.5vw, 56px)";

  return `
<!-- ASMOS TEMPLATE: FULLSCREEN-TAKEOVER -->
<div class="asmos-overlay" id="asmosPopupOverlay" hidden>
  <style>
    ${dnaFontImport(dna, props.brandFonts)}
    ${dnaTokens(dna, accent, props.brandFonts, props.palette)}

    #asmosPopupOverlay.asmos-overlay {
      position: fixed;
      inset: 0;
      z-index: 2147483000;
      opacity: 0;
      visibility: hidden;
      transition: opacity 280ms ease-out, visibility 280ms ease-out;
      font-family: var(--asmos-font-body);
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
      background-color: #101013;
      ${
        useImage
          ? `background-image: linear-gradient(180deg, ${scrim[dna.overlay_weight]}), var(--asmos-bg-image);
             background-size: cover;
             background-position: center;`
          : `background-image: linear-gradient(160deg,
               color-mix(in srgb, var(--asmos-accent) 78%, #000) 0%,
               color-mix(in srgb, var(--asmos-accent) 26%, #000) 100%);`
      }
    }
    #asmosPopupOverlay.asmos-overlay { --asmos-bg-image: url('${bgImg}'); }
    #asmosPopupOverlay.is-open { opacity: 1; visibility: visible; }

    /* Content sits on a photo, so the card-level theme colors don't apply. */
    #asmosPopupOverlay {
      --asmos-fg: #ffffff;
      --asmos-muted: rgba(255,255,255,0.76);
      --asmos-border: rgba(255,255,255,0.34);
      --asmos-field-bg: rgba(255,255,255,0.1);
      --asmos-bg: transparent;
    }

    #asmosPopupOverlay .asmos-content {
      position: relative;
      height: 100%;
      display: flex;
      flex-direction: column;
      /* justify-content: center on a fixed-height flex column silently clips
         overflow at BOTH ends, and unlike scroll-overflow there is no scrollbar
         to hint that anything is missing. With a display-size offer figure
         stacked above a 76px headline the content routinely exceeds a laptop
         viewport, and the number was being sliced off the top of the screen.
         Centre only while it fits; above that, top-align and let it scroll. */
      justify-content: center;
      justify-content: safe center;
      overflow-y: auto;
      overscroll-behavior: contain;
      ${align}
      /* Keep the padding tokens honest for any bleed-to-edge surface
         treatment — this template's padding is its own, not the density scale's. */
      --asmos-pad-y: 32px;
      --asmos-pad-x: 32px;
      padding: 32px;
      box-sizing: border-box;
      transform: var(--asmos-enter-from);
      opacity: 0;
      transition: transform 460ms cubic-bezier(0.16,1,0.3,1), opacity 360ms ease-out;
    }
    #asmosPopupOverlay.is-open .asmos-content { transform: var(--asmos-enter-to); opacity: 1; }

    #asmosPopupOverlay .popup-step {
      display: flex;
      flex-direction: column;
      align-items: inherit;
      max-width: 560px;
    }

    #asmosPopupOverlay .asmos-close {
      top: 22px;
      right: 22px;
      width: 46px;
      height: 46px;
      border: 1px solid rgba(255,255,255,0.4);
      border-radius: 999px;
      background: rgba(0,0,0,0.24);
      color: #fff;
    }
    #asmosPopupOverlay .asmos-close:hover { background: rgba(0,0,0,0.44); color: #fff; }

    ${sharedComponentCss(dna)}

    #asmosPopupOverlay .asmos-headline { font-size: ${headlineSize}; color: #fff; max-width: 18ch; }
    /* Content sits on a scrimmed photograph, so the accent-coloured offer
       figure would fight the background rather than read against it. */
    #asmosPopupOverlay .asmos-offer { color: #fff; }
    #asmosPopupOverlay .asmos-offer-label { color: rgba(255,255,255,0.72); }
    /* Both the figure and the headline are display-size here, so they have to
       share a viewport rather than each claiming one. Sized in vh, not vw —
       the constraint that was being exceeded is vertical. */
    #asmosPopupOverlay .asmos-offer-value { font-size: clamp(44px, 11vh, 92px); }
    #asmosPopupOverlay .asmos-offer-unit { font-size: clamp(20px, 4.4vh, 36px); }
    /* The offer box shrinks to its own content under .popup-step's inherited
       align-items, so this template's axis (from layout_style) already places
       it. Clear the shared rule's internal justification so it can't fight. */
    #asmosPopupOverlay .asmos-offer { justify-content: flex-start; }
    ${
      useImage && dna.image_style !== "photo"
        ? `/* Duotone the backdrop into the brand palette. The scrim above
             already darkens it; this makes it *belong* to the popup. */
    #asmosPopupOverlay.asmos-overlay::before {
      content: "";
      position: absolute;
      inset: 0;
      z-index: 0;
      pointer-events: none;
      background: linear-gradient(160deg, var(--asmos-accent), var(--asmos-accent-2));
      mix-blend-mode: color;
      opacity: ${dna.image_style === "duotone" ? "0.85" : dna.image_style === "tinted" ? "0.45" : "1"};
    }
    #asmosPopupOverlay .asmos-content, #asmosPopupOverlay .asmos-close { z-index: 1; }`
        : ""
    }
    #asmosPopupOverlay .asmos-eyebrow { color: rgba(255,255,255,0.88); letter-spacing: 0.18em; font-size: 12px; }
    #asmosPopupOverlay .asmos-sub { max-width: 44ch; }
    #asmosPopupOverlay .asmos-timer { color: #fff; }
    #asmosPopupOverlay .asmos-form { max-width: 460px; }
    #asmosPopupOverlay .asmos-code { max-width: 460px; }
    #asmosPopupOverlay .asmos-dismiss { color: rgba(255,255,255,0.72); }
    ${
      dna.button_fill === "solid"
        ? ""
        : `#asmosPopupOverlay .asmos-cta { --asmos-btn-fg: #ffffff; --asmos-btn-border: rgba(255,255,255,0.8); }`
    }

    @media (max-height: 700px) {
      /* Short viewport (laptop, landscape phone): the figure yields first. It
         is the element that scales worst, and losing 30px of numeral costs far
         less than pushing the email field below the fold. */
      #asmosPopupOverlay .asmos-offer-value { font-size: clamp(38px, 9vh, 60px); }
      #asmosPopupOverlay .asmos-headline { font-size: clamp(24px, 4.4vh, 40px); }
    }

    @media (max-width: 720px) {
      #asmosPopupOverlay .asmos-content {
        padding: max(72px, calc(24px + env(safe-area-inset-top))) max(20px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(20px, env(safe-area-inset-left));
        align-items: center;
        text-align: center;
      }
      #asmosPopupOverlay .asmos-close {
        top: max(12px, env(safe-area-inset-top));
        right: max(12px, env(safe-area-inset-right));
      }
      #asmosPopupOverlay .popup-step { align-items: center; }
      #asmosPopupOverlay .asmos-form { display: block; width: 100%; }
      #asmosPopupOverlay .asmos-form .asmos-cta { width: 100%; }
      #asmosPopupOverlay .asmos-email-input { margin-bottom: 10px; }
    }
  </style>

  ${closeMarkup(dna)}

  <div class="asmos-content">
    ${stepsMarkup(props, dna, flow)}
  </div>
</div>
${runtimeScript({ dna, flow, goal, lockScroll: true, closeOnBackdrop: false, trapFocus: true, openDelayMs: 500 })}
`;
}
