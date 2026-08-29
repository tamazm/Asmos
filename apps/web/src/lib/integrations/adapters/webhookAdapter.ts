import crypto from "crypto";
import type { IntegrationAdapter, DeliveryResult, ValidationResult } from "../types";

function classify(status: number): DeliveryResult {
  if (status >= 200 && status < 300) return { status: "success" };
  // 408/429 and 5xx are transient; other 4xx are the merchant's endpoint rejecting us.
  const retriable = status === 408 || status === 429 || status >= 500;
  return { status: "failed", detail: `HTTP ${status}`, retriable };
}

export const webhookAdapter: IntegrationAdapter = {
  provider: "webhooks",
  kind: "webhook",

  async validate({ config }): Promise<ValidationResult> {
    const url = typeof config.url === "string" ? config.url : "";
    if (!url.startsWith("https://")) {
      return { ok: false, error: "Endpoint URL must start with https://" };
    }
    return { ok: true };
  },

  async deliver({ event, connection }): Promise<DeliveryResult> {
    const url = String(connection.config.url ?? "");
    const secret = connection.secrets.signingSecret ?? null;
    const payload = JSON.stringify(event);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "Asmos-Webhook/1.0",
      "X-Asmos-Event": event.event,
      "X-Asmos-Timestamp": String(Date.now()),
    };
    if (secret) {
      const sig = crypto.createHmac("sha256", secret).update(payload).digest("hex");
      headers["X-Asmos-Signature"] = `sha256=${sig}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(url, { method: "POST", headers, body: payload, signal: controller.signal });
      return classify(res.status);
    } catch (err) {
      return { status: "failed", detail: err instanceof Error ? err.message : "network error", retriable: true };
    } finally {
      clearTimeout(timeout);
    }
  },
};
