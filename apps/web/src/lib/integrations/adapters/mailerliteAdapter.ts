import type { IntegrationAdapter, IntegrationEvent, DeliveryResult, ResolvedConnection } from "../types";

const BASE = "https://connect.mailerlite.com/api";

/**
 * MailerLite subscriber sync (new "connect" API). Uses the merchant's own API
 * key (Integrations → API), passed as a Bearer token. On lead.captured we
 * upsert the subscriber and, when a Group ID is configured, add them to it.
 */
export const mailerliteAdapter: IntegrationAdapter = {
  provider: "mailerlite",
  kind: "sync",

  async deliver({ event, connection }: { event: IntegrationEvent; connection: ResolvedConnection }): Promise<DeliveryResult> {
    if (event.event !== "lead.captured") {
      return { status: "skipped", detail: `Ignored event: ${event.event}` };
    }

    const apiKey = connection.secrets.apiKey;
    if (!apiKey) return { status: "failed", retriable: false, detail: "Missing MailerLite API key" };

    const { email, name, phone } = event.payload.lead;
    if (!email) return { status: "skipped", detail: "MailerLite requires an email; lead has none" };

    const groupId = connection.config.groupId && String(connection.config.groupId).trim() !== ""
      ? String(connection.config.groupId)
      : null;

    const body: Record<string, unknown> = {
      email,
      fields: {
        ...(name ? { name } : {}),
        ...(phone ? { phone } : {}),
      },
    };
    if (groupId) body.groups = [groupId];

    try {
      const res = await fetch(`${BASE}/subscribers`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const retriable = res.status >= 500 || res.status === 429;
        return { status: "failed", retriable, detail: `MailerLite subscriber upsert failed: ${res.status} ${await res.text()}` };
      }
      return { status: "success" };
    } catch (e: unknown) {
      return { status: "failed", retriable: true, detail: `Network error: ${e instanceof Error ? e.message : String(e)}` };
    }
  },

  async validate({ secrets }): Promise<{ ok: boolean; error?: string }> {
    if (!secrets.apiKey) return { ok: false, error: "API key is required" };
    try {
      const res = await fetch(`${BASE}/subscribers?limit=1`, {
        headers: { Authorization: `Bearer ${secrets.apiKey}`, Accept: "application/json" },
      });
      if (res.status === 401) return { ok: false, error: "Invalid MailerLite API key" };
      return { ok: res.ok };
    } catch {
      return { ok: false, error: "Could not reach MailerLite" };
    }
  },
};
