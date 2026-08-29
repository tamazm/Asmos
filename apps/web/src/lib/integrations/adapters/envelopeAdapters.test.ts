import { describe, it, expect, vi, afterEach } from "vitest";
import { zapierAdapter, makeAdapter, n8nAdapter } from "./envelopeAdapters";
import type { ResolvedConnection, IntegrationEvent } from "../types";

const event: IntegrationEvent = {
  event: "lead.captured",
  payload: {
    campaign_id: "c1", campaign_name: "S", variant_id: "v1", variant_name: "B",
    lead: { email: "j@x.com", name: null, phone: null, consent_given: true, captured_at: "2026-08-29T00:00:00.000Z" },
    reward: null,
  },
};
function conn(provider: ResolvedConnection["provider"]): ResolvedConnection {
  return { id: "c", accountId: "a", provider, enabled: true, config: { url: "https://hooks.x.com/abc" }, subscribedEvents: ["lead.captured"], secrets: {} };
}

describe("envelope adapters", () => {
  afterEach(() => vi.restoreAllMocks());

  it("each adapter carries its own provider id and webhook kind", () => {
    expect([zapierAdapter.provider, makeAdapter.provider, n8nAdapter.provider]).toEqual(["zapier", "make", "n8n"]);
    expect([zapierAdapter.kind, makeAdapter.kind, n8nAdapter.kind]).toEqual(["webhook", "webhook", "webhook"]);
  });

  it("POSTs the raw event envelope to the configured url", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
    const res = await zapierAdapter.deliver({ event, connection: conn("zapier") });
    expect(res.status).toBe("success");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://hooks.x.com/abc");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual(event);
  });

  it("validate rejects non-https", async () => {
    expect((await makeAdapter.validate({ config: { url: "http://x" }, secrets: {} })).ok).toBe(false);
    expect((await makeAdapter.validate({ config: { url: "https://x" }, secrets: {} })).ok).toBe(true);
  });
});
