/**
 * lib/testing/trafficSim.ts
 *
 * Pure traffic-simulation engine for the superadmin Tester Toolkit's "test
 * under traffic" tool. Produces a deterministic, realistic stream of widget
 * events (impressions, conversions, dismissals) so the real bandit + knockout
 * can be exercised without waiting for production traffic.
 *
 * This module is deliberately free of any DB / Inngest imports so its output is
 * unit-testable in isolation. The thin wrapper that actually writes events and
 * drives allocation lives in `runTrafficSim.ts`.
 *
 * Segments (device, intent) are FLAVOR: they nudge each impression's conversion
 * probability so the aggregate rate is realistic rather than uniform, and they
 * are written into CampaignEvent.details, but the bandit does not yet allocate
 * by segment. See the design doc.
 */

import { makeRng, hashSeed } from "@/lib/designBrief";

/** Mirrors bandit.ts FAST_DISMISS_MS - a dismissal faster than this is reflex. */
export const FAST_DISMISS_MS = 2000;

export type Device = "mobile" | "desktop" | "tablet";
export type Intent = "browsing" | "high_intent" | "exit";

export type SimConfig = {
  seed: number;
  /** Total impressions to generate across all waves. */
  volume: number;
  /** Honest average conversion rate, 0..1 (e.g. 0.04). */
  baseCvr: number;
  /** How much better the true-best arm converts, in percent (e.g. 50 => 1.5x). */
  winnerLiftPct: number;
  /** The secret winner. Omitted => chosen deterministically from the seed. */
  trueWinnerId?: string;
  /** Share of impressions that bounce inside FAST_DISMISS_MS, 0..1. */
  fastDismissRate: number;
  deviceMix: Record<Device, number>;
  intentMix: Record<Intent, number>;
  /** Re-allocation checkpoints. >= 1. */
  waves: number;
};

export type SimEventType = "IMPRESSION" | "SUBMISSION" | "DISMISSED";

export type SimEvent = {
  variantId: string;
  type: SimEventType;
  device: Device;
  intent: Intent;
  /** Present only on DISMISSED events. */
  dismissAfterMs?: number;
};

/** The minimum an arm needs for the sim: an id and its current traffic share. */
export type SimArm = { id: string; trafficPercent: number };

// Small fixed multipliers so the aggregate conversion rate varies by segment
// the way real traffic does, instead of every impression sharing one rate.
const DEVICE_FACTOR: Record<Device, number> = { mobile: 0.85, desktop: 1.1, tablet: 1.0 };
const INTENT_FACTOR: Record<Intent, number> = { browsing: 0.7, high_intent: 1.5, exit: 0.9 };

// Of the non-converting impressions that did NOT fast-dismiss, this share leave
// a slow (considered) dismissal event; the rest simply leave without a signal.
const SLOW_DISMISS_PROB = 0.3;

// Conversion probability is clamped so a stacked winner-lift + high-intent +
// desktop draw can never produce a nonsensical >95% rate.
const MAX_CVR = 0.95;

function pickWeighted<K extends string>(rng: () => number, mix: Record<K, number>): K {
  const entries = Object.entries(mix) as [K, number][];
  const total = entries.reduce((s, [, w]) => s + Math.max(0, w), 0);
  if (total <= 0) return entries[0][0];
  let r = rng() * total;
  for (const [k, w] of entries) {
    r -= Math.max(0, w);
    if (r <= 0) return k;
  }
  return entries[entries.length - 1][0];
}

/** Which arm an impression lands on, weighted by current trafficPercent. */
function pickArm(rng: () => number, arms: SimArm[]): SimArm {
  const total = arms.reduce((s, a) => s + Math.max(0, a.trafficPercent), 0);
  if (total <= 0) return arms[Math.floor(rng() * arms.length) % arms.length];
  let r = rng() * total;
  for (const a of arms) {
    r -= Math.max(0, a.trafficPercent);
    if (r <= 0) return a;
  }
  return arms[arms.length - 1];
}

/** Resolves the secret winner deterministically when the caller didn't pin one. */
export function resolveWinnerId(config: SimConfig, arms: SimArm[]): string | null {
  if (arms.length === 0) return null;
  if (config.trueWinnerId && arms.some((a) => a.id === config.trueWinnerId)) {
    return config.trueWinnerId;
  }
  return arms[hashSeed(config.seed, "winner") % arms.length].id;
}

/** Splits total volume into `waves` near-equal integer chunks (remainder last). */
export function splitVolumeIntoWaves(volume: number, waves: number): number[] {
  const w = Math.max(1, Math.floor(waves));
  const v = Math.max(0, Math.floor(volume));
  const base = Math.floor(v / w);
  const out = Array.from({ length: w }, () => base);
  out[w - 1] += v - base * w;
  return out;
}

/**
 * Deterministically plans one wave's worth of events against the CURRENT
 * allocation. Pure: same inputs always produce the same event list.
 */
export function planWave(
  config: SimConfig,
  arms: SimArm[],
  waveVolume: number,
  waveIndex: number,
): SimEvent[] {
  const events: SimEvent[] = [];
  if (arms.length === 0 || waveVolume <= 0) return events;

  const rng = makeRng(hashSeed(config.seed, "wave", waveIndex));
  const winnerId = resolveWinnerId(config, arms);
  const lift = 1 + Math.max(0, config.winnerLiftPct) / 100;

  for (let i = 0; i < waveVolume; i++) {
    const arm = pickArm(rng, arms);
    const device = pickWeighted(rng, config.deviceMix);
    const intent = pickWeighted(rng, config.intentMix);

    events.push({ variantId: arm.id, type: "IMPRESSION", device, intent });

    const armQuality = arm.id === winnerId ? lift : 1;
    const p = Math.min(
      MAX_CVR,
      Math.max(0, config.baseCvr * armQuality * DEVICE_FACTOR[device] * INTENT_FACTOR[intent]),
    );

    if (rng() < p) {
      events.push({ variantId: arm.id, type: "SUBMISSION", device, intent });
      continue;
    }

    // Non-converter: a fastDismissRate share bounce fast; of the rest, some
    // leave a slow, considered dismissal; the remainder just leave silently.
    if (rng() < config.fastDismissRate) {
      events.push({
        variantId: arm.id,
        type: "DISMISSED",
        device,
        intent,
        dismissAfterMs: 200 + Math.floor(rng() * (FAST_DISMISS_MS - 300)),
      });
    } else if (rng() < SLOW_DISMISS_PROB) {
      events.push({
        variantId: arm.id,
        type: "DISMISSED",
        device,
        intent,
        dismissAfterMs: FAST_DISMISS_MS + 500 + Math.floor(rng() * 18000),
      });
    }
  }

  return events;
}

/** Per-arm rollup of a set of events - used for the returned wave summary. */
export function summarizeEvents(events: SimEvent[]): Record<
  string,
  { impressions: number; submissions: number; dismissals: number; fastDismissals: number }
> {
  const out: Record<
    string,
    { impressions: number; submissions: number; dismissals: number; fastDismissals: number }
  > = {};
  for (const e of events) {
    const row = (out[e.variantId] ??= {
      impressions: 0,
      submissions: 0,
      dismissals: 0,
      fastDismissals: 0,
    });
    if (e.type === "IMPRESSION") row.impressions += 1;
    else if (e.type === "SUBMISSION") row.submissions += 1;
    else if (e.type === "DISMISSED") {
      row.dismissals += 1;
      if (typeof e.dismissAfterMs === "number" && e.dismissAfterMs < FAST_DISMISS_MS) {
        row.fastDismissals += 1;
      }
    }
  }
  return out;
}
