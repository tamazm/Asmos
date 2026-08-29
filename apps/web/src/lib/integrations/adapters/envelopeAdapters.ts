import type { IntegrationAdapter, IntegrationProvider } from "../types";
import { postWebhook } from "./httpDelivery";

function createEnvelopeAdapter(provider: IntegrationProvider): IntegrationAdapter {
  return {
    provider,
    kind: "webhook",
    async validate({ config }) {
      const url = typeof config.url === "string" ? config.url : "";
      return url.startsWith("https://") ? { ok: true } : { ok: false, error: "Endpoint URL must start with https://" };
    },
    async deliver({ event, connection }) {
      return postWebhook(String(connection.config.url ?? ""), event, {
        secret: connection.secrets.signingSecret ?? null,
        event: event.event,
      });
    },
  };
}

export const zapierAdapter = createEnvelopeAdapter("zapier");
export const makeAdapter = createEnvelopeAdapter("make");
export const n8nAdapter = createEnvelopeAdapter("n8n");
