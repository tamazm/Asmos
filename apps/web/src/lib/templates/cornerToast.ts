import type { ResolvedTemplateProps } from "./types";
import { dnaTokens, sharedComponentCss, dnaFontImport } from "./dnaCss";
import { closeMarkup, resolveFlow, runtimeScript, stepsMarkup } from "./runtime";

/**
 * CORNER TOAST — a small, non-blocking card anchored to a screen edge.
 *
 * No backdrop, no page-scroll lock, no focus trap: this template's whole point
 * is being ignorable, which makes it the natural low-intrusion arm of a
 * trigger/friction test against an overlay control.
 */
export function renderCornerToastTemplate(props: ResolvedTemplateProps): string {
  const { primaryColor, imageUrl, dna, layoutStyle = "split-right" } = props;
  const goal = props.goal ?? "BOTH";
  const flow = resolveFlow(goal, dna);

  const accent = primaryColor || "#165DFF";

  // layout_style selects which edge the toast docks to.
  const anchor =
    layoutStyle === "split-left"
      ? "bottom: 20px; left: 20px;"
      : layoutStyle === "centered"
      ? "bottom: 20px; left: 50%; transform: translateX(-50%);"
      : layoutStyle === "minimal"
      ? "top: 20px; right: 20px;"
      : "bottom: 20px; right: 20px;";

  const width = layoutStyle === "centered" ? "400px" : layoutStyle === "minimal" ? "300px" : "348px";

  // A toast is too small for a side image or a full-bleed background; the only
  // imagery that reads at this size is a thumbnail strip along the top.
  const showsImage = dna.image_treatment === "top_band" && Boolean(imageUrl);

  // Entrance direction should follow the anchor — a toast docked bottom-right
  // sliding in from the left would look like a rendering bug.
  const slideFrom =
    dna.entrance === "slide_side"
      ? layoutStyle === "split-left"
        ? "translateX(-32px)"
        : "translateX(32px)"
      : "translateY(20px) scale(0.98)";

  return `
<!-- ASMOS TEMPLATE: CORNER-TOAST -->
<div class="asmos-toast-wrap" id="asmosPopupOverlay" hidden>
  <style>
    ${dnaFontImport(dna, props.brandFonts)}
    ${dnaTokens(dna, accent, props.brandFonts)}

    #asmosPopupOverlay.asmos-toast-wrap {
      position: fixed;
      ${anchor}
      z-index: 2147483000;
      font-family: var(--asmos-font-body);
      -webkit-font-smoothing: antialiased;
    }

    #asmosPopupOverlay .asmos-modal {
      position: relative;
      width: min(${width}, calc(100vw - 40px));
      box-sizing: border-box;
      background: var(--asmos-bg);
      border-radius: var(--asmos-radius);
      border: 1px solid var(--asmos-border);
      box-shadow: var(--asmos-shadow);
      overflow: hidden;
      transform: ${slideFrom};
      opacity: 0;
      transition: transform 340ms cubic-bezier(0.16,1,0.3,1), opacity 260ms ease-out;
    }
    #asmosPopupOverlay.is-open .asmos-modal { transform: none; opacity: 1; }

    #asmosPopupOverlay .asmos-media { ${showsImage ? "height: 108px;" : "display: none;"} overflow: hidden; }
    #asmosPopupOverlay .asmos-media img { width: 100%; height: 100%; object-fit: cover; display: block; }

    #asmosPopupOverlay .asmos-content {
      /* Re-point the padding tokens at the toast's own tighter scale, so any
         surface treatment that bleeds to the edge (see dnaCss's "paper" and
         "block") measures against the padding actually in use here rather than
         the modal-sized one. */
      --asmos-pad-y: ${dna.density === "airy" ? "24px" : dna.density === "compact" ? "16px" : "20px"};
      --asmos-pad-x: ${dna.density === "airy" ? "22px" : dna.density === "compact" ? "16px" : "20px"};
      padding: var(--asmos-pad-y) var(--asmos-pad-x);
      text-align: left;
      box-sizing: border-box;
    }

    #asmosPopupOverlay .asmos-close { top: 6px; right: 6px; width: 30px; height: 30px; font-size: 19px; }

    ${sharedComponentCss(dna)}

    /* A toast is a fraction of the width of a modal — clamp the DNA's type
       scale rather than letting "large" overflow a 340px card. */
    #asmosPopupOverlay .asmos-headline {
      font-size: min(var(--asmos-headline-size), 19px);
      padding-right: 22px;
      /* The measure cap is a modal-scale device; at 19px in a 348px card it
         would wrap the headline into a narrow column for no reason. */
      max-width: none;
    }
    #asmosPopupOverlay .asmos-sub { font-size: min(var(--asmos-sub-size), 13.5px); max-width: none; margin-bottom: var(--asmos-space-text); }
    #asmosPopupOverlay .asmos-cta { width: 100%; min-height: 42px; padding: 11px 16px; font-size: 13.5px; }
    #asmosPopupOverlay .asmos-email-input { min-height: 42px; padding: 10px 12px; font-size: 13.5px; }
    #asmosPopupOverlay .asmos-code { padding: 10px 13px; font-size: 13px; }
    #asmosPopupOverlay .asmos-form { display: block; }
    #asmosPopupOverlay .asmos-form .asmos-cta { width: 100%; }

    @media (max-width: 520px) {
      /* Full-width bottom sheet on phones regardless of anchor. Resets the
         translateX the "centered" anchor sets, which would otherwise fight
         this override. */
      #asmosPopupOverlay.asmos-toast-wrap { top: auto; left: 12px; right: 12px; bottom: 12px; transform: none; }
      #asmosPopupOverlay .asmos-modal { width: 100%; }
    }
  </style>

  <div class="asmos-modal" role="dialog" aria-modal="false" aria-labelledby="asmosPopupHeadline">
    ${closeMarkup(dna)}
    ${showsImage ? `<div class="asmos-media" aria-hidden="true"><img src="${imageUrl}" alt="" loading="lazy" /></div>` : ""}
    <div class="asmos-content">
      ${stepsMarkup(props, dna, flow)}
    </div>
  </div>
</div>
${runtimeScript({ dna, flow, goal, lockScroll: false, closeOnBackdrop: false, trapFocus: false, openDelayMs: 700 })}
`;
}
