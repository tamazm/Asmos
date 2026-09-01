import type { IntegrationAdapter, DeliverContext, DeliveryResult } from "../types";

export const mailgunAdapter: IntegrationAdapter = {
  provider: "mailgun",
  kind: "messaging",
  
  async validate({ config, secrets }) {
    const domain = config.domain as string | undefined;
    const region = config.region as string | undefined;
    const apiKey = secrets.apiKey;

    if (!domain || !apiKey) {
      return { ok: false, error: "Missing domain or API key" };
    }

    const baseUrl = region === "eu" ? "https://api.eu.mailgun.net" : "https://api.mailgun.net";
    const url = `${baseUrl}/v3/domains/${domain}`;

    try {
      const auth = Buffer.from(`api:${apiKey}`).toString("base64");
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
        return { ok: false, error: "Invalid API key" };
      }
      if (res.status === 404) {
        return { ok: false, error: "Domain not found" };
      }
      return { ok: false, error: `Unexpected status ${res.status}` };
    } catch (err: any) {
      return { ok: false, error: err.message || "Failed to connect to Mailgun" };
    }
  },

  async deliver({ connection, renderedContent }: DeliverContext): Promise<DeliveryResult> {
    if (!renderedContent) {
      return { status: "failed", detail: "Missing rendered content", retriable: false };
    }

    const domain = connection.config.domain as string;
    const fromAddress = connection.config.fromAddress as string;
    const region = connection.config.region as string;
    const apiKey = connection.secrets.apiKey;

    const baseUrl = region === "eu" ? "https://api.eu.mailgun.net" : "https://api.mailgun.net";
    const url = `${baseUrl}/v3/${domain}/messages`;

    const formData = new FormData();
    formData.append("from", fromAddress);
    formData.append("to", renderedContent.to);
    formData.append("subject", renderedContent.subject || "No Subject");
    formData.append("html", renderedContent.body);

    const auth = Buffer.from(`api:${apiKey}`).toString("base64");

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
        },
        body: formData,
      });

      if (res.status === 200) {
        return { status: "success" };
      }
      if (res.status === 401) {
        return { status: "failed", detail: "Mailgun: 401 Unauthorized", retriable: false };
      }
      if (res.status === 429 || res.status >= 500) {
        return { status: "failed", detail: `Mailgun: ${res.status}`, retriable: true };
      }
      return { status: "failed", detail: `Mailgun: ${res.status}`, retriable: false };
    } catch (err: any) {
      return { status: "failed", detail: err.message, retriable: true };
    }
  },
};
