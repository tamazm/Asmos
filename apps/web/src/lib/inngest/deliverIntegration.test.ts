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

  it("invokes a sync (klaviyo) adapter with the resolved connection + lead payload when consented", async () => {
    // Mirrors what resolveConnection produces after decrypting the `credentials`
    // bundle: secrets.apiKey is populated and config carries the listId.
    const klaviyoConn = {
      id: "k1", accountId: "a1", provider: "klaviyo" as const, enabled: true,
      config: { listId: "LIST123" }, subscribedEvents: ["lead.captured"],
      secrets: { apiKey: "pk_live_123" },
    };
    (resolveConnection as any).mockResolvedValue(klaviyoConn);
    const mockDeliver = vi.fn().mockResolvedValue({ status: "success" });
    (getAdapter as any).mockReturnValue({ kind: "sync", provider: "klaviyo", deliver: mockDeliver });

    const res = await runDelivery("k1", event);

    expect(res.status).toBe("success");
    expect(mockDeliver).toHaveBeenCalledWith({ event, connection: klaviyoConn });
    // Adapter received the decrypted key + list id it needs to hit the provider.
    const arg = mockDeliver.mock.calls[0][0];
    expect(arg.connection.secrets.apiKey).toBe("pk_live_123");
    expect(arg.connection.config.listId).toBe("LIST123");
    expect(arg.event.payload.lead.email).toBe("a@b.c");
    expect(recordDelivery).toHaveBeenCalledWith("k1", "lead.captured", { status: "success" });
  });

  it("skips delivery for sync adapters when lead did not consent", async () => {
    (resolveConnection as any).mockResolvedValue(resolved);
    (getAdapter as any).mockReturnValue({ kind: "sync", deliver: vi.fn() });
    
    const unconsentedEvent: IntegrationEvent = {
      event: "lead.captured",
      payload: { ...event.payload, lead: { ...event.payload.lead, consent_given: false } }
    };
    
    const res = await runDelivery("c1", unconsentedEvent);
    expect(res.status).toBe("skipped");
    expect(res.detail).toBe("lead did not consent");
    expect(recordDelivery).toHaveBeenCalledWith("c1", "lead.captured", expect.objectContaining({ status: "skipped" }));
  });
});

import { deliverIntegration } from "./deliverIntegration";
import { parseRules, matchRules, executeRule } from "../integrations/messagingRules";

vi.mock("../integrations/messagingRules", () => ({
  parseRules: vi.fn(),
  matchRules: vi.fn(),
  executeRule: vi.fn(),
}));

describe("deliverIntegration", () => {
  const mockStep = {
    run: vi.fn(async (name, fn) => fn()),
    sleep: vi.fn(async () => {}),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const getHandler = () => {
    // @ts-ignore
    return deliverIntegration.fn || deliverIntegration;
  };

  it("non-messaging adapters use unchanged single-delivery path", async () => {
    (resolveConnection as any).mockResolvedValue(resolved);
    const mockDeliver = vi.fn().mockResolvedValue({ status: "success" });
    (getAdapter as any).mockReturnValue({ kind: "webhook", deliver: mockDeliver });

    const handler = getHandler();
    await handler({ event: { data: { connectionId: "c1", event } }, step: mockStep });

    expect(mockStep.run).toHaveBeenCalledWith("deliver", expect.any(Function));
    expect(mockDeliver).toHaveBeenCalled();
  });

  it("messaging adapter fans out per matched rule", async () => {
    (resolveConnection as any).mockResolvedValue(resolved);
    const mockDeliver = vi.fn().mockResolvedValue({ status: "success" });
    (getAdapter as any).mockReturnValue({ kind: "messaging", provider: "mailgun", deliver: mockDeliver });
    
    (matchRules as any).mockReturnValue([
      { event: "lead.captured", delayMinutes: 0, templateId: "t1" }
    ]);
    (executeRule as any).mockResolvedValue({ status: "success" });

    const handler = getHandler();
    await handler({ event: { data: { connectionId: "c1", event } }, step: mockStep });

    expect(mockStep.run).toHaveBeenCalledWith("send-t1", expect.any(Function));
    expect(executeRule).toHaveBeenCalled();
    expect(mockStep.sleep).not.toHaveBeenCalled();
  });

  it("delays when delayMinutes > 0 and skips if connection becomes disabled", async () => {
    let callCount = 0;
    (resolveConnection as any).mockImplementation(() => {
      callCount++;
      return callCount === 1 ? resolved : { ...resolved, enabled: false };
    });
    const mockDeliver = vi.fn().mockResolvedValue({ status: "success" });
    (getAdapter as any).mockReturnValue({ kind: "messaging", provider: "mailgun", deliver: mockDeliver });
    
    (matchRules as any).mockReturnValue([
      { event: "lead.captured", delayMinutes: 5, templateId: "t2" }
    ]);

    const handler = getHandler();
    await handler({ event: { data: { connectionId: "c1", event } }, step: mockStep });

    expect(mockStep.sleep).toHaveBeenCalledWith("wait-t2", "5m");
    expect(mockStep.run).toHaveBeenCalledWith("send-t2", expect.any(Function));
    // executeRule should NOT be called because it's disabled after sleep
    expect(executeRule).not.toHaveBeenCalled();
    expect(recordDelivery).toHaveBeenCalledWith("c1", "lead.captured", expect.objectContaining({ status: "skipped" }));
  });
});
