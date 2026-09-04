import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildAnalyzeLeadDiscordPayload,
  sendAnalyzeLeadToDiscord,
  type AnalyzeLeadDiscordInput,
} from "./analyzeLeadDiscord";

const lead: AnalyzeLeadDiscordInput = {
  leadId: "lead_1",
  email: "shopper@example.com",
  storeUrl: "https://shop.example",
  storeName: "Example *Shop*",
  industry: "Apparel",
  score: 72,
  grade: "B-",
  gradeLabel: "Good",
  topIssue: "No email capture @everyone",
  topFindings: [{ label: "Popup", headline: "No popup detected" }],
  origin: "https://asmos.io",
  capturedAt: "2026-09-05T00:00:00.000Z",
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("analyze lead Discord notification", () => {
  it("builds a structured embed and disables mentions", () => {
    const payload = buildAnalyzeLeadDiscordPayload(lead);

    expect(payload.allowed_mentions).toEqual({ parse: [] });
    expect(payload.embeds[0]).toMatchObject({
      title: "📈 New Asmos Analyze Lead",
      url: "https://shop.example/",
      color: 0x6366f1,
      timestamp: "2026-09-05T00:00:00.000Z",
    });
    expect(payload.embeds[0].fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Contact" }),
        expect.objectContaining({ name: "Analysis" }),
        expect.objectContaining({ name: "Store" }),
        expect.objectContaining({ name: "Top findings" }),
      ]),
    );
  });

  it("posts the embed to the configured server-side webhook", async () => {
    vi.stubEnv(
      "ANALYZE_LEAD_DISCORD_WEBHOOK_URL",
      "https://discord.com/api/webhooks/test-id/test-token",
    );
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendAnalyzeLeadToDiscord(lead)).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://discord.com/api/webhooks/test-id/test-token",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: expect.any(String),
      }),
    );
  });

  it("uses the temporary hardcoded fallback when the environment override is absent", async () => {
    vi.stubEnv("ANALYZE_LEAD_DISCORD_WEBHOOK_URL", "");
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendAnalyzeLeadToDiscord(lead)).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toMatch(/^https:\/\/discord\.com\/api\/webhooks\//);
  });
});
