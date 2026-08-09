import { renderSplitScreenTemplate } from "./splitScreen";
import { renderCornerToastTemplate } from "./cornerToast";
import { renderFullscreenTakeoverTemplate } from "./fullscreenTakeover";
import { normalizeDna } from "@/lib/popupDna";
import type { PopupTemplateProps, ResolvedTemplateProps } from "./types";

export type { PopupTemplateProps, ResolvedTemplateProps } from "./types";

// template_id -> render function dispatch. Add a new template by writing a
// render*Template(props: ResolvedTemplateProps) function (see splitScreen.ts
// for the pattern — structure only; chrome, copy and behaviour come from
// lib/templates/runtime.ts and lib/templates/dnaCss.ts) and registering it
// here plus in popupGeneration.ts's template_id enum.
export type TemplateId = "split-screen" | "corner-toast" | "fullscreen-takeover";

const TEMPLATES: Record<TemplateId, (props: ResolvedTemplateProps) => string> = {
  "split-screen": renderSplitScreenTemplate,
  "corner-toast": renderCornerToastTemplate,
  "fullscreen-takeover": renderFullscreenTakeoverTemplate,
};

export function renderPopupTemplate(
  templateId: string | null | undefined,
  props: PopupTemplateProps,
): string {
  const render = (templateId && TEMPLATES[templateId as TemplateId]) || TEMPLATES["split-screen"];
  // Normalizing here (rather than in each template) means every call site —
  // generation, the dashboard preview, /store-preview — gets the same
  // back-compat behaviour for Variant rows written before the DNA existed.
  return render({ ...props, dna: normalizeDna(props.dna) });
}
