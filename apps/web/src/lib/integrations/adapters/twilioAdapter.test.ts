import { describe, it, expect, vi, beforeEach } from "vitest";
import { twilioAdapter } from "./twilioAdapter";
import type { DeliverContext } from "../types";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("twilioAdapter", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe("validate", () => {
    it("accepts a restricted API key without account-level validation", async () => {
      const res = await twilioAdapter.validate({
        config: { accountSid: "AC123", apiKeySid: "SK123" },
        secrets: { apiKeySecret: "secret123" },
      });
      expect(res.ok).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("rejects incomplete restricted API key credentials", async () => {
      const res = await twilioAdapter.validate({
        config: { accountSid: "AC123" },
        secrets: { apiKeySecret: "secret123" },
      });
      expect(res.ok).toBe(false);
      expect(res.error).toContain("Restricted API Key");
    });

    it("keeps legacy Auth Token connections working during migration", async () => {
      const res = await twilioAdapter.validate({
        config: {},
        secrets: { accountSid: "AC123", authToken: "token123" },
      });
      expect(res.ok).toBe(true);
    });
  });

  describe("deliver", () => {
    const ctx = {
      connection: {
        config: { fromNumber: "+15551234567", accountSid: "AC123", apiKeySid: "SK123" },
        secrets: { apiKeySecret: "secret123" },
      },
      renderedContent: {
        to: "+19876543210",
        body: "Hello SMS",
        subject: null,
      },
    } as unknown as DeliverContext;

    it("sends correct form-encoded body and auth", async () => {
      mockFetch.mockResolvedValueOnce({ status: 201 });
      const res = await twilioAdapter.deliver(ctx);
      expect(res.status).toBe("success");

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe("https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json");
      expect(init.headers.Authorization).toBe("Basic U0sxMjM6c2VjcmV0MTIz");
      expect(init.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
      expect(init.body).toBe("From=%2B15551234567&To=%2B19876543210&Body=Hello+SMS");
    });

    it("handles 401 non-retriable", async () => {
      mockFetch.mockResolvedValueOnce({ status: 401, json: async () => ({}) });
      const res = await twilioAdapter.deliver(ctx);
      expect(res.status).toBe("failed");
      expect(res.retriable).toBe(false);
    });

    it("handles 400 non-retriable with detail", async () => {
      mockFetch.mockResolvedValueOnce({ 
        status: 400, 
        json: async () => ({ message: "Invalid number" }) 
      });
      const res = await twilioAdapter.deliver(ctx);
      expect(res.status).toBe("failed");
      expect(res.retriable).toBe(false);
      expect(res.detail).toBe("Invalid number");
    });

    it("handles 429 retriable", async () => {
      mockFetch.mockResolvedValueOnce({ status: 429, json: async () => ({}) });
      const res = await twilioAdapter.deliver(ctx);
      expect(res.status).toBe("failed");
      expect(res.retriable).toBe(true);
    });
  });
});
