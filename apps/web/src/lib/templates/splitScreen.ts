import type { ResolvedTemplateProps } from "./types";
import { DEFAULT_FALLBACK_IMAGE } from "@/lib/imageLibrary";
import { dnaTokens, sharedComponentCss, overlayColor, dnaFontImport } from "./dnaCss";
import { closeMarkup, resolveFlow, runtimeScript, stepsMarkup } from "./runtime";

/**
 * SPLIT SCREEN — a centered modal card, optionally paired with an image.
 *
 * This file used to hardcode a 10-minute countdown, a "Limited Time Offer"
 * eyebrow and the step-2 copy, which is why every popup Asmos ever generated
 * looked identical. All of that now comes from the DNA; this file owns the
 * card geometry and nothing else.
 */
export function renderSplitScreenTemplate(props: ResolvedTemplateProps): string {
  const { primaryColor, imageUrl, dna, layoutStyle = "split-left" } = props;
  const goal = props.goal ?? "BOTH";
  const flow = resolveFlow(goal, dna);

  const accent = primaryColor || "#165DFF";
  const img = imageUrl || DEFAULT_FALLBACK_IMAGE;

  // image_treatment is the DNA's say on imagery; layout_style is the AI's say
  // on where the card sits. "none" wins over any layout that implies an image.
  //
  // A missing image_url now means *no image*, not "substitute the default".
  // The old `imageUrl || DEFAULT_FALLBACK_IMAGE` meant a store with nothing
  // suitable to show got a stock photo of a living room next to its offer —
  // and, when the model reached for the library's discount photo, a picture of
  // "50%" next to a 10% offer. Irrelevant imagery is worse than none.
  const wantsImage =
    dna.image_treatment !== "none" && layoutStyle !== "minimal" && Boolean(imageUrl);
  const treatment = dna.image_treatment;
  const isSideImage = wantsImage && (treatment === "side" || treatment === "background") && layoutStyle.startsWith("split");
  const isTopBand = wantsImage && (treatment === "top_band" || (treatment === "side" && !layoutStyle.startsWith("split")));
  const showsImage = isSideImage || isTopBand;

  const maxWidth = isSideImage ? "880px" : layoutStyle === "minimal" ? "440px" : "560px";

  return `
<!-- ASMOS TEMPLATE: SPLIT-SCREEN -->
<div class="asmos-overlay" id="asmosPopupOverlay" hidden>
  <style>
    ${dnaFontImport(dna, props.brandFonts)}
    ${dnaTokens(dna, accent, props.brandFonts, props.palette)}

    #asmosPopupOverlay.asmos-overlay {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      box-sizing: border-box;
      z-index: 2147483000;
      background: ${overlayColor(dna)};
      opacity: 0;
      visibility: hidden;
      transition: opacity 240ms ease-out, visibility 240ms ease-out;
      font-family: var(--asmos-font-body);
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
    }
    #asmosPopupOverlay.is-open { opacity: 1; visibility: visible; }

    #asmosPopupOverlay .asmos-modal {
      position: relative;
      width: min(${maxWidth}, 100%);
      max-height: 90vh;
      overflow: hidden auto;
      background: var(--asmos-bg);
      border-radius: var(--asmos-radius);
      box-shadow: var(--asmos-shadow);
      display: ${isSideImage ? "grid" : "block"};
      ${isSideImage ? "grid-template-columns: 1fr 1fr;" : ""}
      ${isSideImage && layoutStyle === "split-right" ? "direction: rtl;" : ""}
      transform: var(--asmos-enter-from);
      opacity: 0;
      transition: transform 420ms cubic-bezier(0.16,1,0.3,1), opacity 320ms ease-out;
    }
    #asmosPopupOverlay.is-open .asmos-modal { transform: var(--asmos-enter-to); opacity: 1; }

    #asmosPopupOverlay .asmos-media {
      ${showsImage ? "" : "display: none;"}
      overflow: hidden;
      background: color-mix(in srgb, var(--asmos-accent) 8%, #f3f4f6);
      ${isTopBand ? "height: 180px;" : ""}
    }
    #asmosPopupOverlay .asmos-media img { width: 100%; height: 100%; object-fit: cover; display: block; }

    #asmosPopupOverlay .asmos-content {
      direction: ltr;
      padding: var(--asmos-pad);
      display: flex;
      flex-direction: column;
      /* The composition axis comes from the DNA now, not from which side the
         image happens to sit on. Deriving text alignment from layout_style
         meant three of the four layouts were centred by accident rather than
         by decision — see popupDna's TEXT_ALIGNS. */
      align-items: var(--asmos-align-items);
      justify-content: center;
      text-align: var(--asmos-align);
      box-sizing: border-box;
    }

    #asmosPopupOverlay .asmos-close { top: 10px; ${layoutStyle === "split-right" && isSideImage ? "left: 10px;" : "right: 10px;"} }
    ${
      dna.close_affordance === "x_outside"
        ? `#asmosPopupOverlay .asmos-close { top: -46px; right: 0; color: rgba(255,255,255,0.9); }`
        : ""
    }

    ${sharedComponentCss(dna)}

    @media (max-width: 720px) {
      #asmosPopupOverlay .asmos-modal { grid-template-columns: 1fr; direction: ltr; max-height: 88vh; }
      #asmosPopupOverlay .asmos-media { max-height: 22vh; }
      #asmosPopupOverlay .asmos-content { padding: 28px 22px; align-items: center; text-align: center; }
      #asmosPopupOverlay .asmos-headline { font-size: min(var(--asmos-headline-size), 26px); }
      #asmosPopupOverlay .asmos-form { display: block; }
      #asmosPopupOverlay .asmos-form .asmos-cta { width: 100%; }
      #asmosPopupOverlay .asmos-email-input { margin-bottom: 10px; }
    }
  </style>

  <div class="asmos-modal" role="dialog" aria-modal="true" aria-labelledby="asmosPopupHeadline">
    ${closeMarkup(dna)}
    <div class="asmos-media" aria-hidden="true">
      <img src="${img}" alt="" loading="lazy"
           onerror="this.onerror=null;this.src='${DEFAULT_FALLBACK_IMAGE}';" />
    </div>
    <div class="asmos-content">
      ${stepsMarkup(props, dna, flow)}
    </div>
  </div>
</div>
${runtimeScript({ dna, flow, goal, lockScroll: true, closeOnBackdrop: true, trapFocus: true, openDelayMs: 400 })}
`;
}
