import { describe, it, expect, vi, afterEach } from "vitest";
import { teamsAdapter } from "./teamsAdapter";
import type { ResolvedConnection, IntegrationEvent } from "../types";

const event: IntegrationEvent = {
  event: "lead.captured",
  payload: {
    campaign_id: "c1", campaign_name: "Summer", variant_id: "v1", variant_name: "B",
    lead: { email: "j@x.com", name: null, phone: null, consent_given: true, captured_at: "2026-08-29T00:00:00.000Z" },
    reward: null,
  },
};
const connection: ResolvedConnection = {
  id: "c", accountId: "a", provider: "teams", enabled: true,
  config: { url: "https://outlook.office.com/webhook/XXX" }, subscribedEvents: ["lead.captured"], secrets: {},
};

describe("teamsAdapter", () => {
  afterEach(() => vi.restoreAllMocks());

  it("posts a MessageCard payload", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
    const res = await teamsAdapter.deliver({ event, connection });
    expect(res.status).toBe("success");
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body["@type"]).toBe("MessageCard");
    expect(body.title).toContain("New lead captured");
    expect(typeof body.text).toBe("string");
  });
});
