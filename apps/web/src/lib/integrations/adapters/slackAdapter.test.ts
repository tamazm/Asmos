import { describe, it, expect, vi, afterEach } from "vitest";
import { slackAdapter } from "./slackAdapter";
import type { ResolvedConnection, IntegrationEvent } from "../types";

const event: IntegrationEvent = {
  event: "lead.captured",
  payload: {
    campaign_id: "c1", campaign_name: "Summer", variant_id: "v1", variant_name: "B",
    lead: { email: "j@x.com", name: "Jane", phone: null, consent_given: true, captured_at: "2026-08-29T00:00:00.000Z" },
    reward: { label: "10% off", type: "COUPON", coupon_code: "SAVE10" },
  },
};
const connection: ResolvedConnection = {
  id: "c", accountId: "a", provider: "slack", enabled: true,
  config: { url: "https://hooks.slack.com/services/XXX" }, subscribedEvents: ["lead.captured"], secrets: {},
};

describe("slackAdapter", () => {
  afterEach(() => vi.restoreAllMocks());

  it("posts a Slack text message summarizing the event", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok", { status: 200 }));
    const res = await slackAdapter.deliver({ event, connection });
    expect(res.status).toBe("success");
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(typeof body.text).toBe("string");
    expect(body.text).toContain("New lead captured");
    expect(body.text).toContain("j@x.com");
    expect(body.text).toContain("SAVE10");
  });

  it("validate requires https", async () => {
    expect((await slackAdapter.validate({ config: { url: "http://x" }, secrets: {} })).ok).toBe(false);
  });
});
