import { describe, it, expect } from "vitest";
import { summarizeEvent } from "./summarizeEvent";
import type { IntegrationEvent } from "../types";

const lead: IntegrationEvent = {
  event: "lead.captured",
  payload: {
    campaign_id: "c1", campaign_name: "Summer Sale", variant_id: "v1", variant_name: "B",
    lead: { email: "jane@x.com", name: "Jane", phone: null, consent_given: true, captured_at: "2026-08-29T00:00:00.000Z" },
    reward: { label: "10% off", type: "COUPON", coupon_code: "SAVE10" },
  },
};
const winner: IntegrationEvent = {
  event: "variant.winner_declared",
  payload: { campaign_id: "c1", campaign_name: "Summer Sale", winning_variant_id: "v1", winning_variant_name: "B", declared_at: "2026-08-29T00:00:00.000Z" },
};

describe("summarizeEvent", () => {
  it("summarizes a lead with name and coupon", () => {
    const s = summarizeEvent(lead);
    expect(s.emoji).toBe("🎉");
    expect(s.title).toBe("New lead captured");
    expect(s.lines).toContain("Name: Jane");
    expect(s.lines).toContain("Email: jane@x.com");
    expect(s.lines).toContain("Coupon: SAVE10");
    expect(s.lines.some((l) => l.includes("Summer Sale"))).toBe(true);
  });

  it("omits name and coupon lines when absent", () => {
    const s = summarizeEvent({ ...lead, payload: { ...lead.payload, lead: { ...lead.payload.lead, name: null }, reward: null } } as IntegrationEvent);
    expect(s.lines.some((l) => l.startsWith("Name:"))).toBe(false);
    expect(s.lines.some((l) => l.startsWith("Coupon:"))).toBe(false);
    expect(s.lines).toContain("Email: jane@x.com");
  });

  it("summarizes a winner event", () => {
    const s = summarizeEvent(winner);
    expect(s.emoji).toBe("🏆");
    expect(s.title).toBe("Winner declared");
    expect(s.lines).toContain("Winning variant: B");
  });
});
