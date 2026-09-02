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

function getAuth(secrets: Record<string, string>): { dataCenter: string; headers: Record<string, string> } | null {
  if (secrets.accessToken && secrets.dataCenter) {
    return {
      dataCenter: secrets.dataCenter,
      headers: {
        "Authorization": `Bearer ${secrets.accessToken}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
    };
  }

  if (secrets.apiKey) {
    const dataCenter = getDataCenter(secrets.apiKey);
    if (!dataCenter) return null;
    return {
      dataCenter,
      headers: {
        "Authorization": `Basic ${Buffer.from(`any:${secrets.apiKey}`).toString("base64")}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
    };
  }

  return null;
}

export const mailchimpAdapter: IntegrationAdapter = {
  provider: "mailchimpAdapter".replace("Adapter", "") as any,

  kind: "sync",
  async deliver({ event, connection }: { event: IntegrationEvent; connection: ResolvedConnection }): Promise<DeliveryResult> {
    if (event.event !== "lead.captured") {
      return { status: "skipped", detail: `Ignored event: ${event.event}` };
    }

    const audienceId = connection.config.audienceId;
    if (!audienceId) {
      return { status: "failed", retriable: false, detail: "Missing Mailchimp Audience ID" };
    }

    const auth = getAuth(connection.secrets);
    if (!auth) {
      return { status: "failed", retriable: false, detail: "Missing or invalid Mailchimp OAuth connection" };
    }

    const { email, name, phone } = event.payload.lead;
    const { firstName, lastName } = splitName(name);
    const subscriberHash = getSubscriberHash(email);

    const baseUrl = `https://${auth.dataCenter}.api.mailchimp.com/3.0`;

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
        headers: auth.headers,
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
        headers: auth.headers,
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
    if ((!secrets.apiKey && !secrets.accessToken) || !config.audienceId) return { ok: false };
    
    try {
      const auth = getAuth(secrets);
      if (!auth) return { ok: false, error: "Mailchimp OAuth connection is required" };

      const res = await fetch(`https://${auth.dataCenter}.api.mailchimp.com/3.0/lists/${config.audienceId}`, {
        method: "GET",
        headers: auth.headers,
      });
      return { ok: res.ok };
    } catch {
      return { ok: false };
    }
  }
};
