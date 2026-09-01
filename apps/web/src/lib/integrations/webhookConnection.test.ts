import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    integrationConnection: { findUnique: vi.fn(), findFirst: vi.fn(), upsert: vi.fn(), update: vi.fn(), create: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { getWebhookView, saveWebhook } from "./webhookConnection";
import { encryptSecret, decryptSecret } from "./crypto";

const KEY_HEX = "0".repeat(64);

describe("webhookConnection", () => {
  beforeEach(() => {
    process.env.INTEGRATION_ENCRYPTION_KEY = KEY_HEX;
    vi.clearAllMocks();
  });

  it("getWebhookView returns disabled defaults when no connection exists", async () => {
    (prisma.integrationConnection.findUnique as any).mockResolvedValue(null);
    const view = await getWebhookView("a1");
    expect(view).toEqual({ webhookUrl: null, webhookSecret: null, webhookEnabled: false, subscribedEvents: [] });
  });

  it("creates an enabled webhooks connection with the default events when none exists", async () => {
    (prisma.integrationConnection.upsert as any).mockResolvedValue({});
    await saveWebhook("a1", { webhookUrl: "https://x.com/h", webhookSecret: "shh", webhookEnabled: true });

    const call = (prisma.integrationConnection.upsert as any).mock.calls[0][0];
    expect(call.create.provider).toBe("webhooks");
    expect(call.create.config).toEqual({ url: "https://x.com/h" });
    expect(call.create.subscribedEvents).toEqual([
      "lead.captured",
      "variant.winner_declared",
      "campaign.activated",
      "campaign.paused",
    ]);
    expect(call.create.enabled).toBe(true);
    expect(JSON.stringify(call.create.credentials)).not.toContain("shh");
  });

  it("does not create a row for a bare disable when no connection exists", async () => {
    (prisma.integrationConnection.findUnique as any).mockResolvedValue(null);
    await saveWebhook("a1", { webhookEnabled: false });
    expect(prisma.integrationConnection.upsert).not.toHaveBeenCalled();
    expect(prisma.integrationConnection.update).not.toHaveBeenCalled();
  });

  it("toggles only `enabled` on a bare disable, leaving config + credentials untouched", async () => {
    (prisma.integrationConnection.findUnique as any).mockResolvedValue({
      id: "c1",
      enabled: true,
      config: { url: "https://x.com/h" },
      credentials: encryptSecret(JSON.stringify({ signingSecret: "shh" })),
    });
    await saveWebhook("a1", { webhookEnabled: false });

    const call = (prisma.integrationConnection.update as any).mock.calls[0][0];
    expect(call.where).toEqual({ id: "c1" });
    expect(call.data).toEqual({ enabled: false }); // no config / credentials keys → not wiped
  });

  it("clears the signing secret when webhookSecret is null, leaving the url intact", async () => {
    (prisma.integrationConnection.findUnique as any).mockResolvedValue({
      id: "c1",
      enabled: true,
      config: { url: "https://x.com/h" },
      credentials: encryptSecret(JSON.stringify({ signingSecret: "shh" })),
    });
    await saveWebhook("a1", { webhookSecret: null });

    const call = (prisma.integrationConnection.update as any).mock.calls[0][0];
    expect(call.data.config).toBeUndefined(); // url not touched
    const bundle = JSON.parse(decryptSecret(call.data.credentials));
    expect(bundle.signingSecret).toBeUndefined(); // secret cleared
  });
});
