import type { CampaignLifecyclePayload, LeadCapturedPayload, VariantWinnerPayload } from "@/lib/webhook";

export const INTEGRATION_PROVIDERS = [
  "webhooks", "zapier", "make", "n8n", "slack", "discord", "teams",
  "klaviyo", "mailchimp", "hubspot", "mailgun", "twilio",
] as const;

export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];

export function isIntegrationProvider(v: unknown): v is IntegrationProvider {
  return typeof v === "string" && (INTEGRATION_PROVIDERS as readonly string[]).includes(v);
}

// Canonical event union carried through the bus. Payload types are shared with
// the legacy webhook module to avoid duplication.
export type IntegrationEvent =
  | { event: "lead.captured"; payload: LeadCapturedPayload }
  | { event: "variant.winner_declared"; payload: VariantWinnerPayload }
  | { event: "campaign.activated"; payload: CampaignLifecyclePayload }
  | { event: "campaign.paused"; payload: CampaignLifecyclePayload };

export type IntegrationEventName = IntegrationEvent["event"];

// Decrypted, ready-to-use connection as seen by an adapter (server-side only).
export interface ResolvedConnection {
  id: string;
  accountId: string;
  provider: IntegrationProvider;
  enabled: boolean;
  config: Record<string, unknown>;
  subscribedEvents: string[];
  secrets: Record<string, string>;
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

export interface DeliveryResult {
  status: "success" | "failed" | "skipped";
  detail?: string;
  // When status is "failed", whether the pipeline should retry (network/5xx/429)
  // vs. give up (auth/validation). Ignored for success/skipped.
  retriable?: boolean;
}

export interface DeliverContext {
  event: IntegrationEvent;
  connection: ResolvedConnection;
  renderedContent?: {
    subject: string | null;
    body: string;
    to: string;
  };
}

export interface IntegrationAdapter {
  provider: IntegrationProvider;
  kind: "webhook" | "sync" | "messaging";
  validate(input: { config: Record<string, unknown>; secrets: Record<string, string> }): Promise<ValidationResult>;
  deliver(ctx: DeliverContext): Promise<DeliveryResult>;
}
