import { describe, it, expect } from "vitest";
import { getAdapter } from "./registry";

describe("adapter registry", () => {
  it("resolves the webhooks adapter", () => {
    expect(getAdapter("webhooks")?.provider).toBe("webhooks");
  });
  it("returns undefined for a provider with no adapter yet", () => {
    expect(getAdapter("klaviyo")).toBeUndefined();
  });
});
