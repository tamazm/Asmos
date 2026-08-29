import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../integrations/connections", () => ({
  resolveConnection: vi.fn(),
  recordDelivery: vi.fn(),
}));
vi.mock("../integrations/registry", () => ({
  getAdapter: vi.fn(),
}));

import { resolveConnection, recordDelivery } from "../integrations/connections";
import { getAdapter } from "../integrations/registry";
import { runDelivery, RetriableDeliveryError } from "./deliverIntegration";
import type { IntegrationEvent } from "../integrations/types";

const event: IntegrationEvent = {
  event: "lead.captured",
  payload: {
    campaign_id: "c", campaign_name: "n", variant_id: "v", variant_name: "A",
    lead: { email: "a@b.c", name: null, phone: null, consent_given: true, captured_at: "2026-08-29T00:00:00.000Z" },
    reward: null,
  },
};
const resolved = {
  id: "c1", accountId: "a1", provider: "webhooks" as const, enabled: true,
  config: { url: "https://x.com" }, subscribedEvents: ["lead.captured"], secrets: {},
};

describe("runDelivery", () => {
  beforeEach(() => vi.clearAllMocks());

  it("skips when the connection is missing", async () => {
    (resolveConnection as any).mockResolvedValue(null);
    const res = await runDelivery("c1", event);
    expect(res.status).toBe("skipped");
    expect(recordDelivery).toHaveBeenCalledWith("c1", "lead.captured", expect.objectContaining({ status: "skipped" }));
  });

  it("skips when the connection is disabled", async () => {
    (resolveConnection as any).mockResolvedValue({ ...resolved, enabled: false });
    const res = await runDelivery("c1", event);
    expect(res.status).toBe("skipped");
  });

  it("skips when no adapter exists", async () => {
    (resolveConnection as any).mockResolvedValue(resolved);
    (getAdapter as any).mockReturnValue(undefined);
    const res = await runDelivery("c1", event);
    expect(res.status).toBe("skipped");
  });

  it("delivers and logs success", async () => {
    (resolveConnection as any).mockResolvedValue(resolved);
    (getAdapter as any).mockReturnValue({ deliver: vi.fn().mockResolvedValue({ status: "success" }) });
    const res = await runDelivery("c1", event);
    expect(res.status).toBe("success");
    expect(recordDelivery).toHaveBeenCalledWith("c1", "lead.captured", { status: "success" });
  });

  it("logs a failed delivery then throws on retriable failure", async () => {
    (resolveConnection as any).mockResolvedValue(resolved);
    (getAdapter as any).mockReturnValue({ deliver: vi.fn().mockResolvedValue({ status: "failed", retriable: true, detail: "HTTP 500" }) });
    await expect(runDelivery("c1", event)).rejects.toBeInstanceOf(RetriableDeliveryError);
    expect(recordDelivery).toHaveBeenCalledWith("c1", "lead.captured", expect.objectContaining({ status: "failed" }));
  });

  it("logs a failed delivery and does NOT throw on non-retriable failure", async () => {
    (resolveConnection as any).mockResolvedValue(resolved);
    (getAdapter as any).mockReturnValue({ deliver: vi.fn().mockResolvedValue({ status: "failed", retriable: false, detail: "HTTP 400" }) });
    const res = await runDelivery("c1", event);
    expect(res.status).toBe("failed");
  });
});
