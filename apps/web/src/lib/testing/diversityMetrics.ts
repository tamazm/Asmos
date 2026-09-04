/**
 * lib/testing/diversityMetrics.ts
 *
 * Pure metrics for the Tester Toolkit's diversity harness - "generate N
 * variants, do they repeat / copy each other / stay genuinely different?".
 *
 * No DB or generation imports: everything here is a function of already-collected
 * fingerprints, DNA draws, and copy strings, so it is unit-testable in isolation.
 * The orchestration that actually draws N briefs and (optionally) calls the model
 * lives in `runDiversity.ts`.
 */

import { dnaDistance } from "@/lib/popupDna";

// ─── Structural (Tier A) ─────────────────────────────────────────────────────

/**
 * The 0.6 nearest-neighbour distance `buildDesignBrief` itself targets when it
 * resamples away from recent fingerprints. Pairs closer than this are "too
 * similar to be worth testing head-to-head".
 */
export const TOO_CLOSE_THRESHOLD = 0.6;

export type StructuralStats = {
  n: number;
  /** Mean over each item's distance to its NEAREST other item. */
  meanNearestNeighbor: number;
  /** The single closest pair in the whole set - the worst case. */
  minNearestNeighbor: number;
  /** Share of unordered pairs closer than TOO_CLOSE_THRESHOLD, 0..1. */
  tooClosePairRate: number;
  /** Count of exactly-identical fingerprints (structural clones). */
  exactCollisions: number;
  /** Distinct fingerprints / n. */
  uniqueRate: number;
};

export function structuralStats(fingerprints: string[]): StructuralStats {
  const n = fingerprints.length;
  if (n < 2) {
    return {
      n,
      meanNearestNeighbor: 1,
      minNearestNeighbor: 1,
      tooClosePairRate: 0,
      exactCollisions: 0,
      uniqueRate: n === 0 ? 0 : 1,
    };
  }

  const nearest = new Array<number>(n).fill(Infinity);
  let tooClosePairs = 0;
  let totalPairs = 0;
  let minNN = Infinity;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = dnaDistance(fingerprints[i], fingerprints[j]);
      totalPairs += 1;
      if (d < TOO_CLOSE_THRESHOLD) tooClosePairs += 1;
      if (d < nearest[i]) nearest[i] = d;
      if (d < nearest[j]) nearest[j] = d;
    }
  }

  for (const d of nearest) if (d < minNN) minNN = d;
  const meanNN = nearest.reduce((s, d) => s + d, 0) / n;
  const distinct = new Set(fingerprints).size;

  return {
    n,
    meanNearestNeighbor: meanNN,
    minNearestNeighbor: minNN,
    tooClosePairRate: totalPairs === 0 ? 0 : tooClosePairs / totalPairs,
    exactCollisions: n - distinct,
    uniqueRate: distinct / n,
  };
}

export type KnobCoverage = {
  /** Value -> count across the N draws. */
  counts: Record<string, number>;
  /** Distinct values drawn / size of the option space, 0..1. */
  coverage: number;
  /** Shannon entropy normalized by log2(optionSpaceSize), 0..1 (1 = uniform). */
  entropy: number;
  /** The single most-drawn value and its share, for a quick "88% none" readout. */
  topValue: string;
  topShare: number;
};

/**
 * How evenly N draws of one DNA knob cover its option space. Low coverage or a
 * dominant top value is exactly the "they get repetitive" signal - e.g. an
 * art_direction that lands on "glass" 70% of the time, or a timer_mode that is
 * "none" 88% of the time (the latter is expected and healthy; the former is not).
 */
export function knobCoverage(values: string[], optionSpace: readonly string[]): KnobCoverage {
  const counts: Record<string, number> = {};
  for (const v of values) counts[v] = (counts[v] ?? 0) + 1;

  const n = values.length;
  const spaceSize = Math.max(1, optionSpace.length);
  const distinct = Object.keys(counts).length;

  let entropy = 0;
  let topValue = "";
  let topCount = 0;
  for (const [v, c] of Object.entries(counts)) {
    if (c > topCount) {
      topCount = c;
      topValue = v;
    }
    const p = c / n;
    entropy -= p * Math.log2(p);
  }
  const maxEntropy = Math.log2(spaceSize);

  return {
    counts,
    coverage: distinct / spaceSize,
    entropy: maxEntropy === 0 ? 1 : entropy / maxEntropy,
    topValue,
    topShare: n === 0 ? 0 : topCount / n,
  };
}

// ─── Copy (Tier B) ───────────────────────────────────────────────────────────

// The same guardrails designBrief.ts's COPY_DISCIPLINE instructs the model to
// obey, restated here so the harness can measure whether they actually held.
export const BANNED_OPENERS = ["get", "unlock", "don't miss", "dont miss", "join thousands", "hurry"];
export const BANNED_WORDS = [
  "exclusive",
  "amazing",
  "elevate",
  "seamless",
  "curated",
  "treat yourself",
  "levels up",
];

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Jaccard overlap of the two strings' word sets, 0..1. */
export function headlineSimilarity(a: string, b: string): number {
  const sa = new Set(tokenize(a));
  const sb = new Set(tokenize(b));
  if (sa.size === 0 && sb.size === 0) return 1;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter += 1;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * Whether the subhead merely restates the headline - the single failure the
 * whole brief system exists to prevent. Measured as the share of the subhead's
 * words already present in the headline; a high overlap means "two lines, one
 * idea".
 */
export function subheadRestatesHeadline(headline: string, subhead: string, threshold = 0.6): boolean {
  const head = new Set(tokenize(headline));
  const sub = tokenize(subhead);
  if (sub.length === 0) return false;
  const overlap = sub.filter((w) => head.has(w)).length / sub.length;
  return overlap >= threshold;
}

export function bannedOpenerHit(headline: string): boolean {
  const h = headline.toLowerCase().trimStart();
  return BANNED_OPENERS.some((b) => h.startsWith(b));
}

export function bannedWordHits(text: string): string[] {
  const t = text.toLowerCase();
  return BANNED_WORDS.filter((w) => t.includes(w));
}

export type CopySample = { headline: string; subhead: string; cta: string };

export type CopyStats = {
  n: number;
  exactHeadlineDupes: number;
  maxHeadlineSimilarity: number;
  meanHeadlineSimilarity: number;
  bannedOpenerRate: number;
  bannedWordRate: number;
  subheadRestateRate: number;
};

export function copyStats(samples: CopySample[]): CopyStats {
  const n = samples.length;
  if (n === 0) {
    return {
      n: 0,
      exactHeadlineDupes: 0,
      maxHeadlineSimilarity: 0,
      meanHeadlineSimilarity: 0,
      bannedOpenerRate: 0,
      bannedWordRate: 0,
      subheadRestateRate: 0,
    };
  }

  const headlines = samples.map((s) => s.headline.trim().toLowerCase());
  const distinctHeadlines = new Set(headlines).size;

  let maxSim = 0;
  let sumSim = 0;
  let pairs = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const sim = headlineSimilarity(samples[i].headline, samples[j].headline);
      maxSim = Math.max(maxSim, sim);
      sumSim += sim;
      pairs += 1;
    }
  }

  const bannedOpeners = samples.filter((s) => bannedOpenerHit(s.headline)).length;
  const bannedWords = samples.filter(
    (s) => bannedWordHits(`${s.headline} ${s.subhead} ${s.cta}`).length > 0,
  ).length;
  const restates = samples.filter((s) => subheadRestatesHeadline(s.headline, s.subhead)).length;

  return {
    n,
    exactHeadlineDupes: n - distinctHeadlines,
    maxHeadlineSimilarity: maxSim,
    meanHeadlineSimilarity: pairs === 0 ? 0 : sumSim / pairs,
    bannedOpenerRate: bannedOpeners / n,
    bannedWordRate: bannedWords / n,
    subheadRestateRate: restates / n,
  };
}
