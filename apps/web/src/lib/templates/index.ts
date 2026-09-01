import { renderSplitScreenTemplate } from "./splitScreen";
import { renderCornerToastTemplate } from "./cornerToast";
import { renderFullscreenTakeoverTemplate } from "./fullscreenTakeover";
import { normalizeDna } from "../popupDna";
import { auditPopupContrast, type ContrastViolation } from "./contrastAudit";
import type { PopupTemplateProps, ResolvedTemplateProps, PopupStructure } from "./types";

export type { PopupTemplateProps, ResolvedTemplateProps } from "./types";

// template_id -> render function dispatch. Add a new template by writing a
// render*Template(props: ResolvedTemplateProps) function (see splitScreen.ts
// for the pattern - structure only; chrome, copy and behaviour come from
// lib/templates/runtime.ts and lib/templates/dnaCss.ts) and registering it
// here plus in popupGeneration.ts's template_id enum.
export type TemplateId = "split-screen" | "corner-toast" | "fullscreen-takeover";

const TEMPLATES: Record<TemplateId, (props: ResolvedTemplateProps) => string> = {
  "split-screen": renderSplitScreenTemplate,
  "corner-toast": renderCornerToastTemplate,
  "fullscreen-takeover": renderFullscreenTakeoverTemplate,
};

function normalizeShell(templateId: string | null | undefined, structure?: PopupStructure | null): TemplateId {
  const raw = (structure?.shell ?? templateId ?? "split-screen").toLowerCase();
  if (["corner-toast", "toast"].includes(raw)) return "corner-toast";
  if (["fullscreen-takeover", "takeover", "sheet", "full-bleed"].includes(raw)) return "fullscreen-takeover";
  return "split-screen";
}

function normalizeLayoutStyle(
  layoutStyle: PopupTemplateProps["layoutStyle"],
  structure?: PopupStructure | null,
): PopupTemplateProps["layoutStyle"] {
  const raw = (structure?.layout ?? layoutStyle ?? "split-left").toLowerCase();
  return ["split-left", "split-right", "centered", "minimal", "stacked", "asymmetric"].includes(raw)
    ? raw
    : (layoutStyle ?? "split-left");
}

function resolveTemplateAndLayout(
  templateId: string | null | undefined,
  props: PopupTemplateProps,
): { templateId: TemplateId; layoutStyle: PopupTemplateProps["layoutStyle"] } {
  const normalizedTemplateId = normalizeShell(templateId, props.structure);
  return {
    templateId: normalizedTemplateId,
    layoutStyle: normalizeLayoutStyle(props.layoutStyle, props.structure),
  };
}

export function renderPopupTemplate(
  templateId: string | null | undefined,
  props: PopupTemplateProps,
): string {
  const { templateId: normalizedTemplateId, layoutStyle } = resolveTemplateAndLayout(templateId, props);
  const render = TEMPLATES[normalizedTemplateId];
  // Normalizing here (rather than in each template) means every call site -
  // generation, the dashboard preview, /store-preview - gets the same
  // back-compat behaviour for Variant rows written before the DNA existed.
  const resolved: ResolvedTemplateProps = {
    ...props,
    layoutStyle,
    dna: normalizeDna(props.dna),
    templateId: normalizedTemplateId,
  };

  // A popup whose CTA cannot be read is not a variant, it is a defect, and it
  // must never reach an arm of the tournament. Contrast is a deterministic
  // property of the resolved tokens: checking it here costs nothing, where
  // letting the bandit discover it costs thousands of live impressions.
  const violations = auditPopupContrast(resolved);
  if (violations.length > 0) {
    console.error(
      `[templates] contrast violations on ${templateId ?? "split-screen"}:`,
      violations.map((v) => `${v.role} ${v.ratio}:1 (needs ${v.target}:1)`).join(", "),
    );
  }

  return render(resolved);
}

/**
 * Same render, but reports what would ship unreadable instead of only logging.
 *
 * Generation uses this to reject a candidate spec and resample rather than
 * persisting a Variant nobody can use - see `popupGeneration.ts`.
 */
export function renderPopupTemplateChecked(
  templateId: string | null | undefined,
  props: PopupTemplateProps,
): { html: string; violations: ContrastViolation[] } {
  const { templateId: normalizedTemplateId, layoutStyle } = resolveTemplateAndLayout(templateId, props);
  const render = TEMPLATES[normalizedTemplateId];
  const resolved: ResolvedTemplateProps = {
    ...props,
    layoutStyle,
    dna: normalizeDna(props.dna),
    templateId: normalizedTemplateId,
  };
  return { html: render(resolved), violations: auditPopupContrast(resolved) };
}

export { auditPopupContrast } from "./contrastAudit";
export type { ContrastViolation } from "./contrastAudit";
