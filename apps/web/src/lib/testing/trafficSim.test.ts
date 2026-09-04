import { describe, it, expect } from "vitest";
import {
  planWave,
  splitVolumeIntoWaves,
  resolveWinnerId,
  summarizeEvents,
  type SimConfig,
  type SimArm,
} from "./trafficSim";

const baseConfig = (over: Partial<SimConfig> = {}): SimConfig => ({
  seed: 12345,
  volume: 1000,
  baseCvr: 0.05,
  winnerLiftPct: 100,
  fastDismissRate: 0.2,
  deviceMix: { mobile: 60, desktop: 35, tablet: 5 },
  intentMix: { browsing: 60, high_intent: 25, exit: 15 },
  waves: 4,
  ...over,
});

const arms: SimArm[] = [
  { id: "a", trafficPercent: 50 },
  { id: "b", trafficPercent: 50 },
];

describe("splitVolumeIntoWaves", () => {
  it("sums to the total and puts the remainder in the last wave", () => {
    const parts = splitVolumeIntoWaves(1003, 4);
    expect(parts).toHaveLength(4);
    expect(parts.reduce((s, p) => s + p, 0)).toBe(1003);
    expect(parts[3]).toBeGreaterThanOrEqual(parts[0]);
  });

  it("handles a single wave", () => {
    expect(splitVolumeIntoWaves(500, 1)).toEqual([500]);
  });
});

describe("resolveWinnerId", () => {
  it("honours a pinned winner", () => {
    expect(resolveWinnerId(baseConfig({ trueWinnerId: "b" }), arms)).toBe("b");
  });
  it("picks deterministically from the seed when unpinned", () => {
    const w1 = resolveWinnerId(baseConfig(), arms);
    const w2 = resolveWinnerId(baseConfig(), arms);
    expect(w1).toBe(w2);
    expect(["a", "b"]).toContain(w1);
  });
});

describe("planWave", () => {
  it("is deterministic for the same inputs", () => {
    const a = planWave(baseConfig(), arms, 500, 0);
    const b = planWave(baseConfig(), arms, 500, 0);
    expect(a).toEqual(b);
  });

  it("emits exactly one IMPRESSION per planned impression", () => {
    const events = planWave(baseConfig(), arms, 500, 0);
    const impressions = events.filter((e) => e.type === "IMPRESSION").length;
    expect(impressions).toBe(500);
  });

  it("tags every event with a device and intent from the configured mixes", () => {
    const events = planWave(baseConfig(), arms, 200, 0);
    for (const e of events) {
      expect(["mobile", "desktop", "tablet"]).toContain(e.device);
      expect(["browsing", "high_intent", "exit"]).toContain(e.intent);
    }
  });

  it("gives DISMISSED events a dismissAfterMs and nothing else", () => {
    const events = planWave(baseConfig(), arms, 500, 0);
    for (const e of events) {
      if (e.type === "DISMISSED") expect(typeof e.dismissAfterMs).toBe("number");
      else expect(e.dismissAfterMs).toBeUndefined();
    }
  });

  it("converts the true winner at a materially higher rate", () => {
    const config = baseConfig({ volume: 20000, winnerLiftPct: 200, trueWinnerId: "a", baseCvr: 0.1 });
    const events = planWave(config, arms, 20000, 0);
    const roll = summarizeEvents(events);
    const cvrA = roll.a.submissions / roll.a.impressions;
    const cvrB = roll.b.submissions / roll.b.impressions;
    expect(cvrA).toBeGreaterThan(cvrB);
  });

  it("returns nothing for zero volume or no arms", () => {
    expect(planWave(baseConfig(), arms, 0, 0)).toEqual([]);
    expect(planWave(baseConfig(), [], 100, 0)).toEqual([]);
  });

  it("respects the allocation split when routing impressions", () => {
    const skewed: SimArm[] = [
      { id: "a", trafficPercent: 90 },
      { id: "b", trafficPercent: 10 },
    ];
    const roll = summarizeEvents(planWave(baseConfig({ volume: 5000 }), skewed, 5000, 0));
    expect(roll.a.impressions).toBeGreaterThan(roll.b.impressions * 3);
  });
});

describe("summarizeEvents", () => {
  it("counts fast dismissals below the 2s threshold", () => {
    const roll = summarizeEvents([
      { variantId: "a", type: "IMPRESSION", device: "mobile", intent: "browsing" },
      { variantId: "a", type: "DISMISSED", device: "mobile", intent: "browsing", dismissAfterMs: 500 },
      { variantId: "a", type: "DISMISSED", device: "mobile", intent: "browsing", dismissAfterMs: 9000 },
    ]);
    expect(roll.a.impressions).toBe(1);
    expect(roll.a.dismissals).toBe(2);
    expect(roll.a.fastDismissals).toBe(1);
  });
});
