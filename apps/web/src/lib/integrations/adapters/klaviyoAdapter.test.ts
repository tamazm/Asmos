import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { klaviyoAdapter } from "./klaviyoAdapter";
import type { IntegrationEvent, ResolvedConnection } from "../types";

const globalFetch = global.fetch;

describe("klaviyoAdapter", () => {
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
    provider: "klaviyo",
    enabled: true,
    subscribedEvents: ["lead.captured"],
    config: { listId: "XYZ123" },
    secrets: { apiKey: "pk_123" },
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
    const res = await klaviyoAdapter.deliver({
      connection,
      event: { event: "variant.winner_declared", payload: { campaign_id: "c1", campaign_name: "c", winning_variant_id: "v", winning_variant_name: "v", declared_at: "t" } }
    });
    expect(res.status).toBe("skipped");
  });

  it("fails if API key is missing", async () => {
    const res = await klaviyoAdapter.deliver({
      connection: { ...connection, secrets: {} },
      event,
    });
    expect(res.status).toBe("failed");
    expect(res.retriable).toBe(false);
  });

  it("fails if listId is missing", async () => {
    const res = await klaviyoAdapter.deliver({
      connection: { ...connection, config: {} },
      event,
    });
    expect(res.status).toBe("failed");
    expect(res.retriable).toBe(false);
  });

  it("successfully upserts and tracks event", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 202 }); // bulk create
    mockFetch.mockResolvedValueOnce({ ok: true, status: 202 }); // event track

    const res = await klaviyoAdapter.deliver({ connection, event });
    
    expect(res.status).toBe("success");
    expect(mockFetch).toHaveBeenCalledTimes(2);

    const subscribeCall = mockFetch.mock.calls[0];
    expect(subscribeCall[0]).toBe("https://a.klaviyo.com/api/profile-subscription-bulk-create-jobs/");
    expect(subscribeCall[1].headers).toMatchObject({
      "Authorization": "Klaviyo-API-Key pk_123",
      "revision": "2024-10-15"
    });
    const subscribeBody = JSON.parse(subscribeCall[1].body);
    expect(subscribeBody.data.attributes.profiles.data[0].attributes).toMatchObject({
      email: "test@example.com",
      first_name: "Jane",
      last_name: "Doe",
      phone_number: "+1234567890"
    });

    const eventCall = mockFetch.mock.calls[1];
    expect(eventCall[0]).toBe("https://a.klaviyo.com/api/events/");
    const eventBody = JSON.parse(eventCall[1].body);
    expect(eventBody.data.attributes.properties).toMatchObject({
      campaign_name: "Summer Sale",
      coupon_code: "SUMMER20",
      asmos: true
    });
  });

  it("returns non-retriable on 401", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401, text: () => Promise.resolve("Unauthorized") });

    const res = await klaviyoAdapter.deliver({ connection, event });
    
    expect(res.status).toBe("failed");
    expect(res.retriable).toBe(false);
  });

  it("returns retriable on 429", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 429, text: () => Promise.resolve("Too Many Requests") });

    const res = await klaviyoAdapter.deliver({ connection, event });
    
    expect(res.status).toBe("failed");
    expect(res.retriable).toBe(true);
  });
  
  it("name splitting works as expected", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 202 });

    const eventOneName = { ...event, payload: { ...event.payload, lead: { ...event.payload.lead, name: "Jane" } } } as any;
    await klaviyoAdapter.deliver({ connection, event: eventOneName });
    const call1 = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(call1.data.attributes.profiles.data[0].attributes.first_name).toBe("Jane");
    expect(call1.data.attributes.profiles.data[0].attributes.last_name).toBeUndefined();
    
    mockFetch.mockClear();
    
    const eventNullName = { ...event, payload: { ...event.payload, lead: { ...event.payload.lead, name: null } } } as any;
    await klaviyoAdapter.deliver({ connection, event: eventNullName });
    const call2 = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(call2.data.attributes.profiles.data[0].attributes.first_name).toBeUndefined();
  });
});
