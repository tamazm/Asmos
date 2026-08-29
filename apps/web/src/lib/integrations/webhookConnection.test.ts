import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    integrationConnection: { findFirst: vi.fn(), upsert: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { getWebhookView, saveWebhook } from "./webhookConnection";

const KEY_HEX = "0".repeat(64);

describe("webhookConnection", () => {
  beforeEach(() => {
    process.env.INTEGRATION_ENCRYPTION_KEY = KEY_HEX;
    vi.clearAllMocks();
  });

  it("getWebhookView returns disabled defaults when no connection exists", async () => {
    (prisma.integrationConnection.findFirst as any).mockResolvedValue(null);
    const view = await getWebhookView("a1");
    expect(view).toEqual({ webhookUrl: null, webhookSecret: null, webhookEnabled: false });
  });

  it("saveWebhook upserts an enabled webhooks connection with the two default events", async () => {
    (prisma.integrationConnection.findFirst as any).mockResolvedValue(null);
    (prisma.integrationConnection.upsert as any).mockResolvedValue({});
    await saveWebhook("a1", { webhookUrl: "https://x.com/h", webhookSecret: "shh", webhookEnabled: true });

    const call = (prisma.integrationConnection.upsert as any).mock.calls[0][0];
    expect(call.create.provider).toBe("webhooks");
    expect(call.create.config).toEqual({ url: "https://x.com/h" });
    expect(call.create.subscribedEvents).toEqual(["lead.captured", "variant.winner_declared"]);
    expect(call.create.enabled).toBe(true);
    expect(JSON.stringify(call.create.credentials)).not.toContain("shh");
  });
});
