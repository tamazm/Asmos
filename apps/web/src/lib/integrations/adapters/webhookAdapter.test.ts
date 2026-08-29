import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { webhookAdapter } from "./webhookAdapter";
import type { ResolvedConnection, IntegrationEvent } from "../types";

const conn: ResolvedConnection = {
  id: "c1", accountId: "a1", provider: "webhooks", enabled: true,
  config: { url: "https://example.com/hook" },
  subscribedEvents: ["lead.captured"],
  secrets: { signingSecret: "shh" },
};

const event: IntegrationEvent = {
  event: "lead.captured",
  payload: {
    campaign_id: "camp1", campaign_name: "Summer", variant_id: "v1", variant_name: "A",
    lead: { email: "j@x.com", name: "J", phone: null, consent_given: true, captured_at: "2026-08-29T00:00:00.000Z" },
    reward: null,
  },
};

describe("webhookAdapter", () => {
  beforeEach(() => { vi.restoreAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("POSTs a signed payload and returns success on 2xx", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
    const res = await webhookAdapter.deliver({ event, connection: conn });

    expect(res.status).toBe("success");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://example.com/hook");
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["X-Asmos-Event"]).toBe("lead.captured");
    expect(headers["X-Asmos-Signature"]).toMatch(/^sha256=[0-9a-f]{64}$/);
  });

  it("omits the signature header when no secret is set", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
    const res = await webhookAdapter.deliver({ event, connection: { ...conn, secrets: {} } });
    expect(res.status).toBe("success");
  });

  it("returns retriable failure on 500", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 500 }));
    const res = await webhookAdapter.deliver({ event, connection: conn });
    expect(res.status).toBe("failed");
    expect(res.retriable).toBe(true);
  });

  it("returns non-retriable failure on 400", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 400 }));
    const res = await webhookAdapter.deliver({ event, connection: conn });
    expect(res.status).toBe("failed");
    expect(res.retriable).toBe(false);
  });

  it("returns retriable failure on network error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNRESET"));
    const res = await webhookAdapter.deliver({ event, connection: conn });
    expect(res.status).toBe("failed");
    expect(res.retriable).toBe(true);
  });

  it("validate rejects a non-https url", async () => {
    const res = await webhookAdapter.validate({ config: { url: "http://x.com" }, secrets: {} });
    expect(res.ok).toBe(false);
  });

  it("validate accepts an https url", async () => {
    const res = await webhookAdapter.validate({ config: { url: "https://x.com/h" }, secrets: {} });
    expect(res.ok).toBe(true);
  });
});
