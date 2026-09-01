import crypto from "crypto";
import type { IntegrationAdapter, IntegrationEvent, DeliveryResult, ResolvedConnection } from "../types";

function splitName(fullName: string | null): { firstName: string | null; lastName: string | null } {
  if (!fullName) return { firstName: null, lastName: null };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  const lastName = parts.pop() || null;
  const firstName = parts.join(" ");
  return { firstName, lastName };
}

function getSubscriberHash(email: string): string {
  return crypto.createHash("md5").update(email.toLowerCase()).digest("hex");
}

function getDataCenter(apiKey: string): string | null {
  const parts = apiKey.split("-");
  return parts.length > 1 ? parts[parts.length - 1] : null;
}

export const mailchimpAdapter: IntegrationAdapter = {
  provider: "mailchimpAdapter".replace("Adapter", "") as any,

  kind: "sync",
  async deliver({ event, connection }: { event: IntegrationEvent; connection: ResolvedConnection }): Promise<DeliveryResult> {
    if (event.event !== "lead.captured") {
      return { status: "skipped", detail: `Ignored event: ${event.event}` };
    }

    const apiKey = connection.secrets.apiKey;
    if (!apiKey) {
      return { status: "failed", retriable: false, detail: "Missing Mailchimp API key" };
    }

    const audienceId = connection.config.audienceId;
    if (!audienceId) {
      return { status: "failed", retriable: false, detail: "Missing Mailchimp Audience ID" };
    }

    const dc = getDataCenter(apiKey);
    if (!dc) {
      return { status: "failed", retriable: false, detail: "Invalid Mailchimp API key format (missing data center)" };
    }

    const { email, name, phone } = event.payload.lead;
    const { firstName, lastName } = splitName(name);
    const subscriberHash = getSubscriberHash(email);

    const headers = {
      "Authorization": `Basic ${Buffer.from(`any:${apiKey}`).toString("base64")}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    };

    const baseUrl = `https://${dc}.api.mailchimp.com/3.0`;

    // 1. Upsert member
    const body = {
      email_address: email,
      status_if_new: "subscribed",
      merge_fields: {
        ...(firstName ? { FNAME: firstName } : {}),
        ...(lastName ? { LNAME: lastName } : {}),
        ...(phone ? { PHONE: phone } : {}),
      }
    };

    try {
      const res = await fetch(`${baseUrl}/lists/${audienceId}/members/${subscriberHash}`, {
        method: "PUT",
        headers,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const retriable = res.status >= 500 || res.status === 429;
        const text = await res.text();
        return { 
          status: "failed", 
          retriable, 
          detail: `Mailchimp upsert failed: ${res.status} ${text}` 
        };
      }

      // 2. Tag member
      const campaignName = event.payload.campaign_name;
      const tagsBody = {
        tags: [
          { name: "asmos", status: "active" },
          ...(campaignName ? [{ name: `campaign:${campaignName}`, status: "active" }] : []),
        ]
      };

      const tagRes = await fetch(`${baseUrl}/lists/${audienceId}/members/${subscriberHash}/tags`, {
        method: "POST",
        headers,
        body: JSON.stringify(tagsBody),
      });

      if (!tagRes.ok) {
        const retriable = tagRes.status >= 500 || tagRes.status === 429;
        const text = await tagRes.text();
        return { 
          status: "failed", 
          retriable, 
          detail: `Mailchimp tagging failed: ${tagRes.status} ${text}` 
        };
      }

      return { status: "success" };

    } catch (e: any) {
      return { status: "failed", retriable: true, detail: `Network error: ${e.message}` };
    }
  },

  async validate({ secrets, config }): Promise<{ ok: boolean; error?: string }> {
    if (!secrets.apiKey || !config.audienceId) return { ok: false };
    
    const dc = getDataCenter(secrets.apiKey);
    if (!dc) return { ok: false };

    try {
      const res = await fetch(`https://${dc}.api.mailchimp.com/3.0/lists/${config.audienceId}`, {
        method: "GET",
        headers: {
          "Authorization": `Basic ${Buffer.from(`any:${secrets.apiKey}`).toString("base64")}`,
          "Accept": "application/json",
        },
      });
      return { ok: res.ok };
    } catch {
      return { ok: false };
    }
  }
};
