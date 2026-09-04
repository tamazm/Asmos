/**
 * lib/testing/knockoutSim.ts
 *
 * Pure Knockout Tournament simulation engine.
 * Models the full lifecycle of a multi-round A/B/n tournament:
 *  1. Traffic generation across active arms with realistic conversion lift.
 *  2. Sequential Thompson posterior evaluation via probabilityBest().
 *  3. Two-strike elimination guard (P(best) < 2% twice consecutively).
 *  4. Round completion when 1 variant remains.
 *  5. Winner promotion to Control and challenger generation for Round N+1.
 *  6. Full tournament fast-forwarding or single-step execution.
 */

import { probabilityBest, type Arm } from "@/lib/bandit";
import { makeRng, hashSeed } from "@/lib/designBrief";

export const KNOCKOUT_ELIMINATION_THRESHOLD = 0.02; // < 2% posterior probability
export const KNOCKOUT_ELIMINATION_STRIKES = 2;      // 2 consecutive strikes
export const KNOCKOUT_MIN_IMPRESSIONS = 1000;
export const KNOCKOUT_MIN_SUCCESSES = 25;

export type SimVariantStatus = "ACTIVE" | "ELIMINATED" | "WINNER";

export type SimulatedKnockoutVariant = {
  id: string;
  name: string;
  initials: string;
  color: string;
  isControl: boolean;
  status: SimVariantStatus;
  eliminationStrikes: number;
  impressions: number;
  submissions: number;
  conversionRate: number; // percentage, e.g. 4.2
  trafficPercent: number; // 0..100
  pBest: number;          // 0..1
  tournamentRound: number;
  trueCvr: number;        // underlying probability, e.g. 0.04
  headline: string;
};

export type KnockoutRoundState = {
  roundNumber: number;
  title: string;
  variants: SimulatedKnockoutVariant[];
  winnerId: string | null;
  isComplete: boolean;
};

export type KnockoutLogEntry = {
  id: string;
  timestamp: number;
  round: number;
  message: string;
  type: "info" | "strike" | "elimination" | "advance" | "winner";
};

export type KnockoutSimState = {
  seed: number;
  currentRound: number;
  maxRounds: number;
  rounds: KnockoutRoundState[];
  logs: KnockoutLogEntry[];
  isFinished: boolean;
  championId: string | null;
  totalImpressions: number;
  totalSubmissions: number;
};

export type KnockoutSimConfig = {
  seed?: number;
  startingVariants?: number; // 3, 4, 6, 8 (default 4)
  baseCvr?: number;          // e.g. 0.04
  winnerLiftPct?: number;    // e.g. 60 (+60% lift)
  impressionsPerStep?: number; // e.g. 1500
  maxRounds?: number;        // default 3
};

const PALETTE = [
  "#2563eb", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
  "#6366f1", // indigo
];

function getVariantColor(index: number): string {
  return PALETTE[index % PALETTE.length];
}

const SAMPLE_HEADLINES = [
  "Get 15% off your first purchase",
  "Unlock VIP member access today",
  "Free shipping on orders over $50",
  "Limited time: Claim your gift",
  "Exclusive seasonal preview inside",
  "Join 50,000+ happy shoppers",
  "Don't miss today's flash drop",
  "Special welcome treat for you",
];

/**
 * Initializes a clean sandbox knockout tournament state.
 */
export function initializeKnockoutSandbox(config: KnockoutSimConfig = {}): KnockoutSimState {
  const seed = config.seed ?? Math.floor(Math.random() * 1000000);
  const startingCount = Math.max(3, Math.min(8, config.startingVariants ?? 4));
  const baseCvr = config.baseCvr ?? 0.04;
  const winnerLift = 1 + (config.winnerLiftPct ?? 60) / 100;
  const maxRounds = config.maxRounds ?? 3;

  const rng = makeRng(seed);

  // Pick winner index deterministically
  const winnerIdx = Math.floor(rng() * startingCount);

  const initialVariants: SimulatedKnockoutVariant[] = [];
  for (let i = 0; i < startingCount; i++) {
    const isControl = i === 0;
    const isSecretWinner = i === winnerIdx;
    const rateNoise = (rng() * 0.4 - 0.2); // +/- 20%
    const cvr = isSecretWinner ? baseCvr * winnerLift : Math.max(0.01, baseCvr * (1 + rateNoise));

    initialVariants.push({
      id: `r1_v${i + 1}`,
      name: isControl ? "Variant A (Control)" : `Variant ${String.fromCharCode(65 + i)}`,
      initials: String.fromCharCode(65 + i),
      color: getVariantColor(i),
      isControl,
      status: "ACTIVE",
      eliminationStrikes: 0,
      impressions: 0,
      submissions: 0,
      conversionRate: 0,
      trafficPercent: Math.round(100 / startingCount),
      pBest: 1 / startingCount,
      tournamentRound: 1,
      trueCvr: cvr,
      headline: SAMPLE_HEADLINES[i % SAMPLE_HEADLINES.length],
    });
  }

  // Enforce traffic sum = 100
  const totalTraffic = initialVariants.reduce((s, v) => s + v.trafficPercent, 0);
  initialVariants[0].trafficPercent += 100 - totalTraffic;

  const round1: KnockoutRoundState = {
    roundNumber: 1,
    title: `Round 1 (${startingCount} Contenders)`,
    variants: initialVariants,
    winnerId: null,
    isComplete: false,
  };

  return {
    seed,
    currentRound: 1,
    maxRounds,
    rounds: [round1],
    logs: [
      {
        id: "log_init",
        timestamp: Date.now(),
        round: 1,
        message: `Tournament initialized with ${startingCount} variants in Round 1. Equal starting prior.`,
        type: "info",
      },
    ],
    isFinished: false,
    championId: null,
    totalImpressions: 0,
    totalSubmissions: 0,
  };
}

/**
 * Executes a single step (one wave of simulated traffic + posterior evaluation)
 * on the current round of the tournament.
 */
export function stepKnockoutTournament(
  state: KnockoutSimState,
  config: KnockoutSimConfig = {},
): KnockoutSimState {
  if (state.isFinished) return state;

  const nextState: KnockoutSimState = JSON.parse(JSON.stringify(state));
  const currentRoundState = nextState.rounds.find((r) => r.roundNumber === nextState.currentRound);
  if (!currentRoundState || currentRoundState.isComplete) return nextState;

  const impressionsPerStep = config.impressionsPerStep ?? 1500;
  const activeVariants = currentRoundState.variants.filter((v) => v.status === "ACTIVE");

  if (activeVariants.length <= 1) {
    // Round is already down to 1 variant or empty - resolve round advancement
    return resolveRoundAdvancement(nextState, config);
  }

  const stepSeed = hashSeed(nextState.seed, nextState.totalImpressions, nextState.logs.length);
  const rng = makeRng(stepSeed);

  // 1. Simulate traffic across active variants according to current trafficPercent
  let stepImpressions = 0;
  let stepSubmissions = 0;

  for (let i = 0; i < impressionsPerStep; i++) {
    // Pick variant weighted by trafficPercent
    let r = rng() * 100;
    let chosen = activeVariants[0];
    for (const v of activeVariants) {
      r -= v.trafficPercent;
      if (r <= 0) {
        chosen = v;
        break;
      }
    }

    chosen.impressions += 1;
    stepImpressions += 1;
    if (rng() < chosen.trueCvr) {
      chosen.submissions += 1;
      stepSubmissions += 1;
    }
  }

  nextState.totalImpressions += stepImpressions;
  nextState.totalSubmissions += stepSubmissions;

  // Update measured conversion rates
  for (const v of currentRoundState.variants) {
    v.conversionRate = v.impressions > 0 ? Number(((v.submissions / v.impressions) * 100).toFixed(2)) : 0;
  }

  // 2. Compute posterior probabilities P(best) using Thompson Sampling
  const arms: Arm[] = activeVariants.map((v) => ({
    id: v.id,
    impressions: v.impressions,
    submissions: v.submissions,
  }));

  const pBestMap = probabilityBest(arms);
  for (const v of activeVariants) {
    v.pBest = Number((pBestMap[v.id] ?? 0).toFixed(4));
  }

  nextState.logs.unshift({
    id: `log_traffic_${Date.now()}_${rng()}`,
    timestamp: Date.now(),
    round: nextState.currentRound,
    message: `Simulated ${impressionsPerStep.toLocaleString()} impressions across ${activeVariants.length} active variants. Total: ${nextState.totalImpressions.toLocaleString()}.`,
    type: "info",
  });

  // 3. Evaluate Knockout Elimination Criteria
  const totalRoundImpressions = activeVariants.reduce((s, a) => s + a.impressions, 0);
  const totalRoundSuccesses = activeVariants.reduce((s, a) => s + a.submissions, 0);

  if (
    totalRoundImpressions >= KNOCKOUT_MIN_IMPRESSIONS &&
    totalRoundSuccesses >= KNOCKOUT_MIN_SUCCESSES
  ) {
    // Find the worst arm with P(best) < 2%
    const underperformers = activeVariants
      .filter((v) => v.pBest < KNOCKOUT_ELIMINATION_THRESHOLD)
      .sort((a, b) => a.pBest - b.pBest);

    if (underperformers.length > 0 && activeVariants.length > 1) {
      const target = underperformers[0];
      target.eliminationStrikes += 1;

      // Clear strikes for other active variants that are safe
      for (const other of activeVariants) {
        if (other.id !== target.id) {
          other.eliminationStrikes = 0;
        }
      }

      if (target.eliminationStrikes >= KNOCKOUT_ELIMINATION_STRIKES) {
        target.status = "ELIMINATED";
        target.trafficPercent = 0;

        nextState.logs.unshift({
          id: `log_elim_${Date.now()}_${target.id}`,
          timestamp: Date.now(),
          round: nextState.currentRound,
          message: `🚫 ${target.name} received Strike 2/2 (P(best) = ${(target.pBest * 100).toFixed(2)}%) and is ELIMINATED!`,
          type: "elimination",
        });
      } else {
        nextState.logs.unshift({
          id: `log_strike_${Date.now()}_${target.id}`,
          timestamp: Date.now(),
          round: nextState.currentRound,
          message: `⚠️ ${target.name} received Strike 1/2: P(best) is ${(target.pBest * 100).toFixed(2)}% (< 2.00%). One more strike will eliminate.`,
          type: "strike",
        });
      }
    }
  }

  // 4. Rebalance traffic among remaining active variants (Thompson-proportional with 5% floor)
  const remainingActive = currentRoundState.variants.filter((v) => v.status === "ACTIVE");
  if (remainingActive.length === 1) {
    remainingActive[0].trafficPercent = 100;
    // Round is won!
    return resolveRoundAdvancement(nextState, config);
  } else if (remainingActive.length > 1) {
    const floor = 5;
    const pool = 100 - floor * remainingActive.length;
    const totalPBest = remainingActive.reduce((s, v) => s + v.pBest, 0) || 1;
    let distributed = 0;

    remainingActive.forEach((v, idx) => {
      if (idx === remainingActive.length - 1) {
        v.trafficPercent = 100 - distributed;
      } else {
        const share = floor + Math.round((v.pBest / totalPBest) * pool);
        v.trafficPercent = share;
        distributed += share;
      }
    });
  }

  return nextState;
}

/**
 * Handles round completion, promotes winner as new control, and spawns Round N+1.
 */
function resolveRoundAdvancement(
  state: KnockoutSimState,
  config: KnockoutSimConfig,
): KnockoutSimState {
  const currentRoundState = state.rounds.find((r) => r.roundNumber === state.currentRound);
  if (!currentRoundState) return state;

  const activeVariants = currentRoundState.variants.filter((v) => v.status === "ACTIVE");
  const winner = activeVariants[0] ?? currentRoundState.variants[0];

  currentRoundState.winnerId = winner.id;
  currentRoundState.isComplete = true;
  winner.status = "WINNER";

  state.logs.unshift({
    id: `log_win_${Date.now()}_${winner.id}`,
    timestamp: Date.now(),
    round: state.currentRound,
    message: `🏆 ${winner.name} won Round ${state.currentRound} with ${winner.conversionRate}% CVR!`,
    type: "winner",
  });

  // Check if tournament has reached max rounds
  if (state.currentRound >= state.maxRounds) {
    state.isFinished = true;
    state.championId = winner.id;
    state.logs.unshift({
      id: `log_champ_${Date.now()}_${winner.id}`,
      timestamp: Date.now(),
      round: state.currentRound,
      message: `🎉 TOURNAMENT COMPLETE! ${winner.name} is crowned the Grand Champion after ${state.maxRounds} rounds!`,
      type: "winner",
    });
    return state;
  }

  // Advance to next round
  const nextRoundNum = state.currentRound + 1;
  state.currentRound = nextRoundNum;

  const rng = makeRng(hashSeed(state.seed, "round", nextRoundNum));
  const baseCvr = config.baseCvr ?? 0.04;

  // Next round variants: The winner is carried over as the new Control + 2 new Challengers
  const newRoundVariants: SimulatedKnockoutVariant[] = [
    {
      id: `r${nextRoundNum}_control_${winner.id}`,
      name: `${winner.name.replace(/ \(Control\)/g, "").replace(/ \(New Control\)/g, "")} (Defending Control)`,
      initials: winner.initials,
      color: winner.color,
      isControl: true,
      status: "ACTIVE",
      eliminationStrikes: 0,
      impressions: 0,
      submissions: 0,
      conversionRate: 0,
      trafficPercent: 34,
      pBest: 0.34,
      tournamentRound: nextRoundNum,
      trueCvr: winner.trueCvr,
      headline: winner.headline,
    },
  ];

  // Spawn 2 new challengers
  const challengerLetters = ["B", "C"];
  for (let i = 0; i < 2; i++) {
    const letter = challengerLetters[i];
    const noise = (rng() * 0.4 - 0.2);
    // Challenger might be even stronger or slightly weaker
    const isStronger = rng() > 0.5;
    const cvr = isStronger
      ? winner.trueCvr * (1 + rng() * 0.25)
      : Math.max(0.015, baseCvr * (1 + noise));

    newRoundVariants.push({
      id: `r${nextRoundNum}_challenger_${i + 1}`,
      name: `Challenger ${letter} (R${nextRoundNum})`,
      initials: letter,
      color: getVariantColor(newRoundVariants.length),
      isControl: false,
      status: "ACTIVE",
      eliminationStrikes: 0,
      impressions: 0,
      submissions: 0,
      conversionRate: 0,
      trafficPercent: 33,
      pBest: 0.33,
      tournamentRound: nextRoundNum,
      trueCvr: cvr,
      headline: SAMPLE_HEADLINES[(nextRoundNum * 2 + i) % SAMPLE_HEADLINES.length],
    });
  }

  state.rounds.push({
    roundNumber: nextRoundNum,
    title: `Round ${nextRoundNum} (Defending Control vs 2 Challengers)`,
    variants: newRoundVariants,
    winnerId: null,
    isComplete: false,
  });

  state.logs.unshift({
    id: `log_advance_${Date.now()}`,
    timestamp: Date.now(),
    round: nextRoundNum,
    message: `🚀 Advanced to Round ${nextRoundNum}! ${winner.name} defends its title as Control against 2 new AI Challengers.`,
    type: "advance",
  });

  return state;
}

/**
 * Fast-forwards the current round until a round winner is crowned (or max steps reached).
 */
export function fastForwardCurrentRound(
  state: KnockoutSimState,
  config: KnockoutSimConfig = {},
  maxSteps = 30,
): KnockoutSimState {
  let cur = state;
  const targetRound = cur.currentRound;

  let steps = 0;
  while (!cur.isFinished && cur.currentRound === targetRound && steps < maxSteps) {
    cur = stepKnockoutTournament(cur, config);
    steps++;
  }

  return cur;
}

/**
 * Fast-forwards the entire tournament until all rounds complete and champion is crowned.
 */
export function fastForwardFullTournament(
  state: KnockoutSimState,
  config: KnockoutSimConfig = {},
  maxSteps = 100,
): KnockoutSimState {
  let cur = state;
  let steps = 0;

  while (!cur.isFinished && steps < maxSteps) {
    cur = stepKnockoutTournament(cur, config);
    steps++;
  }

  return cur;
}
