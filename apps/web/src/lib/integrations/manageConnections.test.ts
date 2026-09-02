import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    integrationConnection: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { isUrlProvider, listConnectionViews, saveConnection, removeConnection } from "./manageConnections";

describe("manageConnections", () => {
  beforeEach(() => vi.clearAllMocks());

  it("isUrlProvider accepts the six and rejects others", () => {
    expect(isUrlProvider("slack")).toBe(true);
    expect(isUrlProvider("webhooks")).toBe(false); // webhooks has its own route
    expect(isUrlProvider("klaviyo")).toBe(false);
    expect(isUrlProvider(3)).toBe(false);
  });

  it("listConnectionViews returns a view per provider, connected only where a row exists", async () => {
    (prisma.integrationConnection.findMany as any).mockResolvedValue([
      { provider: "slack", enabled: true, config: { url: "https://s" }, subscribedEvents: ["lead.captured"],
        deliveries: [{ status: "success", createdAt: new Date("2026-08-29T10:00:00Z") }] },
    ]);
    const views = await listConnectionViews("a1");
    const slack = views.find((v) => v.provider === "slack")!;
    expect(slack.connected).toBe(true);
    expect(slack.url).toBe("https://s");
    expect(slack.lastDelivery).toEqual({ status: "success", at: "2026-08-29T10:00:00.000Z" });
    const zap = views.find((v) => v.provider === "zapier")!;
    expect(zap.connected).toBe(false);
    expect(zap.url).toBeNull();
  });

  it("saveConnection rejects an unknown provider", async () => {
    await expect(saveConnection("a1", "klaviyo" as any, { url: "https://x" })).rejects.toThrow(/provider/i);
  });

  it("saveConnection rejects a non-https url", async () => {
    await expect(saveConnection("a1", "slack", { url: "http://x" })).rejects.toThrow(/https/i);
  });

  it("saveConnection creates a new connection with default events when none exists", async () => {
    (prisma.integrationConnection.upsert as any).mockResolvedValue({});
    await saveConnection("a1", "slack", { url: "https://s" });
    const createData = (prisma.integrationConnection.upsert as any).mock.calls[0][0].create;
    expect(createData.provider).toBe("slack");
    expect(createData.config).toEqual({ url: "https://s" });
    expect(createData.enabled).toBe(true);
    expect(createData.subscribedEvents).toEqual([
      "lead.captured",
      "variant.winner_declared",
      "campaign.activated",
      "campaign.paused",
    ]);
  });

  it("saveConnection updates only provided fields on an existing row", async () => {
    (prisma.integrationConnection.findUnique as any).mockResolvedValue({ id: "c1" });
    (prisma.integrationConnection.update as any).mockResolvedValue({});
    await saveConnection("a1", "slack", { subscribedEvents: ["lead.captured"] });
    const call = (prisma.integrationConnection.update as any).mock.calls[0][0];
    expect(call.where).toEqual({ id: "c1" });
    expect(call.data).toEqual({ subscribedEvents: ["lead.captured"] }); // url/enabled untouched
  });

  it("removeConnection deletes the provider's row", async () => {
    (prisma.integrationConnection.deleteMany as any).mockResolvedValue({ count: 1 });
    await removeConnection("a1", "slack");
    expect(prisma.integrationConnection.deleteMany).toHaveBeenCalledWith({ where: { accountId: "a1", provider: "slack" } });
  });
});
