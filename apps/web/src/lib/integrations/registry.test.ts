import { describe, it, expect } from "vitest";
import { getAdapter } from "./registry";

describe("adapter registry", () => {
  it("resolves the webhooks adapter", () => {
    expect(getAdapter("webhooks")?.provider).toBe("webhooks");
  });
  
  it("returns undefined for a bogus provider", () => {
    // @ts-expect-error
    expect(getAdapter("bogus")).toBeUndefined();
  });

  it("resolves all twelve Phase 1-3 providers", () => {
    for (const p of ["webhooks", "zapier", "make", "n8n", "slack", "discord", "teams", "klaviyo", "mailchimp", "hubspot", "mailgun", "twilio"] as const) {
      expect(getAdapter(p)?.provider).toBe(p);
    }
  });
});

