import { describe, it, expect } from "vitest";
import { getAdapter } from "./registry";

describe("adapter registry", () => {
  it("resolves the webhooks adapter", () => {
    expect(getAdapter("webhooks")?.provider).toBe("webhooks");
  });
  it("returns undefined for a provider with no adapter yet", () => {
    expect(getAdapter("klaviyo")).toBeUndefined();
  });
  it("resolves all six Phase 1 providers", () => {
    for (const p of ["webhooks", "zapier", "make", "n8n", "slack", "discord", "teams"] as const) {
      expect(getAdapter(p)?.provider).toBe(p);
    }
  });
});
