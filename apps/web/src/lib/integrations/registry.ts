import type { IntegrationAdapter, IntegrationProvider } from "./types";
import { webhookAdapter } from "./adapters/webhookAdapter";
import { zapierAdapter, makeAdapter, n8nAdapter } from "./adapters/envelopeAdapters";
import { slackAdapter } from "./adapters/slackAdapter";
import { discordAdapter } from "./adapters/discordAdapter";
import { teamsAdapter } from "./adapters/teamsAdapter";
import { klaviyoAdapter } from "./adapters/klaviyoAdapter";
import { mailchimpAdapter } from "./adapters/mailchimpAdapter";
import { hubspotAdapter } from "./adapters/hubspotAdapter";
import { mailgunAdapter } from "./adapters/mailgunAdapter";
import { twilioAdapter } from "./adapters/twilioAdapter";

// Adapters implemented so far. Later phases add their entries here.
const ADAPTERS: Partial<Record<IntegrationProvider, IntegrationAdapter>> = {
  webhooks: webhookAdapter,
  zapier: zapierAdapter,
  make: makeAdapter,
  n8n: n8nAdapter,
  slack: slackAdapter,
  discord: discordAdapter,
  teams: teamsAdapter,
  klaviyo: klaviyoAdapter,
  mailchimp: mailchimpAdapter,
  hubspot: hubspotAdapter,
  mailgun: mailgunAdapter,
  twilio: twilioAdapter,
};

export function getAdapter(provider: IntegrationProvider): IntegrationAdapter | undefined {
  return ADAPTERS[provider];
}
