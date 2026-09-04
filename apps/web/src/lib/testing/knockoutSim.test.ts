import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

import {
  initializeKnockoutSandbox,
  stepKnockoutTournament,
  fastForwardCurrentRound,
  fastForwardFullTournament,
  KNOCKOUT_MIN_IMPRESSIONS,
  KNOCKOUT_MIN_SUCCESSES,
  KNOCKOUT_ELIMINATION_THRESHOLD,
  type KnockoutSimState,
} from "./knockoutSim";

describe("Knockout Tournament Simulator (knockoutSim)", () => {
  it("initializes a sandbox tournament cleanly", () => {
    const state = initializeKnockoutSandbox({
      startingVariants: 4,
      baseCvr: 0.05,
      winnerLiftPct: 80,
      maxRounds: 3,
      seed: 42,
    });

    expect(state.currentRound).toBe(1);
    expect(state.maxRounds).toBe(3);
    expect(state.isFinished).toBe(false);
    expect(state.championId).toBeNull();
    expect(state.rounds).toHaveLength(1);

    const r1 = state.rounds[0];
    expect(r1.variants).toHaveLength(4);
    expect(r1.variants.filter((v) => v.isControl)).toHaveLength(1);
    expect(r1.variants.every((v) => v.status === "ACTIVE")).toBe(true);

    const totalTraffic = r1.variants.reduce((s, v) => s + v.trafficPercent, 0);
    expect(totalTraffic).toBe(100);
  });

  it("does not award strikes before minimum impression and success thresholds are met", () => {
    const state = initializeKnockoutSandbox({
      startingVariants: 4,
      baseCvr: 0.01,
      seed: 123,
    });

    // Step with small volume (below 1000)
    const next = stepKnockoutTournament(state, { impressionsPerStep: 500 });
    expect(next.totalImpressions).toBe(500);

    const r1 = next.rounds[0];
    expect(r1.variants.every((v) => v.eliminationStrikes === 0)).toBe(true);
    expect(r1.variants.every((v) => v.status === "ACTIVE")).toBe(true);
  });

  it("evaluates posteriors and assigns strikes when sufficient traffic is simulated", () => {
    const state = initializeKnockoutSandbox({
      startingVariants: 4,
      baseCvr: 0.05,
      winnerLiftPct: 150, // Huge winner lift to drive clear loser below 2%
      seed: 999,
    });

    // Step with 2500 impressions
    const step1 = stepKnockoutTournament(state, { impressionsPerStep: 2500 });
    expect(step1.totalImpressions).toBeGreaterThanOrEqual(KNOCKOUT_MIN_IMPRESSIONS);

    const r1 = step1.rounds[0];
    const hasStrike = r1.variants.some((v) => v.eliminationStrikes >= 1);
    // With 150% lift and 2500 impressions, at least one poor arm drops below 2%
    expect(hasStrike).toBe(true);
  });

  it("fast-forwards a round to completion and advances to Round 2", () => {
    const state = initializeKnockoutSandbox({
      startingVariants: 4,
      baseCvr: 0.05,
      winnerLiftPct: 100,
      maxRounds: 3,
      seed: 12345,
    });

    const afterR1 = fastForwardCurrentRound(state, { impressionsPerStep: 1500 });

    // Round 1 should be complete, and state should advance to Round 2
    expect(afterR1.rounds[0].isComplete).toBe(true);
    expect(afterR1.rounds[0].winnerId).not.toBeNull();
    expect(afterR1.currentRound).toBe(2);
    expect(afterR1.rounds).toHaveLength(2);

    const r2 = afterR1.rounds[1];
    expect(r2.variants).toHaveLength(3); // 1 Defending Control + 2 Challengers
    expect(r2.variants.find((v) => v.isControl)).toBeDefined();
    expect(r2.variants.filter((v) => !v.isControl)).toHaveLength(2);
  });

  it("fast-forwards full multi-round tournament and crowns a champion", () => {
    const state = initializeKnockoutSandbox({
      startingVariants: 3,
      baseCvr: 0.06,
      winnerLiftPct: 80,
      maxRounds: 2,
      seed: 777,
    });

    const finished = fastForwardFullTournament(state, { impressionsPerStep: 2000 });

    expect(finished.isFinished).toBe(true);
    expect(finished.championId).not.toBeNull();
    expect(finished.rounds).toHaveLength(2);
    expect(finished.rounds.every((r) => r.isComplete)).toBe(true);

    const champLog = finished.logs.find((l) => l.type === "winner" && l.message.includes("Grand Champion"));
    expect(champLog).toBeDefined();
  });
});
