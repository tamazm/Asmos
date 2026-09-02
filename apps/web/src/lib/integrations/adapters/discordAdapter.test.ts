import { describe, it, expect, vi, afterEach } from "vitest";
import { discordAdapter } from "./discordAdapter";
import type { ResolvedConnection, IntegrationEvent } from "../types";

const event: IntegrationEvent = {
  event: "variant.winner_declared",
  payload: { campaign_id: "c1", campaign_name: "Summer", winning_variant_id: "v1", winning_variant_name: "B", declared_at: "2026-08-29T00:00:00.000Z" },
};
const connection: ResolvedConnection = {
  id: "c", accountId: "a", provider: "discord", enabled: true,
  config: { url: "https://discord.com/api/webhooks/XXX/YYY" }, subscribedEvents: ["variant.winner_declared"], secrets: {},
};

describe("discordAdapter", () => {
  afterEach(() => vi.restoreAllMocks());

  it("posts a Discord content message", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
    const res = await discordAdapter.deliver({ event, connection });
    expect(res.status).toBe("success");
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(typeof body.content).toBe("string");
    expect(body.content).toContain("Winner declared");
    expect(body.content).toContain("Summer");
  });

  it("validate requires https", async () => {
    expect((await discordAdapter.validate({ config: { url: "ftp://x" }, secrets: {} })).ok).toBe(false);
  });
});
