import { describe, it, expect } from "vitest";
import { computeProviderStatus } from "./providerStatus";

describe("computeProviderStatus", () => {
  describe("Sync Providers (e.g. Mailchimp, Klaviyo)", () => {
    const mailchimpMeta = {
      id: "mailchimp",
      type: "sync",
      authMode: "oauth",
      configFields: [{ key: "audienceId", label: "Audience ID" }],
    };

    it("returns 'key_required' when OAuth is authorized but audienceId is missing", () => {
      const res = computeProviderStatus({
        meta: mailchimpMeta,
        syncConns: [
          {
            provider: "mailchimp",
            connected: true,
            maskedKey: "••••••••",
            authType: "oauth",
            config: {},
            subscribedEvents: ["lead.captured"],
          },
        ],
        webhookConns: [],
        messagingViews: [],
        customWebhookView: null,
      });

      expect(res.status).toBe("key_required");
    });

    it("returns 'connected' when OAuth is authorized AND audienceId is configured", () => {
      const res = computeProviderStatus({
        meta: mailchimpMeta,
        syncConns: [
          {
            provider: "mailchimp",
            connected: true,
            maskedKey: "••••••••",
            authType: "oauth",
            config: { audienceId: "abc1234" },
            subscribedEvents: ["lead.captured"],
          },
        ],
        webhookConns: [],
        messagingViews: [],
        customWebhookView: null,
      });

      expect(res.status).toBe("connected");
    });

    it("returns 'reconnect' when OAuth is required but connection uses legacy apiKey", () => {
      const res = computeProviderStatus({
        meta: mailchimpMeta,
        syncConns: [
          {
            provider: "mailchimp",
            connected: true,
            maskedKey: "••••••••",
            authType: "apiKey",
            config: { audienceId: "abc1234" },
            subscribedEvents: ["lead.captured"],
          },
        ],
        webhookConns: [],
        messagingViews: [],
        customWebhookView: null,
      });

      expect(res.status).toBe("reconnect");
    });

    const klaviyoMeta = {
      id: "klaviyo",
      type: "sync",
      authMode: "apiKey",
      configFields: [{ key: "listId", label: "List ID" }],
    };

    it("returns 'key_required' when API key is set but listId is missing", () => {
      const res = computeProviderStatus({
        meta: klaviyoMeta,
        syncConns: [
          {
            provider: "klaviyo",
            connected: true,
            maskedKey: "pk_••••1234",
            authType: "apiKey",
            config: {},
            subscribedEvents: ["lead.captured"],
          },
        ],
        webhookConns: [],
        messagingViews: [],
        customWebhookView: null,
      });

      expect(res.status).toBe("key_required");
    });

    it("returns 'key_required' when listId is entered but API key is missing", () => {
      const res = computeProviderStatus({
        meta: klaviyoMeta,
        syncConns: [
          {
            provider: "klaviyo",
            connected: false,
            maskedKey: null,
            authType: null,
            config: { listId: "ListXYZ" },
            subscribedEvents: [],
          },
        ],
        webhookConns: [],
        messagingViews: [],
        customWebhookView: null,
      });

      expect(res.status).toBe("key_required");
    });

    it("returns 'connected' when both API key and listId are configured", () => {
      const res = computeProviderStatus({
        meta: klaviyoMeta,
        syncConns: [
          {
            provider: "klaviyo",
            connected: true,
            maskedKey: "pk_••••1234",
            authType: "apiKey",
            config: { listId: "ListXYZ" },
            subscribedEvents: ["lead.captured"],
          },
        ],
        webhookConns: [],
        messagingViews: [],
        customWebhookView: null,
      });

      expect(res.status).toBe("connected");
    });

    it("returns 'disconnected' when completely unconfigured", () => {
      const res = computeProviderStatus({
        meta: klaviyoMeta,
        syncConns: [],
        webhookConns: [],
        messagingViews: [],
        customWebhookView: null,
      });

      expect(res.status).toBe("disconnected");
    });
  });

  describe("Messaging Providers (Twilio, Mailgun)", () => {
    const twilioMeta = {
      id: "twilio",
      type: "messaging",
      requiresRestrictedKey: true,
      configFields: [
        { key: "fromNumber", label: "From Phone Number" },
        { key: "accountSid", label: "Account SID" },
        { key: "apiKeySid", label: "Restricted API Key SID" },
        { key: "apiKeySecret", label: "Restricted API Key Secret", isSecret: true },
      ],
    };

    it("returns 'reconnect' when Twilio connection uses legacy authToken", () => {
      const res = computeProviderStatus({
        meta: twilioMeta,
        syncConns: [],
        webhookConns: [],
        messagingViews: [
          {
            provider: "twilio",
            connected: true,
            authType: "authToken",
            maskedKey: "••••••••",
            config: { fromNumber: "+15551234567", accountSid: "AC123" },
            rules: [],
          },
        ],
        customWebhookView: null,
      });

      expect(res.status).toBe("reconnect");
    });

    it("returns 'key_required' when Twilio has config entered but is not connected", () => {
      const res = computeProviderStatus({
        meta: twilioMeta,
        syncConns: [],
        webhookConns: [],
        messagingViews: [
          {
            provider: "twilio",
            connected: false,
            authType: null,
            maskedKey: null,
            config: { fromNumber: "+15551234567" },
            rules: [],
          },
        ],
        customWebhookView: null,
      });

      expect(res.status).toBe("key_required");
    });

    it("returns 'connected' when Twilio is fully configured with restrictedApiKey", () => {
      const res = computeProviderStatus({
        meta: twilioMeta,
        syncConns: [],
        webhookConns: [],
        messagingViews: [
          {
            provider: "twilio",
            connected: true,
            authType: "restrictedApiKey",
            maskedKey: "••••••••",
            config: { fromNumber: "+15551234567", accountSid: "AC123", apiKeySid: "SK123" },
            rules: [{ event: "lead.captured" }],
          },
        ],
        customWebhookView: null,
      });

      expect(res.status).toBe("connected");
    });
  });

  describe("Webhook Providers & Custom Webhooks", () => {
    const zapierMeta = {
      id: "zapier",
      type: "webhook",
      supportsSigning: true,
    };

    it("returns 'connected' when webhook has URL", () => {
      const res = computeProviderStatus({
        meta: zapierMeta,
        syncConns: [],
        webhookConns: [
          {
            provider: "zapier",
            connected: true,
            url: "https://hooks.zapier.com/catch/123",
            maskedSecret: null,
            subscribedEvents: ["lead.captured"],
          },
        ],
        messagingViews: [],
        customWebhookView: null,
      });

      expect(res.status).toBe("connected");
    });

    it("returns 'key_required' when webhook has secret only and no URL", () => {
      const res = computeProviderStatus({
        meta: zapierMeta,
        syncConns: [],
        webhookConns: [
          {
            provider: "zapier",
            connected: false,
            url: null,
            maskedSecret: "••••1234",
            subscribedEvents: [],
          },
        ],
        messagingViews: [],
        customWebhookView: null,
      });

      expect(res.status).toBe("key_required");
    });

    const customWebhookMeta = {
      id: "webhooks",
      type: "custom-webhook",
    };

    it("returns 'connected' when custom webhook has URL and is enabled", () => {
      const res = computeProviderStatus({
        meta: customWebhookMeta,
        syncConns: [],
        webhookConns: [],
        messagingViews: [],
        customWebhookView: {
          webhookUrl: "https://api.example.com/webhook",
          webhookSecret: "sec123",
          webhookEnabled: true,
          subscribedEvents: ["lead.captured"],
        },
      });

      expect(res.status).toBe("connected");
    });

    it("returns 'key_required' when custom webhook has URL but is disabled", () => {
      const res = computeProviderStatus({
        meta: customWebhookMeta,
        syncConns: [],
        webhookConns: [],
        messagingViews: [],
        customWebhookView: {
          webhookUrl: "https://api.example.com/webhook",
          webhookSecret: null,
          webhookEnabled: false,
          subscribedEvents: [],
        },
      });

      expect(res.status).toBe("key_required");
    });

    it("returns 'key_required' when custom webhook has secret but no URL", () => {
      const res = computeProviderStatus({
        meta: customWebhookMeta,
        syncConns: [],
        webhookConns: [],
        messagingViews: [],
        customWebhookView: {
          webhookUrl: null,
          webhookSecret: "sec123",
          webhookEnabled: false,
          subscribedEvents: [],
        },
      });

      expect(res.status).toBe("key_required");
    });
  });

  describe("Shopify Store Platform", () => {
    const shopifyMeta = {
      id: "shopify",
      type: "shopify",
    };

    it("returns 'connected' when Shopify store is connected", () => {
      const res = computeProviderStatus({
        meta: shopifyMeta,
        syncConns: [],
        webhookConns: [],
        messagingViews: [],
        customWebhookView: null,
        shopifyConn: {
          connected: true,
          shop: {
            shopDomain: "my-store.myshopify.com",
            installedAt: "2026-01-01T00:00:00.000Z",
            linkedAt: null,
          },
        },
      });

      expect(res.status).toBe("connected");
      expect(res.activeEventsCount).toBe(1);
      expect(res.conn).toEqual({
        shopDomain: "my-store.myshopify.com",
        installedAt: "2026-01-01T00:00:00.000Z",
        linkedAt: null,
      });
    });

    it("returns 'disconnected' when Shopify store is not connected", () => {
      const res = computeProviderStatus({
        meta: shopifyMeta,
        syncConns: [],
        webhookConns: [],
        messagingViews: [],
        customWebhookView: null,
        shopifyConn: {
          connected: false,
          shop: null,
        },
      });

      expect(res.status).toBe("disconnected");
      expect(res.activeEventsCount).toBe(0);
      expect(res.conn).toBeNull();
    });
  });
});
