/**
 * lib/testing/genTiming.ts
 *
 * Pure helpers for the Tester Toolkit's generation-timing tool and the
 * diversity harness's cost estimate. No DB imports - the trace-fetching wrapper
 * lives in `testingActions.ts`.
 */

/**
 * Deliberately GENEROUS per-generation cost estimate, in USD, for one
 * `generatePopupWithVariants` call. A real call is Claude Haiku 4.5 (~8k output
 * tokens plus a multi-thousand-token prompt of scraped examples / learned
 * patterns / novelty) and may also make a Gemini image call. Actual cost lands
 * around $0.08-0.10; this rounds up so the toolkit never under-promises what a
 * diversity run will spend. Tune if provider pricing changes.
 */
export const EST_COST_PER_AI_GENERATION_USD = 0.15;

export function estimateDiversityCost(callCount: number): number {
  return Math.max(0, Math.floor(callCount)) * EST_COST_PER_AI_GENERATION_USD;
}

/** "~$1.50" - a rough, intentionally-over estimate for a given AI sample size. */
export function formatEstimatedCost(callCount: number): string {
  return `~$${estimateDiversityCost(callCount).toFixed(2)}`;
}

/** Linear-interpolated percentile of a numeric sample. p in 0..1. */
export function percentile(values: number[], p: number): number | null {
  const nums = values.filter((v) => typeof v === "number" && Number.isFinite(v));
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];
  const rank = p * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo);
}

export const TRACE_STAGES = [
  "queueMs",
  "initializeMs",
  "aiThinkingMs",
  "structuringMs",
  "savingMs",
  "totalMs",
] as const;

export type TraceStage = (typeof TRACE_STAGES)[number];

export type TraceRow = Partial<Record<TraceStage, number | null>>;

export type StageSummary = { count: number; p50: number | null; p95: number | null };

/** Per-stage p50/p95 across a batch of generation traces. */
export function summarizeTraces(rows: TraceRow[]): Record<TraceStage, StageSummary> {
  const out = {} as Record<TraceStage, StageSummary>;
  for (const stage of TRACE_STAGES) {
    const values = rows
      .map((r) => r[stage])
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    out[stage] = {
      count: values.length,
      p50: percentile(values, 0.5),
      p95: percentile(values, 0.95),
    };
  }
  return out;
}
