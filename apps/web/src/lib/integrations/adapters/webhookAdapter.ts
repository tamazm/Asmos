import type { IntegrationAdapter, ValidationResult } from "../types";
import { postWebhook } from "./httpDelivery";

export const webhookAdapter: IntegrationAdapter = {
  provider: "webhooks",
  kind: "webhook",

  async validate({ config }): Promise<ValidationResult> {
    const url = typeof config.url === "string" ? config.url : "";
    if (!url.startsWith("https://")) return { ok: false, error: "Endpoint URL must start with https://" };
    return { ok: true };
  },

  async deliver({ event, connection }) {
    return postWebhook(String(connection.config.url ?? ""), event, {
      secret: connection.secrets.signingSecret ?? null,
      event: event.event,
    });
  },
};
