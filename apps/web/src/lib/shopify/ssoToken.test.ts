import { describe, it, expect, vi, beforeEach } from "vitest";

// Reuse the real AES-GCM box; it needs a valid key in env.
// crypto.ts reads SHOPIFY_TOKEN_ENCRYPTION_KEY lazily (per call, not cached at
// module load), and it must decode from base64 to exactly 32 bytes.
beforeEach(() => {
  process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY =
    process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY ?? Buffer.alloc(32, 7).toString("base64");
});

import { createSsoToken, verifySsoToken, InvalidSsoTokenError } from "./ssoToken";

describe("ssoToken", () => {
  it("round-trips shopDomain + accountId", () => {
    const t = createSsoToken("s.myshopify.com", "acc_1");
    expect(verifySsoToken(t)).toEqual({ shopDomain: "s.myshopify.com", accountId: "acc_1" });
  });

  it("rejects a tampered token", () => {
    const t = createSsoToken("s.myshopify.com", "acc_1");
    expect(() => verifySsoToken(t.slice(0, -2) + "xy")).toThrow(InvalidSsoTokenError);
  });

  it("rejects an expired token", () => {
    vi.useFakeTimers();
    const t = createSsoToken("s.myshopify.com", "acc_1");
    vi.advanceTimersByTime(3 * 60 * 1000); // TTL is 2 min
    expect(() => verifySsoToken(t)).toThrow(InvalidSsoTokenError);
    vi.useRealTimers();
  });
});
