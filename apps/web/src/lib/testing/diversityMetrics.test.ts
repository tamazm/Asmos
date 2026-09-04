import { describe, it, expect } from "vitest";
import {
  structuralStats,
  knobCoverage,
  headlineSimilarity,
  subheadRestatesHeadline,
  bannedOpenerHit,
  bannedWordHits,
  copyStats,
  TOO_CLOSE_THRESHOLD,
} from "./diversityMetrics";

// Fingerprints are pipe-joined DNA strings (see designBrief.briefFingerprint);
// dnaDistance compares them field-by-field.
const FP_A = "split-screen|split-left|editorial|editorial|paper|one_step|none|side|light|button_only|rect|airy|stacked|eyebrow|no-proof";
const FP_A_CLONE = FP_A;
const FP_B = "corner-toast|centered|glass|grotesque|glow|two_step|countdown|top_band|dark|headline|pill|compact|inline|no-eyebrow|proof";

describe("structuralStats", () => {
  it("counts exact fingerprint collisions", () => {
    const s = structuralStats([FP_A, FP_A_CLONE, FP_B]);
    expect(s.exactCollisions).toBe(1);
    expect(s.uniqueRate).toBeCloseTo(2 / 3);
  });

  it("flags a near-zero nearest-neighbour when two items are identical", () => {
    const s = structuralStats([FP_A, FP_A_CLONE, FP_B]);
    expect(s.minNearestNeighbor).toBe(0);
    expect(s.tooClosePairRate).toBeGreaterThan(0);
  });

  it("reports high distance for genuinely different fingerprints", () => {
    const s = structuralStats([FP_A, FP_B]);
    expect(s.minNearestNeighbor).toBeGreaterThan(TOO_CLOSE_THRESHOLD);
    expect(s.tooClosePairRate).toBe(0);
  });

  it("degrades gracefully for fewer than two items", () => {
    expect(structuralStats([]).n).toBe(0);
    expect(structuralStats([FP_A]).uniqueRate).toBe(1);
  });
});

describe("knobCoverage", () => {
  const space = ["editorial", "bold", "glass"] as const;

  it("reports full coverage and high entropy for a uniform spread", () => {
    const c = knobCoverage(["editorial", "bold", "glass"], space);
    expect(c.coverage).toBe(1);
    expect(c.entropy).toBeCloseTo(1, 5);
  });

  it("reports low coverage and a dominant top value for a skewed spread", () => {
    const c = knobCoverage(["glass", "glass", "glass", "glass", "editorial"], space);
    expect(c.coverage).toBeCloseTo(2 / 3);
    expect(c.topValue).toBe("glass");
    expect(c.topShare).toBeCloseTo(0.8);
    expect(c.entropy).toBeLessThan(0.8);
  });
});

describe("copy heuristics", () => {
  it("scores identical headlines as fully similar", () => {
    expect(headlineSimilarity("Get 15% off your order", "Get 15% off your order")).toBe(1);
  });
  it("scores unrelated headlines low", () => {
    expect(headlineSimilarity("A quiet welcome gift", "Free shipping this weekend")).toBeLessThan(0.3);
  });

  it("detects a subhead that merely restates the headline", () => {
    expect(subheadRestatesHeadline("Get 15% off your first order", "Your first order gets 15% off")).toBe(true);
    expect(subheadRestatesHeadline("A note from our founder", "We ship within two days")).toBe(false);
  });

  it("flags banned openers and words", () => {
    expect(bannedOpenerHit("Get 20% off")).toBe(true);
    expect(bannedOpenerHit("A little welcome")).toBe(false);
    expect(bannedWordHits("An exclusive, curated selection")).toEqual(["exclusive", "curated"]);
  });
});

describe("copyStats", () => {
  it("aggregates dupes, similarity, and guardrail violations", () => {
    const stats = copyStats([
      { headline: "Get 15% off your first order", subhead: "Your first order gets 15% off", cta: "Unlock" },
      { headline: "Get 15% off your first order", subhead: "We email the code instantly", cta: "Send it" },
      { headline: "A quiet welcome from us", subhead: "New arrivals drop on Fridays", cta: "Join" },
    ]);
    expect(stats.n).toBe(3);
    expect(stats.exactHeadlineDupes).toBe(1);
    expect(stats.maxHeadlineSimilarity).toBe(1);
    expect(stats.bannedOpenerRate).toBeCloseTo(2 / 3);
    expect(stats.subheadRestateRate).toBeGreaterThan(0);
  });

  it("returns zeroed stats for an empty sample", () => {
    expect(copyStats([]).n).toBe(0);
  });
});
