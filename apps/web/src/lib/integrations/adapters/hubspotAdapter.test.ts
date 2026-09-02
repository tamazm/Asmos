import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { hubspotAdapter } from "./hubspotAdapter";
import type { IntegrationEvent, ResolvedConnection } from "../types";

const globalFetch = global.fetch;

describe("hubspotAdapter", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    global.fetch = globalFetch;
  });

  const connection = {
    id: "c1",
    accountId: "a1",
    provider: "hubspot",
    enabled: true,
    subscribedEvents: ["lead.captured"],
    config: {},
    secrets: { apiKey: "pat-123" },
  } as ResolvedConnection;

  const event = {
    event: "lead.captured",
    payload: {
      campaign_name: "Summer Sale",
      variant_name: "A", campaign_id: "c1", variant_id: "v1",
      lead: { email: "test@example.com", name: "Jane Doe", phone: "+1234567890", consent_given: true, captured_at: "2026-08-30T00:00:00Z" },
      reward: { label: "10% off", type: "discount", coupon_code: "SUMMER20" }
    }
  } as IntegrationEvent;

  it("skips non-lead.captured events", async () => {
    const res = await hubspotAdapter.deliver({
      connection,
      event: { event: "variant.winner_declared", payload: { campaign_id: "c1", campaign_name: "c", winning_variant_id: "v", winning_variant_name: "v", declared_at: "t" } }
    });
    expect(res.status).toBe("skipped");
  });

  it("fails if API key is missing", async () => {
    const res = await hubspotAdapter.deliver({
      connection: { ...connection, secrets: {} },
      event,
    });
    expect(res.status).toBe("failed");
    expect(res.retriable).toBe(false);
  });

  it("successfully upserts contact", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 }); 

    const res = await hubspotAdapter.deliver({ connection, event });
    
    expect(res.status).toBe("success");
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const call = mockFetch.mock.calls[0];
    expect(call[0]).toBe("https://api.hubapi.com/crm/v3/objects/contacts/batch/upsert");
    expect(call[1].headers).toMatchObject({
      "Authorization": "Bearer pat-123",
    });
    const body = JSON.parse(call[1].body);
    expect(body.inputs[0]).toMatchObject({
      id: "test@example.com",
      idProperty: "email",
      properties: {
        firstname: "Jane",
        lastname: "Doe",
        phone: "+1234567890",
        asmos_campaign: "Summer Sale",
        asmos_coupon: "SUMMER20"
      }
    });
  });

  it("returns non-retriable on 401", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401, text: () => Promise.resolve("Unauthorized") });

    const res = await hubspotAdapter.deliver({ connection, event });
    
    expect(res.status).toBe("failed");
    expect(res.retriable).toBe(false);
  });

  it("returns non-retriable on 403", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403, text: () => Promise.resolve("Forbidden") });

    const res = await hubspotAdapter.deliver({ connection, event });
    
    expect(res.status).toBe("failed");
    expect(res.retriable).toBe(false);
  });

  it("returns retriable on 429", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 429, text: () => Promise.resolve("Too Many Requests") });

    const res = await hubspotAdapter.deliver({ connection, event });
    
    expect(res.status).toBe("failed");
    expect(res.retriable).toBe(true);
  });
});
