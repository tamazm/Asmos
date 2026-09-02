import type { IntegrationAdapter, IntegrationEvent, DeliveryResult, ResolvedConnection } from "../types";
import { splitName } from "./names";

const BASE = "https://api.brevo.com/v3";

/**
 * Brevo (formerly Sendinblue) contact sync. Uses the merchant's own API key
 * (SMTP & API → API Keys), passed as the `api-key` header. On lead.captured we
 * upsert the contact (updateEnabled: true) and, when a List ID is configured,
 * add them to that list.
 */
export const brevoAdapter: IntegrationAdapter = {
  provider: "brevo",
  kind: "sync",

  async deliver({ event, connection }: { event: IntegrationEvent; connection: ResolvedConnection }): Promise<DeliveryResult> {
    if (event.event !== "lead.captured") {
      return { status: "skipped", detail: `Ignored event: ${event.event}` };
    }

    const apiKey = connection.secrets.apiKey;
    if (!apiKey) return { status: "failed", retriable: false, detail: "Missing Brevo API key" };

    const { email, name, phone } = event.payload.lead;
    if (!email) return { status: "skipped", detail: "Brevo requires an email; lead has none" };

    const { firstName, lastName } = splitName(name);
    const listIdRaw = connection.config.listId;
    const listId = listIdRaw != null && String(listIdRaw).trim() !== "" ? Number(String(listIdRaw)) : NaN;

    const body: Record<string, unknown> = {
      email,
      updateEnabled: true,
      attributes: {
        ...(firstName ? { FIRSTNAME: firstName } : {}),
        ...(lastName ? { LASTNAME: lastName } : {}),
        ...(phone ? { SMS: phone } : {}),
      },
    };
    if (Number.isFinite(listId)) body.listIds = [listId];

    try {
      const res = await fetch(`${BASE}/contacts`, {
        method: "POST",
        headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
      });
      // 201 = created, 204 = updated. Both are res.ok.
      if (!res.ok) {
        const retriable = res.status >= 500 || res.status === 429;
        return { status: "failed", retriable, detail: `Brevo contact upsert failed: ${res.status} ${await res.text()}` };
      }
      return { status: "success" };
    } catch (e: unknown) {
      return { status: "failed", retriable: true, detail: `Network error: ${e instanceof Error ? e.message : String(e)}` };
    }
  },

  async validate({ secrets }): Promise<{ ok: boolean; error?: string }> {
    if (!secrets.apiKey) return { ok: false, error: "API key is required" };
    try {
      const res = await fetch(`${BASE}/account`, { headers: { "api-key": secrets.apiKey, Accept: "application/json" } });
      if (res.status === 401) return { ok: false, error: "Invalid Brevo API key" };
      return { ok: res.ok };
    } catch {
      return { ok: false, error: "Could not reach Brevo" };
    }
  },
};
