import { describe, it, expect } from "vitest";
import {
  percentile,
  summarizeTraces,
  estimateDiversityCost,
  formatEstimatedCost,
  EST_COST_PER_AI_GENERATION_USD,
} from "./genTiming";

describe("percentile", () => {
  it("returns null for an empty sample", () => {
    expect(percentile([], 0.5)).toBeNull();
  });
  it("returns the single value regardless of p", () => {
    expect(percentile([42], 0.95)).toBe(42);
  });
  it("interpolates the median", () => {
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2.5);
  });
  it("computes a high percentile near the top", () => {
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9)).toBeGreaterThan(8);
  });
  it("ignores non-finite values", () => {
    expect(percentile([1, NaN, 3], 0.5)).toBe(2);
  });
});

describe("summarizeTraces", () => {
  it("computes per-stage p50/p95 and skips nulls", () => {
    const summary = summarizeTraces([
      { queueMs: 100, aiThinkingMs: 2000, savingMs: null },
      { queueMs: 200, aiThinkingMs: 4000, savingMs: 50 },
      { queueMs: 300, aiThinkingMs: 6000, savingMs: 70 },
    ]);
    expect(summary.queueMs.count).toBe(3);
    expect(summary.queueMs.p50).toBe(200);
    expect(summary.savingMs.count).toBe(2);
    expect(summary.aiThinkingMs.p50).toBe(4000);
  });
});

describe("cost estimate", () => {
  it("scales linearly with call count", () => {
    expect(estimateDiversityCost(0)).toBe(0);
    expect(estimateDiversityCost(10)).toBeCloseTo(10 * EST_COST_PER_AI_GENERATION_USD);
  });
  it("formats as a rough dollar amount", () => {
    expect(formatEstimatedCost(0)).toBe("~$0.00");
    expect(formatEstimatedCost(10)).toMatch(/^~\$\d+\.\d{2}$/);
  });
});
