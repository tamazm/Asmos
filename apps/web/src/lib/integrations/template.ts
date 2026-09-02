import type { IntegrationEvent } from "./types";
import { leadCapturedVars } from "./mergeFields";

type TemplateVars = Record<string, string | null | undefined>;

/** Render a template string by replacing {{key}} with values.
 *  Unknown vars render as empty string. Nested paths use dot notation.
 *  `escape` HTML-encodes substituted values — correct for HTML email bodies,
 *  but must be false for plain-text output (SMS bodies, email subjects) or
 *  characters like ' and & leak through as &#039; / &amp;. */
export function renderTemplate(template: string, vars: TemplateVars, escape: boolean = true): string {
  if (!template) return "";
  return template.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
    const k = key.trim();
    const val = vars[k];
    if (val === null || val === undefined) return "";
    const str = String(val);
    return escape ? escapeHtml(str) : str;
  });
}

/** HTML-escape a value (for email bodies). */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** Build the variable map from an IntegrationEvent payload. */
export function buildTemplateVars(event: IntegrationEvent): TemplateVars {
  if (event.event === "lead.captured") {
    // Derived from the single merge-field registry so the editor's variable
    // picker and this renderer never drift — see mergeFields.ts.
    return leadCapturedVars(event.payload);
  }

  if (event.event === "variant.winner_declared") {
    return {
      "campaign.name": event.payload.campaign_name,
      "variant.name": event.payload.winning_variant_name,
    };
  }

  if (event.event === "campaign.activated" || event.event === "campaign.paused") {
    return {
      "campaign.name": event.payload.campaign_name,
    };
  }

  return {};
}
