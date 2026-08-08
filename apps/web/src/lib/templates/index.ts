import { renderSplitScreenTemplate } from "./splitScreen";
import { renderCornerToastTemplate } from "./cornerToast";
import { renderFullscreenTakeoverTemplate } from "./fullscreenTakeover";
import type { PopupTemplateProps } from "./types";

export type { PopupTemplateProps } from "./types";

// AI popup variation roadmap (Phase 3): template_id -> render function
// dispatch. This is the layer that was missing before — the AI could only
// ever pick a CSS layout within one fixed template. Add a new template by
// writing a render*Template(props) function (see cornerToast.ts /
// fullscreenTakeover.ts for the pattern — same tracking-hook contract:
// call window.__asmos_track_event for DISMISSED/INTERACTION, respect
// window.__asmos_preview_mode, merge window.__asmos_behavioral_context()
// into the leads POST) and register it here + in popupGeneration.ts's
// template_id enum (JSON schema + system prompt).
export type TemplateId = "split-screen" | "corner-toast" | "fullscreen-takeover";

const TEMPLATES: Record<TemplateId, (props: PopupTemplateProps) => string> = {
  "split-screen": renderSplitScreenTemplate,
  "corner-toast": renderCornerToastTemplate,
  "fullscreen-takeover": renderFullscreenTakeoverTemplate,
};

export function renderPopupTemplate(
  templateId: string | null | undefined,
  props: PopupTemplateProps,
): string {
  const render = (templateId && TEMPLATES[templateId as TemplateId]) || TEMPLATES["split-screen"];
  return render(props);
}
