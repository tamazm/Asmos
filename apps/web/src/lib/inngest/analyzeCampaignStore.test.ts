import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  analyzeStoreForCampaign: vi.fn(),
  campaignUpdate: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/app/api/analyze/route", () => ({ analyzeStoreForCampaign: mocks.analyzeStoreForCampaign }));
vi.mock("@/lib/prisma", () => ({
  prisma: { campaign: { update: mocks.campaignUpdate } },
}));

import { analyzeCampaignStore } from "./analyzeCampaignStore";

describe("analyzeCampaignStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.campaignUpdate.mockResolvedValue({ id: "camp_1" });
    mocks.analyzeStoreForCampaign.mockResolvedValue({
      storeName: "Acme",
      analysisSource: "bedrock",
      screenshotBase64: "large-temporary-image",
      brandTokens: { palette: ["#112233"] },
      storeProfile: { productImages: ["https://acme.test/product.jpg"] },
    });
  });

  it("runs full analysis in a durable step and persists generation-ready context", async () => {
    const step = {
      run: vi.fn(async (_id: string, callback: () => Promise<unknown>) => callback()),
    };
    const context = {
      storeUrl: "https://acme.test",
      analysisPending: true,
      autoName: true,
      goal: "BOTH",
    };

    const result = await analyzeCampaignStore(step, "camp_1", context);

    expect(step.run).toHaveBeenCalledWith("analyze-store", expect.any(Function));
    expect(mocks.analyzeStoreForCampaign).toHaveBeenCalledWith("https://acme.test");
    expect(mocks.campaignUpdate).toHaveBeenNthCalledWith(1, {
      where: { id: "camp_1" },
      data: { generationStage: "ANALYZING" },
    });
    expect(result).toMatchObject({
      storeName: "Acme",
      brandTokens: { palette: ["#112233"] },
      storeProfile: { productImages: ["https://acme.test/product.jpg"] },
      storeUrl: "https://acme.test",
      analysisPending: false,
      goal: "BOTH",
    });
    expect(result).not.toHaveProperty("screenshotBase64");
    expect(mocks.campaignUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: "camp_1" },
      data: {
        generationContext: result,
        name: "Acme: Email Capture",
      },
    });
  });

  it("does not repeat analysis for existing or already-enriched campaigns", async () => {
    const step = { run: vi.fn() };
    const context = { storeUrl: "https://acme.test", analysisPending: false };

    await expect(analyzeCampaignStore(step, "camp_1", context)).resolves.toBe(context);

    expect(step.run).not.toHaveBeenCalled();
    expect(mocks.analyzeStoreForCampaign).not.toHaveBeenCalled();
    expect(mocks.campaignUpdate).not.toHaveBeenCalled();
  });
});
