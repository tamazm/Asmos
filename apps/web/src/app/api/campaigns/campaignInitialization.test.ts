import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  afterCallbacks: [] as Array<() => void | Promise<void>>,
  auth: vi.fn(),
  getOrCreateAccount: vi.fn(),
  websiteCreate: vi.fn(),
  campaignCreate: vi.fn(),
  campaignUpdate: vi.fn(),
  inngestSend: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("next/server", () => ({
  after: vi.fn((callback: () => void | Promise<void>) => {
    mocks.afterCallbacks.push(callback);
  }),
}));

vi.mock("@/lib/auth-adapter", () => ({ auth: mocks.auth }));
vi.mock("@/lib/account", () => ({ getOrCreateAccount: mocks.getOrCreateAccount }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    website: { create: mocks.websiteCreate },
    campaign: {
      create: mocks.campaignCreate,
      update: mocks.campaignUpdate,
      findMany: vi.fn(),
    },
  },
}));
vi.mock("@/lib/inngest/client", () => ({
  inngest: { send: mocks.inngestSend },
}));
vi.mock("@/lib/templates", () => ({ renderPopupTemplate: vi.fn() }));
vi.mock("@/lib/templates/runtime", () => ({
  sanitizeCaptureFields: vi.fn((fields: unknown) => fields),
}));
vi.mock("@/lib/integrations/emit", () => ({ emitIntegrationEvent: vi.fn() }));

import { POST } from "./route";

const campaignRequestBody = {
  name: "Fast campaign",
  type: "FORM",
  design: {
    headline: "Save 10%",
    body: "Join the list",
    primaryColor: "#111827",
    ctaText: "Get offer",
  },
  formFields: ["email"],
  targeting: { trigger: "exit_intent", delaySeconds: null },
  rewards: [],
  status: "GENERATING",
  generationContext: { storeUrl: "https://shop.example/path" },
};

describe("POST /api/campaigns initialization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.afterCallbacks.length = 0;
    mocks.auth.mockResolvedValue({ userId: "user_1" });
    mocks.getOrCreateAccount.mockResolvedValue({
      id: "acc_1",
      planTier: "FREE",
      aiGenerationsCount: 0,
      websites: [{ id: "web_1", accountId: "acc_1", url: "shop.example" }],
    });
    mocks.campaignCreate.mockResolvedValue({
      id: "camp_1",
      name: "Fast campaign",
      status: "GENERATING",
      variants: [],
    });
    mocks.campaignUpdate.mockResolvedValue({ id: "camp_1", status: "FAILED" });
    mocks.inngestSend.mockResolvedValue(undefined);
  });

  it("returns after the durable row exists without waiting for queue delivery", async () => {
    const request = new Request("http://localhost/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(campaignRequestBody),
    });

    const response = await POST(request);

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({
      campaign: expect.objectContaining({ id: "camp_1", status: "GENERATING" }),
    });
    expect(mocks.getOrCreateAccount).toHaveBeenCalledWith("user_1");
    expect(mocks.websiteCreate).not.toHaveBeenCalled();
    expect(mocks.campaignCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ websiteId: "web_1", generationStage: "QUEUED" }),
      }),
    );
    expect(mocks.inngestSend).not.toHaveBeenCalled();
    expect(mocks.afterCallbacks).toHaveLength(1);
    expect(Number(response.headers.get("X-Asmos-Campaign-Init-Ms"))).toBeGreaterThanOrEqual(0);
    expect(response.headers.get("Server-Timing")).toContain("total;dur=");

    await mocks.afterCallbacks[0]();

    expect(mocks.inngestSend).toHaveBeenCalledWith({
      name: "campaign.generate",
      data: { campaignId: "camp_1", enqueuedAt: expect.any(Number) },
    });
  });

  it("marks the campaign failed if background queue delivery fails", async () => {
    mocks.inngestSend.mockRejectedValueOnce(new Error("queue unavailable"));
    const request = new Request("http://localhost/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(campaignRequestBody),
    });

    const response = await POST(request);
    expect(response.status).toBe(202);

    await mocks.afterCallbacks[0]();

    expect(mocks.campaignUpdate).toHaveBeenCalledWith({
      where: { id: "camp_1" },
      data: {
        status: "FAILED",
        lastError: "Failed to queue campaign generation. Please retry.",
      },
    });
  });
});
