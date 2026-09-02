import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { integrationConnection: { findMany: vi.fn() } },
}));
vi.mock("@/lib/inngest/client", () => ({
  inngest: { send: vi.fn() },
}));

import { prisma } from "@/lib/prisma";
import { inngest } from "@/lib/inngest/client";
import { emitIntegrationEvent } from "./emit";
import type { IntegrationEvent } from "./types";

const event: IntegrationEvent = {
  event: "lead.captured",
  payload: {
    campaign_id: "c", campaign_name: "n", variant_id: "v", variant_name: "A",
    lead: { email: "a@b.c", name: null, phone: null, consent_given: true, captured_at: "2026-08-29T00:00:00.000Z" },
    reward: null,
  },
};

describe("emitIntegrationEvent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("enqueues one inngest job per subscribed connection", async () => {
    (prisma.integrationConnection.findMany as any).mockResolvedValue([{ id: "c1" }, { id: "c2" }]);
    await emitIntegrationEvent("acct1", event);

    expect(prisma.integrationConnection.findMany).toHaveBeenCalledWith({
      where: { accountId: "acct1", enabled: true, subscribedEvents: { has: "lead.captured" } },
      select: { id: true },
    });
    expect(inngest.send).toHaveBeenCalledWith([
      { name: "integration/deliver", data: { connectionId: "c1", event } },
      { name: "integration/deliver", data: { connectionId: "c2", event } },
    ]);
  });

  it("does nothing when no connection is subscribed", async () => {
    (prisma.integrationConnection.findMany as any).mockResolvedValue([]);
    await emitIntegrationEvent("acct1", event);
    expect(inngest.send).not.toHaveBeenCalled();
  });
});
