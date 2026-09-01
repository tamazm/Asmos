import type { IntegrationAdapter, DeliverContext, DeliveryResult } from "../types";

export const twilioAdapter: IntegrationAdapter = {
  provider: "twilio",
  kind: "messaging",

  async validate({ config, secrets }) {
    const accountSid = secrets.accountSid;
    const authToken = secrets.authToken;

    if (!accountSid || !authToken) {
      return { ok: false, error: "Missing Account SID or Auth Token" };
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`;

    try {
      const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Basic ${auth}`,
        },
      });

      if (res.status === 200) {
        return { ok: true };
      }
      if (res.status === 401) {
        return { ok: false, error: "Invalid credentials" };
      }
      return { ok: false, error: `Unexpected status ${res.status}` };
    } catch (err: any) {
      return { ok: false, error: err.message || "Failed to connect to Twilio" };
    }
  },

  async deliver({ connection, renderedContent }: DeliverContext): Promise<DeliveryResult> {
    if (!renderedContent) {
      return { status: "failed", detail: "Missing rendered content", retriable: false };
    }

    const accountSid = connection.secrets.accountSid;
    const authToken = connection.secrets.authToken;
    const fromNumber = connection.config.fromNumber as string;

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    const params = new URLSearchParams();
    params.append("From", fromNumber);
    params.append("To", renderedContent.to);
    params.append("Body", renderedContent.body);

    const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

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
