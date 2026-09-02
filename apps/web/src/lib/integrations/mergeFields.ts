import type { LeadCapturedPayload } from "@/lib/webhook";

/**
 * The SINGLE source of truth for the merge variables a messaging template can
 * use (Mailgun email / Twilio SMS). Add a field here once and it appears in the
 * template editor's variable picker AND renders at send time — nothing else to
 * change.
 *
 * These mirror the lead data captured by the widget (the same fields the Leads
 * tab and CSV export show), because a template can only interpolate what the
 * `lead.captured` event actually carries. To expose a new variable, add the
 * captured field to the event payload (see api/widget/leads/route.ts) and add
 * one row here.
 *
 * This module is deliberately dependency-free (pure functions + a type-only
 * import) so both the server renderer and the client editor can import it.
 */
export interface MergeField {
  /** The token merchants type, e.g. "lead.name" → used as {{lead.name}}. */
  token: string;
  /** Human label shown in the picker. */
  label: string;
  /** Example value shown in the picker / preview. */
  sample: string;
  /** Pull this field's value out of a lead.captured payload. */
  fromLead: (payload: LeadCapturedPayload) => string | null | undefined;
}

export const MERGE_FIELDS: MergeField[] = [
  { token: "lead.name", label: "Name", sample: "Jane", fromLead: (p) => p.lead.name },
  { token: "lead.email", label: "Email", sample: "jane@example.com", fromLead: (p) => p.lead.email },
  { token: "lead.phone", label: "Phone", sample: "+15551234567", fromLead: (p) => p.lead.phone },
  { token: "campaign.name", label: "Campaign", sample: "Summer Sale", fromLead: (p) => p.campaign_name },
  { token: "variant.name", label: "Variant", sample: "Variant B", fromLead: (p) => p.variant_name },
  { token: "reward.label", label: "Reward", sample: "10% off", fromLead: (p) => p.reward?.label },
  { token: "reward.coupon_code", label: "Coupon code", sample: "WELCOME10", fromLead: (p) => p.reward?.coupon_code },
];

/** Build the `{{token}}` → value map for a lead.captured payload, from the registry. */
export function leadCapturedVars(payload: LeadCapturedPayload): Record<string, string | null | undefined> {
  const vars: Record<string, string | null | undefined> = {};
  for (const field of MERGE_FIELDS) vars[field.token] = field.fromLead(payload);
  return vars;
}
