import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    integrationConnection: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));
vi.mock("./crypto", () => ({
  encryptSecret: vi.fn((s) => ({ encrypted: s })),
  decryptSecret: vi.fn((s: any) => s.encrypted || s),
}));
vi.mock("./registry", () => ({
  getAdapter: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { getAdapter } from "./registry";
import { isSyncProvider, listSyncConnectionViews, saveSyncConnection, removeSyncConnection } from "./manageSyncConnections";

describe("manageSyncConnections", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("isSyncProvider", () => {
    it("returns true for sync providers", () => {
      expect(isSyncProvider("klaviyo")).toBe(true);
      expect(isSyncProvider("mailchimp")).toBe(true);
      expect(isSyncProvider("hubspot")).toBe(true);
    });

    it("returns false for others", () => {
      expect(isSyncProvider("webhook")).toBe(false);
      expect(isSyncProvider("zapier")).toBe(false);
      expect(isSyncProvider(123)).toBe(false);
    });
  });

  describe("listSyncConnectionViews", () => {
    it("returns correctly mapped views for existing connections", async () => {
      (prisma.integrationConnection as any).findMany.mockResolvedValue([
        {
          provider: "klaviyo",
          enabled: true,
          config: { listId: "XYZ123" },
          credentials: { encrypted: JSON.stringify({ apiKey: "pk_12345" }) },
          subscribedEvents: ["lead.captured"],
          deliveries: [{ status: "success", createdAt: new Date("2026-01-01T00:00:00Z") }],
        }
      ]);

      const views = await listSyncConnectionViews("a1");
      const klaviyo = views.find(v => v.provider === "klaviyo");
      expect(klaviyo?.connected).toBe(true);
      expect(klaviyo?.maskedKey).toBe("••••••••2345");
      expect(klaviyo?.config).toEqual({ listId: "XYZ123" });
      expect(klaviyo?.lastDelivery?.status).toBe("success");
    });
    
    it("returns empty views for missing providers", async () => {
      (prisma.integrationConnection as any).findMany.mockResolvedValue([]);

      const views = await listSyncConnectionViews("a1");
      const klaviyo = views.find(v => v.provider === "klaviyo");
      expect(klaviyo?.connected).toBe(false);
      expect(klaviyo?.maskedKey).toBeNull();
    });
  });

  describe("saveSyncConnection", () => {
    it("validates before saving and fails if invalid", async () => {
      (prisma.integrationConnection as any).findUnique.mockResolvedValue(null);
      (getAdapter as any).mockReturnValue({
        validate: vi.fn().mockResolvedValue({ ok: false, error: "Bad key" })
      });

      const res = await saveSyncConnection("a1", "klaviyo", { apiKey: "bad_key", config: { listId: "XYZ123" } });
      
      expect(res.ok).toBe(false);
      expect(res.error).toBe("Bad key");
      expect((prisma.integrationConnection as any).upsert).not.toHaveBeenCalled();
    });

    it("upserts connection if valid", async () => {
      (prisma.integrationConnection as any).findUnique.mockResolvedValue(null);
      (getAdapter as any).mockReturnValue({
        validate: vi.fn().mockResolvedValue({ ok: true })
      });

      const res = await saveSyncConnection("a1", "klaviyo", { apiKey: "good_key", config: { listId: "XYZ123" } });
      
      expect(res.ok).toBe(true);
      expect((prisma.integrationConnection as any).upsert).toHaveBeenCalledWith(expect.objectContaining({
        where: { accountId_provider: { accountId: "a1", provider: "klaviyo" } },
        create: expect.objectContaining({
          credentials: { encrypted: JSON.stringify({ apiKey: "good_key" }) },
          config: { listId: "XYZ123" }
        })
      }));
    });
    
    it("preserves API key if missing in input but present in existing", async () => {
      (prisma.integrationConnection as any).findUnique.mockResolvedValue({
        credentials: { encrypted: JSON.stringify({ apiKey: "existing_key" }) },
        config: { listId: "OLD123" }
      });
      (getAdapter as any).mockReturnValue({
        validate: vi.fn().mockResolvedValue({ ok: true })
      });

      const res = await saveSyncConnection("a1", "klaviyo", { config: { listId: "NEW123" } });
      
      expect(res.ok).toBe(true);
      expect((prisma.integrationConnection as any).upsert).toHaveBeenCalledWith(expect.objectContaining({
        update: expect.objectContaining({
          credentials: { encrypted: JSON.stringify({ apiKey: "existing_key" }) },
          config: { listId: "NEW123" }
        })
      }));
    });
  });
  
  describe("removeSyncConnection", () => {
    it("deletes the connection", async () => {
      await removeSyncConnection("a1", "klaviyo");
      expect((prisma.integrationConnection as any).deleteMany).toHaveBeenCalledWith({
        where: { accountId: "a1", provider: "klaviyo" }
      });
    });
  });
});
