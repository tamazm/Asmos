import type { IntegrationAdapter, IntegrationProvider } from "./types";
import { webhookAdapter } from "./adapters/webhookAdapter";
import { zapierAdapter, makeAdapter, n8nAdapter } from "./adapters/envelopeAdapters";

// Adapters implemented so far. Later phases add their entries here.
const ADAPTERS: Partial<Record<IntegrationProvider, IntegrationAdapter>> = {
  webhooks: webhookAdapter,
  zapier: zapierAdapter,
  make: makeAdapter,
  n8n: n8nAdapter,
};

export function getAdapter(provider: IntegrationProvider): IntegrationAdapter | undefined {
  return ADAPTERS[provider];
}
