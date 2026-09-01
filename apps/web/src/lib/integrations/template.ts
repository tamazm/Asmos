import type { IntegrationEvent } from "./types";

type TemplateVars = Record<string, string | null | undefined>;

/** Render a template string by replacing {{key}} with escaped values.
 *  Unknown vars render as empty string. Nested paths use dot notation. */
export function renderTemplate(template: string, vars: TemplateVars): string {
  if (!template) return "";
  return template.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
    const k = key.trim();
    const val = vars[k];
    if (val === null || val === undefined) return "";
    return escapeHtml(String(val));
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
    return {
      "lead.name": event.payload.lead.name,
      "lead.email": event.payload.lead.email,
      "lead.phone": event.payload.lead.phone,
      "campaign.name": event.payload.campaign_name,
      "variant.name": event.payload.variant_name,
      "reward.label": event.payload.reward?.label,
      "reward.coupon_code": event.payload.reward?.coupon_code,
    };
  }

  if (event.event === "variant.winner_declared") {
    return {
      "campaign.name": event.payload.campaign_name,
      "variant.name": event.payload.winning_variant_name,
    };
  }

  return {};
}
