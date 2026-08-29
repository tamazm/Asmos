import type { IntegrationAdapter, IntegrationProvider } from "./types";
import { webhookAdapter } from "./adapters/webhookAdapter";

// Adapters implemented so far. Later phases add their entries here.
const ADAPTERS: Partial<Record<IntegrationProvider, IntegrationAdapter>> = {
  webhooks: webhookAdapter,
};

export function getAdapter(provider: IntegrationProvider): IntegrationAdapter | undefined {
  return ADAPTERS[provider];
}
