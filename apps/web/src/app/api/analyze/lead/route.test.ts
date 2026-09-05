import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  afterCallbacks: [] as Array<() => void | Promise<void>>,
  leadUpsert: vi.fn(),
  leadFindFirst: vi.fn(),
  leadCreate: vi.fn(),
  sendReportEmail: vi.fn(),
  sendAnalyzeLeadToDiscord: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: vi.fn((callback: () => void | Promise<void>) => {
      mocks.afterCallbacks.push(callback);
    }),
  };
});
vi.mock("@/lib/prisma", () => ({
  prisma: {
    analyzeLead: {
      upsert: mocks.leadUpsert,
      findFirst: mocks.leadFindFirst,
      create: mocks.leadCreate,
    },
  },
}));
vi.mock("@/lib/email", () => ({ sendReportEmail: mocks.sendReportEmail }));
vi.mock("@/lib/analyzeLeadDiscord", () => ({
  sendAnalyzeLeadToDiscord: mocks.sendAnalyzeLeadToDiscord,
}));

import { OPTIONS, POST } from "./route";

const validBody = {
  email: "shopper@example.com",
  storeUrl: "https://shop.example",
  storeName: "Example Shop",
  industry: "Apparel",
  score: 72,
  grade: "B-",
  auditSignals: [
    { key: "socialProof", found: false, description: "No visible reviews" },
    { key: "unknownSignal", found: false, description: "Ignore me" },
  ],
};

function postRequest(origin?: string) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (origin) headers.set("Origin", origin);
  return new Request("https://app.asmos.io/api/analyze/lead", {
    method: "POST",
    headers,
    body: JSON.stringify(validBody),
  });
}

function optionsRequest(origin: string) {
  return new Request("https://app.asmos.io/api/analyze/lead", {
    method: "OPTIONS",
    headers: { Origin: origin },
  });
}

describe("/api/analyze/lead origin allowlist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.afterCallbacks.length = 0;
    mocks.leadUpsert.mockResolvedValue({
      id: "lead_1",
      email: "shopper@example.com",
      storeUrl: "https://shop.example",
      storeName: "Example Shop",
      industry: "Apparel",
      score: 72,
      grade: "B-",
      createdAt: new Date("2026-09-05T00:00:00.000Z"),
    });
  });

  it.each(["https://asmos.io", "https://app.asmos.io"])(
    "accepts POST requests from %s",
    async (origin) => {
      const response = await POST(postRequest(origin) as never);

      expect(response.status).toBe(200);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(origin);
      expect(response.headers.get("Vary")).toBe("Origin");
      expect(mocks.leadUpsert).toHaveBeenCalledOnce();
      expect(mocks.afterCallbacks).toHaveLength(2);
    },
  );

  it.each([undefined, "https://evil.example", "https://www.asmos.io"])(
    "rejects a missing or unapproved POST origin: %s",
    async (origin) => {
      const response = await POST(postRequest(origin) as never);

      expect(response.status).toBe(403);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
      expect(response.headers.get("Vary")).toBe("Origin");
      expect(mocks.leadUpsert).not.toHaveBeenCalled();
      expect(mocks.afterCallbacks).toHaveLength(0);
    },
  );

  it("allows approved preflight requests and rejects other origins", async () => {
    const allowed = await OPTIONS(optionsRequest("https://asmos.io") as never);
    const rejected = await OPTIONS(optionsRequest("https://evil.example") as never);

    expect(allowed.status).toBe(204);
    expect(allowed.headers.get("Access-Control-Allow-Origin")).toBe("https://asmos.io");
    expect(allowed.headers.get("Access-Control-Allow-Methods")).toBe("POST, OPTIONS");
    expect(rejected.status).toBe(403);
    expect(rejected.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("sends both the report email and formatted Discord lead after responding", async () => {
    const response = await POST(postRequest("https://app.asmos.io") as never);
    expect(response.status).toBe(200);

    await Promise.all(mocks.afterCallbacks.map((callback) => callback()));

    expect(mocks.sendReportEmail).toHaveBeenCalledOnce();
    expect(mocks.sendReportEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        auditSignals: [
          { key: "socialProof", found: false, description: "No visible reviews" },
        ],
      }),
    );
    expect(mocks.sendAnalyzeLeadToDiscord).toHaveBeenCalledWith(
      expect.objectContaining({
        leadId: "lead_1",
        email: "shopper@example.com",
        storeUrl: "https://shop.example",
        storeName: "Example Shop",
        industry: "Apparel",
        score: 72,
        grade: "B-",
        origin: "https://app.asmos.io",
      }),
    );
  });
});
