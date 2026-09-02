import { describe, it, expect, vi, afterEach } from "vitest";
import { classifyStatus, postWebhook } from "./httpDelivery";

describe("classifyStatus", () => {
  it("maps 2xx to success", () => { expect(classifyStatus(200)).toEqual({ status: "success" }); });
  it("maps 500 to retriable failure", () => { expect(classifyStatus(500)).toMatchObject({ status: "failed", retriable: true }); });
  it("maps 429 to retriable failure", () => { expect(classifyStatus(429)).toMatchObject({ status: "failed", retriable: true }); });
  it("maps 400 to non-retriable failure", () => { expect(classifyStatus(400)).toMatchObject({ status: "failed", retriable: false }); });
});

describe("postWebhook", () => {
  afterEach(() => vi.restoreAllMocks());

  it("POSTs JSON and returns success on 2xx", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
    const res = await postWebhook("https://x.com/h", { hello: "world" }, { event: "lead.captured" });
    expect(res.status).toBe("success");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://x.com/h");
    expect((init as RequestInit).method).toBe("POST");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ hello: "world" });
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["X-Asmos-Event"]).toBe("lead.captured");
    expect(headers["X-Asmos-Signature"]).toBeUndefined();
  });

  it("adds an HMAC signature when a secret is given", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
    await postWebhook("https://x.com/h", { a: 1 }, { secret: "shh" });
    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers["X-Asmos-Signature"]).toMatch(/^sha256=[0-9a-f]{64}$/);
  });

  it("returns retriable failure on a network error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNRESET"));
    const res = await postWebhook("https://x.com/h", {});
    expect(res).toMatchObject({ status: "failed", retriable: true });
  });
});
