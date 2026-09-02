import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    integrationConnection: { upsert: vi.fn(), findUnique: vi.fn() },
    integrationDelivery: { create: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { maskSecret, resolveConnection, recordDelivery } from "./connections";
import { encryptSecret } from "./crypto";

const KEY_HEX = "0".repeat(64);

describe("connections", () => {
  beforeEach(() => {
    process.env.INTEGRATION_ENCRYPTION_KEY = KEY_HEX;
    vi.clearAllMocks();
  });

  it("maskSecret shows only the last 4 chars", () => {
    expect(maskSecret("abcd1234efgh")).toBe("••••••••efgh");
    expect(maskSecret("")).toBeNull();
  });

  it("resolveConnection decrypts the secret bundle", async () => {
    const enc = encryptSecret(JSON.stringify({ signingSecret: "shh" }));
    (prisma.integrationConnection.findUnique as any).mockResolvedValue({
      id: "c1", accountId: "a1", provider: "webhooks", enabled: true,
      config: { url: "https://x.com" }, subscribedEvents: ["lead.captured"], credentials: enc,
    });

    const resolved = await resolveConnection("c1");
    expect(resolved?.secrets.signingSecret).toBe("shh");
    expect(resolved?.config.url).toBe("https://x.com");
  });

  it("resolveConnection returns null for a missing row", async () => {
    (prisma.integrationConnection.findUnique as any).mockResolvedValue(null);
    expect(await resolveConnection("nope")).toBeNull();
  });

  it("recordDelivery writes an audit row", async () => {
    await recordDelivery("c1", "lead.captured", { status: "success" });
    expect(prisma.integrationDelivery.create).toHaveBeenCalledWith({
      data: { connectionId: "c1", event: "lead.captured", status: "success", detail: undefined },
    });
  });
});
