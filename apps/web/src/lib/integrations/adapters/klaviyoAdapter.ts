import type { IntegrationAdapter, IntegrationEvent, DeliveryResult, ResolvedConnection } from "../types";

function splitName(fullName: string | null): { firstName: string | null; lastName: string | null } {
  if (!fullName) return { firstName: null, lastName: null };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  const lastName = parts.pop() || null;
  const firstName = parts.join(" ");
  return { firstName, lastName };
}

export const klaviyoAdapter: IntegrationAdapter = {
  provider: "klaviyoAdapter".replace("Adapter", "") as any,

  kind: "sync",
  async deliver({ event, connection }: { event: IntegrationEvent; connection: ResolvedConnection }): Promise<DeliveryResult> {
    if (event.event !== "lead.captured") {
      return { status: "skipped", detail: `Ignored event: ${event.event}` };
    }

    const apiKey = connection.secrets.apiKey;
    if (!apiKey) {
      return { status: "failed", retriable: false, detail: "Missing Klaviyo API key" };
    }

    const listId = connection.config.listId;
    if (!listId) {
      return { status: "failed", retriable: false, detail: "Missing Klaviyo List ID" };
    }

    const { email, name, phone } = event.payload.lead;
    const { firstName, lastName } = splitName(name);

    const headers = {
      "Authorization": `Klaviyo-API-Key ${apiKey}`,
      "revision": "2024-10-15",
      "Content-Type": "application/json",
      "Accept": "application/json",
    };

    const body = {
      data: {
        type: "profile-subscription-bulk-create-job",
        attributes: {
          profiles: {
            data: [{
              type: "profile",
              attributes: {
                email,
                ...(firstName ? { first_name: firstName } : {}),
                ...(lastName ? { last_name: lastName } : {}),
                ...(phone ? { phone_number: phone } : {}),
              }
            }]
          }
        },
        relationships: {
          list: { data: { type: "list", id: listId } }
        }
      }
    };

    try {
      const res = await fetch("https://a.klaviyo.com/api/profile-subscription-bulk-create-jobs/", {
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
          detail: `Klaviyo subscribe failed: ${res.status} ${text}` 
        };
      }

      const eventBody = {
        data: {
          type: "event",
          attributes: {
            profile: { email },
            metric: { name: "Asmos Lead Captured" },
            properties: {
              campaign_name: event.payload.campaign_name,
              coupon_code: event.payload.reward?.coupon_code || null,
              asmos: true,
            },
            time: event.payload.lead.captured_at
          }
        }
      };

      const eventRes = await fetch("https://a.klaviyo.com/api/events/", {
        method: "POST",
        headers,
        body: JSON.stringify(eventBody),
      });

      if (!eventRes.ok) {
        const retriable = eventRes.status >= 500 || eventRes.status === 429;
        const text = await eventRes.text();
        return { 
          status: "failed", 
          retriable, 
          detail: `Klaviyo event track failed: ${eventRes.status} ${text}` 
        };
      }

      return { status: "success" };
    } catch (e: any) {
      return { status: "failed", retriable: true, detail: `Network error: ${e.message}` };
    }
  },

  async validate({ secrets, config }): Promise<{ ok: boolean; error?: string }> {
    if (!secrets.apiKey || !config.listId) return { ok: false };

    try {
      const res = await fetch(`https://a.klaviyo.com/api/lists/${config.listId}/`, {
        method: "GET",
        headers: {
          "Authorization": `Klaviyo-API-Key ${secrets.apiKey}`,
          "revision": "2024-10-15",
          "Accept": "application/json",
        },
      });
      return { ok: res.ok };
    } catch {
      return { ok: false };
    }
  }
};
