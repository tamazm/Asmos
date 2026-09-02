import type { IntegrationAdapter, IntegrationEvent, DeliveryResult, ResolvedConnection } from "../types";
import { splitName } from "./names";

/** Drip uses HTTP Basic auth with the API token as the username and no password. */
function basicAuth(token: string): string {
  return "Basic " + btoa(`${token}:`);
}

/**
 * Drip subscriber sync. Uses the merchant's own API token (Settings → User
 * settings → API token) plus their numeric Account ID (Settings → Account →
 * General info). On lead.captured we upsert the subscriber and tag them "Asmos".
 */
export const dripAdapter: IntegrationAdapter = {
  provider: "drip",
  kind: "sync",

  async deliver({ event, connection }: { event: IntegrationEvent; connection: ResolvedConnection }): Promise<DeliveryResult> {
    if (event.event !== "lead.captured") {
      return { status: "skipped", detail: `Ignored event: ${event.event}` };
    }

    const apiKey = connection.secrets.apiKey;
    if (!apiKey) return { status: "failed", retriable: false, detail: "Missing Drip API token" };

    const accountId = connection.config.accountId ? String(connection.config.accountId).trim() : "";
    if (!accountId) return { status: "failed", retriable: false, detail: "Missing Drip Account ID" };

    const { email, name, phone } = event.payload.lead;
    if (!email) return { status: "skipped", detail: "Drip requires an email; lead has none" };

    const { firstName, lastName } = splitName(name);

    const body = {
      subscribers: [{
        email,
        ...(firstName ? { first_name: firstName } : {}),
        ...(lastName ? { last_name: lastName } : {}),
        ...(phone ? { phone } : {}),
        tags: ["Asmos"],
      }],
    };

    try {
      const res = await fetch(`https://api.getdrip.com/v2/${accountId}/subscribers`, {
        method: "POST",
        headers: {
          Authorization: basicAuth(apiKey),
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": "Asmos (asmos.io)",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const retriable = res.status >= 500 || res.status === 429;
        return { status: "failed", retriable, detail: `Drip subscriber upsert failed: ${res.status} ${await res.text()}` };
      }
      return { status: "success" };
    } catch (e: unknown) {
      return { status: "failed", retriable: true, detail: `Network error: ${e instanceof Error ? e.message : String(e)}` };
    }
  },

  async validate({ secrets, config }): Promise<{ ok: boolean; error?: string }> {
    if (!secrets.apiKey) return { ok: false, error: "API token is required" };
    const accountId = config.accountId ? String(config.accountId).trim() : "";
    if (!accountId) return { ok: false, error: "Account ID is required" };
    try {
      const res = await fetch(`https://api.getdrip.com/v2/${accountId}/subscribers?per_page=1`, {
        headers: { Authorization: basicAuth(secrets.apiKey), Accept: "application/json", "User-Agent": "Asmos (asmos.io)" },
      });
      if (res.status === 401) return { ok: false, error: "Invalid Drip API token" };
      if (res.status === 404) return { ok: false, error: "Drip account not found — check your Account ID" };
      return { ok: res.ok };
    } catch {
      return { ok: false, error: "Could not reach Drip" };
    }
  },
};
