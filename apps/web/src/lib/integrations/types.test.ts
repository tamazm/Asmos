import { describe, it, expect } from "vitest";
import { isIntegrationProvider } from "./types";

describe("isIntegrationProvider", () => {
  it("accepts known providers", () => {
    expect(isIntegrationProvider("webhooks")).toBe(true);
    expect(isIntegrationProvider("slack")).toBe(true);
  });
  it("rejects unknown values", () => {
    expect(isIntegrationProvider("myspace")).toBe(false);
    expect(isIntegrationProvider(42)).toBe(false);
  });
});
