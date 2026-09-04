import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth-adapter", () => ({
  auth: vi.fn().mockResolvedValue({ userId: "user_1" }),
}));

vi.mock("@/lib/account", () => ({
  getOrCreateAccount: vi.fn().mockResolvedValue({ id: "acc_1" }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    campaign: {
      findFirst: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
    campaignEvent: {
      count: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { DELETE, MEANINGFUL_IMPRESSION_THRESHOLD } from "./route";

describe("DELETE /api/campaigns/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports MEANINGFUL_IMPRESSION_THRESHOLD as 50", () => {
    expect(MEANINGFUL_IMPRESSION_THRESHOLD).toBe(50);
  });

  it("hard-deletes when campaign has 0 impressions", async () => {
    vi.mocked(prisma.campaign.findFirst).mockResolvedValue({ id: "camp_1" } as any);
    vi.mocked(prisma.campaignEvent.count).mockResolvedValue(0);
    vi.mocked(prisma.campaign.delete).mockResolvedValue({ id: "camp_1" } as any);

    const req = new Request("http://localhost/api/campaigns/camp_1", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "camp_1" }) } as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, mode: "deleted" });
    expect(prisma.campaign.delete).toHaveBeenCalledWith({ where: { id: "camp_1" } });
    expect(prisma.campaign.update).not.toHaveBeenCalled();
  });

  it("hard-deletes when campaign has low impressions (e.g. 49 impressions)", async () => {
    vi.mocked(prisma.campaign.findFirst).mockResolvedValue({ id: "camp_2" } as any);
    vi.mocked(prisma.campaignEvent.count).mockResolvedValue(49);
    vi.mocked(prisma.campaign.delete).mockResolvedValue({ id: "camp_2" } as any);

    const req = new Request("http://localhost/api/campaigns/camp_2", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "camp_2" }) } as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, mode: "deleted" });
    expect(prisma.campaign.delete).toHaveBeenCalledWith({ where: { id: "camp_2" } });
    expect(prisma.campaign.update).not.toHaveBeenCalled();
  });

  it("archives when campaign has at least 50 impressions (boundary check: 50)", async () => {
    vi.mocked(prisma.campaign.findFirst).mockResolvedValue({ id: "camp_3" } as any);
    vi.mocked(prisma.campaignEvent.count).mockResolvedValue(50);
    vi.mocked(prisma.campaign.update).mockResolvedValue({ id: "camp_3", status: "ARCHIVED" } as any);

    const req = new Request("http://localhost/api/campaigns/camp_3", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "camp_3" }) } as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, mode: "archived" });
    expect(prisma.campaign.update).toHaveBeenCalledWith({
      where: { id: "camp_3" },
      data: { status: "ARCHIVED" },
    });
    expect(prisma.campaign.delete).not.toHaveBeenCalled();
  });

  it("archives when campaign has high impressions (e.g. 500 impressions)", async () => {
    vi.mocked(prisma.campaign.findFirst).mockResolvedValue({ id: "camp_4" } as any);
    vi.mocked(prisma.campaignEvent.count).mockResolvedValue(500);
    vi.mocked(prisma.campaign.update).mockResolvedValue({ id: "camp_4", status: "ARCHIVED" } as any);

    const req = new Request("http://localhost/api/campaigns/camp_4", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "camp_4" }) } as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, mode: "archived" });
    expect(prisma.campaign.update).toHaveBeenCalledWith({
      where: { id: "camp_4" },
      data: { status: "ARCHIVED" },
    });
    expect(prisma.campaign.delete).not.toHaveBeenCalled();
  });
});
