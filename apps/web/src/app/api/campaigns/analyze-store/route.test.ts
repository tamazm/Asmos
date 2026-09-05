import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  analyzeStoreForCampaign: vi.fn(),
}));

vi.mock("@/lib/auth-adapter", () => ({ auth: mocks.auth }));
vi.mock("@/app/api/analyze/route", () => ({
  analyzeStoreForCampaign: mocks.analyzeStoreForCampaign,
}));

import { POST } from "./route";

function request(body: unknown) {
  return new Request("https://app.asmos.io/api/campaigns/analyze-store", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/campaigns/analyze-store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ userId: "user_1" });
    mocks.analyzeStoreForCampaign.mockResolvedValue({
      analysisMode: "campaign",
      storeName: "Acme",
    });
  });

  it("rejects unauthenticated requests", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    const response = await POST(request({ url: "https://acme.test" }));

    expect(response.status).toBe(401);
    expect(mocks.analyzeStoreForCampaign).not.toHaveBeenCalled();
  });

  it("validates the store URL", async () => {
    const response = await POST(request({}));

    expect(response.status).toBe(400);
    expect(mocks.analyzeStoreForCampaign).not.toHaveBeenCalled();
  });

  it("runs the protected campaign analysis preset", async () => {
    const response = await POST(request({ url: "https://acme.test" }));

    expect(response.status).toBe(200);
    expect(mocks.analyzeStoreForCampaign).toHaveBeenCalledWith("https://acme.test");
    expect(await response.json()).toMatchObject({ analysisMode: "campaign", storeName: "Acme" });
    expect(response.headers.get("X-Asmos-Campaign-Analysis-Ms")).toBeTruthy();
  });
});
