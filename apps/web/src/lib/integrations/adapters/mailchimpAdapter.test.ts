import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mailchimpAdapter } from "./mailchimpAdapter";
import type { IntegrationEvent, ResolvedConnection } from "../types";

const globalFetch = global.fetch;

describe("mailchimpAdapter", () => {
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
    provider: "mailchimp",
    enabled: true,
    subscribedEvents: ["lead.captured"],
    config: { audienceId: "aud_123" },
    secrets: { apiKey: "test_key-us19" },
  } as ResolvedConnection;

  const event = {
    event: "lead.captured",
    payload: {
      campaign_name: "Summer Sale",
      variant_name: "A", campaign_id: "c1", variant_id: "v1",
      lead: { email: "Test@Example.com", name: "Jane Doe", phone: "+1234567890", consent_given: true, captured_at: "2026-08-30T00:00:00Z" },
      reward: null, campaign_id: "c1", variant_id: "v1"
    }
  } as IntegrationEvent;

  it("skips non-lead.captured events", async () => {
    const res = await mailchimpAdapter.deliver({
      connection,
      event: { event: "variant.winner_declared", payload: { campaign_id: "c1", campaign_name: "c", winning_variant_id: "v", winning_variant_name: "v", declared_at: "t" } }
    });
    expect(res.status).toBe("skipped");
  });

  it("fails if API key is missing", async () => {
    const res = await mailchimpAdapter.deliver({
      connection: { ...connection, secrets: {} },
      event,
    });
    expect(res.status).toBe("failed");
    expect(res.retriable).toBe(false);
  });
  
  it("fails if API key format is invalid", async () => {
    const res = await mailchimpAdapter.deliver({
      connection: { ...connection, secrets: { apiKey: "invalid_key_no_dc" } },
      event,
    });
    expect(res.status).toBe("failed");
    expect(res.retriable).toBe(false);
  });

  it("successfully upserts and tags member with lowercased MD5 email hash", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 }); // upsert
    mockFetch.mockResolvedValueOnce({ ok: true, status: 204 }); // tag

    const res = await mailchimpAdapter.deliver({ connection, event });
    
    expect(res.status).toBe("success");
    expect(mockFetch).toHaveBeenCalledTimes(2);

    const upsertCall = mockFetch.mock.calls[0];
    // MD5 of "test@example.com" is 55502f40dc8b7c769880b10874abc9d0
    expect(upsertCall[0]).toBe("https://us19.api.mailchimp.com/3.0/lists/aud_123/members/55502f40dc8b7c769880b10874abc9d0");
    const authHeader = `Basic ${Buffer.from("any:test_key-us19").toString("base64")}`;
    expect(upsertCall[1].headers).toMatchObject({
      "Authorization": authHeader,
    });
    const upsertBody = JSON.parse(upsertCall[1].body);
    expect(upsertBody).toMatchObject({
      email_address: "Test@Example.com",
      status_if_new: "subscribed",
      merge_fields: {
        FNAME: "Jane",
        LNAME: "Doe",
        PHONE: "+1234567890"
      }
    });

    const tagCall = mockFetch.mock.calls[1];
    expect(tagCall[0]).toBe("https://us19.api.mailchimp.com/3.0/lists/aud_123/members/55502f40dc8b7c769880b10874abc9d0/tags");
    const tagBody = JSON.parse(tagCall[1].body);
    expect(tagBody.tags).toEqual([
      { name: "asmos", status: "active" },
      { name: "campaign:Summer Sale", status: "active" }
    ]);
  });

  it("returns non-retriable on 401", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401, text: () => Promise.resolve("Unauthorized") });

    const res = await mailchimpAdapter.deliver({ connection, event });
    
    expect(res.status).toBe("failed");
    expect(res.retriable).toBe(false);
  });
  
  it("returns non-retriable on 400 (validation error)", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 400, text: () => Promise.resolve("Invalid Resource") });

    const res = await mailchimpAdapter.deliver({ connection, event });
    
    expect(res.status).toBe("failed");
    expect(res.retriable).toBe(false);
  });

  it("returns retriable on 500", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, text: () => Promise.resolve("Internal Error") });

    const res = await mailchimpAdapter.deliver({ connection, event });
    
    expect(res.status).toBe("failed");
    expect(res.retriable).toBe(true);
  });
});
