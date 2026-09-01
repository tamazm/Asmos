import type { IntegrationAdapter, IntegrationEvent, DeliveryResult, ResolvedConnection } from "../types";

function splitName(fullName: string | null): { firstName: string | null; lastName: string | null } {
  if (!fullName) return { firstName: null, lastName: null };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  const lastName = parts.pop() || null;
  const firstName = parts.join(" ");
  return { firstName, lastName };
}

export const hubspotAdapter: IntegrationAdapter = {
  provider: "hubspotAdapter".replace("Adapter", "") as any,

  kind: "sync",
  async deliver({ event, connection }: { event: IntegrationEvent; connection: ResolvedConnection }): Promise<DeliveryResult> {
    if (event.event !== "lead.captured") {
      return { status: "skipped", detail: `Ignored event: ${event.event}` };
    }

    const accessToken = connection.secrets.apiKey; // We'll store it in apiKey field generically
    if (!accessToken) {
      return { status: "failed", retriable: false, detail: "Missing HubSpot access token" };
    }

    const { email, name, phone } = event.payload.lead;
    const { firstName, lastName } = splitName(name);

    const headers = {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    };

    const properties: Record<string, string> = {};
    if (firstName) properties.firstname = firstName;
    if (lastName) properties.lastname = lastName;
    if (phone) properties.phone = phone;
    
    if (event.payload.campaign_name) properties.asmos_campaign = event.payload.campaign_name;
    if (event.payload.reward?.coupon_code) properties.asmos_coupon = event.payload.reward.coupon_code;

    const body = {
      inputs: [{
        id: email,
        idProperty: "email",
        properties,
      }]
    };

    try {
      const res = await fetch("https://api.hubapi.com/crm/v3/objects/contacts/batch/upsert", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const retriable = res.status >= 500 || res.status === 429;
        const text = await res.text();
        return { 
          status: "failed", 
          retriable, 
          detail: `HubSpot upsert failed: ${res.status} ${text}` 
        };
      }

      return { status: "success" };
    } catch (e: any) {
      return { status: "failed", retriable: true, detail: `Network error: ${e.message}` };
    }
  },

  async validate({ secrets }): Promise<{ ok: boolean; error?: string }> {
    if (!secrets.apiKey) return { ok: false };

    try {
      const res = await fetch("https://api.hubapi.com/crm/v3/objects/contacts?limit=1", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${secrets.apiKey}`,
          "Accept": "application/json",
        },
      });
      return { ok: res.ok };
    } catch {
      return { ok: false };
    }
  }
};
