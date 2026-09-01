import { describe, it, expect, vi, beforeEach } from "vitest";
import { mailgunAdapter } from "./mailgunAdapter";
import type { DeliverContext } from "../types";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("mailgunAdapter", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe("validate", () => {
    it("returns ok for 200", async () => {
      mockFetch.mockResolvedValueOnce({ status: 200 });
      const res = await mailgunAdapter.validate({
        config: { domain: "mg.acme.com", region: "us" },
        secrets: { apiKey: "key-123" },
      });
      expect(res.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith("https://api.mailgun.net/v3/domains/mg.acme.com", expect.objectContaining({
        headers: { Authorization: "Basic YXBpOmtleS0xMjM=" }
      }));
    });

    it("uses EU region URL", async () => {
      mockFetch.mockResolvedValueOnce({ status: 200 });
      await mailgunAdapter.validate({
        config: { domain: "mg.acme.com", region: "eu" },
        secrets: { apiKey: "key-123" },
      });
      expect(mockFetch.mock.calls[0][0]).toBe("https://api.eu.mailgun.net/v3/domains/mg.acme.com");
    });

    it("returns error for 401", async () => {
      mockFetch.mockResolvedValueOnce({ status: 401 });
      const res = await mailgunAdapter.validate({
        config: { domain: "mg.acme.com", region: "us" },
        secrets: { apiKey: "key-123" },
      });
      expect(res.ok).toBe(false);
      expect(res.error).toBe("Invalid API key");
    });
  });

  describe("deliver", () => {
    const ctx = {
      connection: {
        config: { domain: "mg.acme.com", fromAddress: "noreply@mg.acme.com", region: "us" },
        secrets: { apiKey: "key-123" },
      },
      renderedContent: {
        to: "jane@example.com",
        subject: "Hello Jane",
        body: "<h1>Hi Jane</h1>",
      },
    } as unknown as DeliverContext;

    it("sends correct multipart form data and auth", async () => {
      mockFetch.mockResolvedValueOnce({ status: 200 });
      const res = await mailgunAdapter.deliver(ctx);
      expect(res.status).toBe("success");

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe("https://api.mailgun.net/v3/mg.acme.com/messages");
      expect(init.headers.Authorization).toBe("Basic YXBpOmtleS0xMjM=");
      
      const formData = init.body as FormData;
      expect(formData.get("from")).toBe("noreply@mg.acme.com");
      expect(formData.get("to")).toBe("jane@example.com");
      expect(formData.get("subject")).toBe("Hello Jane");
      expect(formData.get("html")).toBe("<h1>Hi Jane</h1>");
    });

    it("handles 401 non-retriable", async () => {
      mockFetch.mockResolvedValueOnce({ status: 401 });
      const res = await mailgunAdapter.deliver(ctx);
      expect(res.status).toBe("failed");
      expect(res.retriable).toBe(false);
    });

    it("handles 429 retriable", async () => {
      mockFetch.mockResolvedValueOnce({ status: 429 });
      const res = await mailgunAdapter.deliver(ctx);
      expect(res.status).toBe("failed");
      expect(res.retriable).toBe(true);
    });
  });
});
