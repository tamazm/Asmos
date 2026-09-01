import type { IntegrationAdapter, DeliverContext, DeliveryResult } from "../types";

export const twilioAdapter: IntegrationAdapter = {
  provider: "twilio",
  kind: "messaging",

  async validate({ config, secrets }) {
    const accountSid = (config.accountSid as string | undefined) || secrets.accountSid;
    const apiKeySid = (config.apiKeySid as string | undefined) || secrets.apiKeySid;
    const apiKeySecret = secrets.apiKeySecret;

    // Existing connections may still use an Auth Token. Keep them deliverable
    // during migration; new submissions are rejected by the connection manager.
    if (!apiKeySid && !apiKeySecret && accountSid && secrets.authToken) {
      return { ok: true };
    }

    if (!accountSid || !apiKeySid || !apiKeySecret) {
      return { ok: false, error: "Missing Account SID or Restricted API Key" };
    }

    if (!accountSid.startsWith("AC") || !apiKeySid.startsWith("SK")) {
      return { ok: false, error: "Use a Twilio Account SID and Restricted API Key SID" };
    }

    // Restricted keys should not need account-level read permission just to
    // validate a messaging connection. The first message send verifies the
    // key's allowed action against Twilio's Messages endpoint.
    return { ok: true };
  },

  async deliver({ connection, renderedContent }: DeliverContext): Promise<DeliveryResult> {
    if (!renderedContent) {
      return { status: "failed", detail: "Missing rendered content", retriable: false };
    }

    const accountSid = (connection.config.accountSid as string | undefined) || connection.secrets.accountSid;
    const apiKeySid = (connection.config.apiKeySid as string | undefined) || connection.secrets.apiKeySid;
    const apiKeySecret = connection.secrets.apiKeySecret || connection.secrets.authToken;
    const fromNumber = connection.config.fromNumber as string;

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    const params = new URLSearchParams();
    params.append("From", fromNumber);
    params.append("To", renderedContent.to);
    params.append("Body", renderedContent.body);

    const auth = Buffer.from(`${apiKeySid || accountSid}:${apiKeySecret}`).toString("base64");

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      if (res.status === 201) {
        return { status: "success" };
      }
      
      const resData = await res.json().catch(() => ({}));
      
      if (res.status === 401) {
        return { status: "failed", detail: "Twilio: 401 Unauthorized", retriable: false };
      }
      if (res.status === 400) {
        return { status: "failed", detail: resData.message || "Twilio: 400 Bad Request", retriable: false };
      }
      if (res.status === 429 || res.status >= 500) {
        return { status: "failed", detail: `Twilio: ${res.status}`, retriable: true };
      }
      return { status: "failed", detail: `Twilio: ${res.status}`, retriable: false };
    } catch (err: any) {
      return { status: "failed", detail: err.message, retriable: true };
    }
  },
};
