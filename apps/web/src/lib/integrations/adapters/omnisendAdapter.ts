import type { IntegrationAdapter, IntegrationEvent, DeliveryResult, ResolvedConnection } from "../types";
import { splitName } from "./names";

const BASE = "https://api.omnisend.com/v3";

/**
 * Omnisend contact sync. Authenticates with the merchant's own API key
 * (Settings → Integrations & API → API keys), passed as `X-API-KEY`.
 * On lead.captured we upsert a contact subscribed on the email (and SMS)
 * channels so it lands in the merchant's audience for automations.
 */
export const omnisendAdapter: IntegrationAdapter = {
  provider: "omnisend",
  kind: "sync",

  async deliver({ event, connection }: { event: IntegrationEvent; connection: ResolvedConnection }): Promise<DeliveryResult> {
    if (event.event !== "lead.captured") {
      return { status: "skipped", detail: `Ignored event: ${event.event}` };
    }

    const apiKey = connection.secrets.apiKey;
    if (!apiKey) return { status: "failed", retriable: false, detail: "Missing Omnisend API key" };

    const { email, name, phone } = event.payload.lead;
    if (!email && !phone) return { status: "skipped", detail: "Lead has no email or phone" };

    const { firstName, lastName } = splitName(name);
    const now = new Date().toISOString();

    const identifiers: Array<Record<string, unknown>> = [];
    if (email) identifiers.push({ type: "email", id: email, channels: { email: { status: "subscribed", statusDate: now } } });
    if (phone) identifiers.push({ type: "phone", id: phone, channels: { sms: { status: "subscribed", statusDate: now } } });

    const body = {
      identifiers,
      ...(firstName ? { firstName } : {}),
      ...(lastName ? { lastName } : {}),
      tags: ["asmos"],
    };

    try {
      const res = await fetch(`${BASE}/contacts`, {
        method: "POST",
        headers: { "X-API-KEY": apiKey, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const retriable = res.status >= 500 || res.status === 429;
        return { status: "failed", retriable, detail: `Omnisend contact create failed: ${res.status} ${await res.text()}` };
      }
      return { status: "success" };
    } catch (e: unknown) {
      return { status: "failed", retriable: true, detail: `Network error: ${e instanceof Error ? e.message : String(e)}` };
    }
  },

  async validate({ secrets }): Promise<{ ok: boolean; error?: string }> {
    if (!secrets.apiKey) return { ok: false, error: "API key is required" };
    try {
      const res = await fetch(`${BASE}/contacts?limit=1`, {
        headers: { "X-API-KEY": secrets.apiKey, Accept: "application/json" },
      });
      if (res.status === 401 || res.status === 403) return { ok: false, error: "Invalid Omnisend API key" };
      return { ok: res.ok };
    } catch {
      return { ok: false, error: "Could not reach Omnisend" };
    }
  },
};
