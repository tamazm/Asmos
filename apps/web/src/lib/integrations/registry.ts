import type { IntegrationAdapter, IntegrationProvider } from "./types";
import { webhookAdapter } from "./adapters/webhookAdapter";
import { zapierAdapter, makeAdapter, n8nAdapter } from "./adapters/envelopeAdapters";
import { slackAdapter } from "./adapters/slackAdapter";
import { discordAdapter } from "./adapters/discordAdapter";
import { teamsAdapter } from "./adapters/teamsAdapter";

// Adapters implemented so far. Later phases add their entries here.
const ADAPTERS: Partial<Record<IntegrationProvider, IntegrationAdapter>> = {
  webhooks: webhookAdapter,
  zapier: zapierAdapter,
  make: makeAdapter,
  n8n: n8nAdapter,
  slack: slackAdapter,
  discord: discordAdapter,
  teams: teamsAdapter,
};

export function getAdapter(provider: IntegrationProvider): IntegrationAdapter | undefined {
  return ADAPTERS[provider];
}
