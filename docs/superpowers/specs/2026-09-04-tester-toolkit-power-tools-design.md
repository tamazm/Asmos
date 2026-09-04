# Tester Toolkit Power Tools — Design

**Date:** 2026-09-04
**Status:** Approved design, pre-implementation
**Author:** brainstormed with Claude

## Problem

The superadmin `TesterToolkit` (`src/components/TesterToolkit.tsx` + `src/app/api/testing/route.ts`)
today does exactly two crude things: inject N impressions with a flat ~20%
conversion favoring one variant, and trigger a knockout evaluation. That is
enough to smoke-test the plumbing but useless for answering the questions that
actually matter about the system:

- Does the bandit + knockout behave sensibly under **realistic, mixed traffic**
  (a real base conversion rate, a real winner lift, fast-dismissers, device/intent mix)?
- When generation runs many times, do variants stay **genuinely different**, or
  do they get repetitive / copy each other / collapse onto one mode?
- Where does generation **time** actually go — queue wait, AI thinking, structuring, saving?

## Guiding principle

**The UI stays dumb; the power lives underneath.** Each tool is a simple button
(plus at most a couple of sliders/chips). All the intelligence lives in new,
pure, testable engine modules under `lib/testing/`. Everything remains behind the
existing `requireSuperadmin()` gate on `/api/testing`.

## Scope

Three tools, built together:

1. **Test under traffic** — realistic traffic simulator driving the real bandit + knockout.
2. **Diversity harness** — generate N variants, measure whether they repeat / copy each other.
3. **Generation timing analytics** — per-stage timing of the generation pipeline.

**Out of scope:** shopper-side widget render timing (initialize/paint in the
browser); segment-*aware* allocation (device/intent are flavor only, they do not
change bandit math yet); any non-superadmin exposure.

---

## Architecture

- **UI** — `TesterToolkit.tsx` grows three buttons and minimal controls. No logic.
- **API** — extend the existing `action` union on `/api/testing`:
  `simulate_traffic`, `clear_sim_data`, `analyze_diversity`, `gen_timing`.
  (Existing `inject` / `trigger_knockout` stay.)
- **Engines** (new):
  - `lib/testing/trafficSim.ts`
  - `lib/testing/diversity.ts`
  - `lib/testing/genTiming.ts`
- **Schema** — one new Prisma model, `GenerationTrace` (migration required).

Each engine's core is a **pure function** (config + inputs → result) with a thin
DB-writing wrapper, so the simulation/analysis logic is unit-testable without a
database.

---

## 1. Test under traffic

### Controls (UI)
- **Volume** slider — total impressions to simulate (e.g. 100–50,000).
- **Base CVR** slider — honest average conversion rate (e.g. 4%).
- **Winner lift** — how much better the "true best" arm is, so there is a real
  signal to find (e.g. +50%). Option to pick the secret winner or randomize.
- **Fast-dismiss %** — share of impressions bounced in <2s (feeds the bandit's
  quality factor via `dismissAfterMs`).
- **Device mix** and **Intent mix** chips — flavor; each segment nudges CVR.
- **Waves** knob — how many re-allocation checkpoints across the run (default 5).

### Engine (`lib/testing/trafficSim.ts`)

Pure, seeded, deterministic:

```
type SimConfig = {
  seed: number;
  volume: number;
  baseCvr: number;          // 0..1
  winnerLiftPct: number;    // e.g. 50 => winner converts 1.5x base
  trueWinnerId?: string;    // omit => random among arms
  fastDismissRate: number;  // 0..1
  deviceMix: Record<"mobile"|"desktop"|"tablet", number>;
  intentMix: Record<"browsing"|"high_intent"|"exit", number>;
  waves: number;
};

type SimEvent = {
  variantId: string;
  type: "IMPRESSION" | "SUBMISSION" | "DISMISSED";
  device: string;
  intent: string;
  dismissAfterMs?: number;
};

// Pure: produces the event plan for one wave given the CURRENT allocation.
function planWave(config, arms, allocation, waveIndex): SimEvent[];
```

Rules:
- Impressions per arm in a wave are distributed **by each arm's current
  `trafficPercent`** — so the sim exercises the real split and can even trip
  `detectSampleRatioMismatch`.
- Per-event conversion probability = `baseCvr × armTrueQuality × deviceFactor × intentFactor`.
  `armTrueQuality` is 1.0 for normal arms and `1 + winnerLiftPct/100` for the
  secret winner. Device/intent factors are small fixed multipliers (e.g. mobile
  0.85, high-intent 1.4) so the aggregate is realistic, never uniform.
- A `fastDismissRate` share of non-converting impressions emit a `DISMISSED`
  event with a `dismissAfterMs` drawn to straddle the 2s `FAST_DISMISS_MS`
  boundary (a realistic mix of reflex and considered dismissals).

DB-writing wrapper `runTrafficSimulation`:
- For each wave: `planWave` → `createMany` (every event tagged
  `details: { sim: true, device, intent, dismissAfterMs }`) →
  `recomputeCampaignAllocation(anyVariantId, { force: true })`.
- After the final wave, optionally `inngest.send({ name: "campaign.evaluate" })`.
- Returns a **per-wave timeline**: per-arm impressions/conversions/CVR, the
  allocation after each wave, SRM status, and whether a knockout was triggered.

### Required change to `lib/bandit.ts`
`recomputeCampaignAllocation` gains an options arg `{ force?: boolean }` that
bypasses the `RECOMPUTE_THROTTLE_MS` guard. All waves run inside one sub-second
request, so without this every wave after the first would be throttled out. The
throttle behavior is unchanged for all existing callers (default `force: false`).

### Cleanup — `clear_sim_data`
Deletes all `CampaignEvent` rows for the campaign where `details.sim = true`,
then force-recomputes allocation. Simulated runs therefore never permanently
pollute a real campaign's analytics. The UI surfaces this as a "Clear simulated
data" button and shows the count removed.

---

## 2. Diversity harness

**Layered.** Answers "do generated variants repeat / copy each other / stay
genuinely different" without paying for 100 real AI generations.

### Tier A — structural diversity (free, all N)
Engine runs the **real** brief pipeline (`buildVariantBriefs` /
`buildDesignBrief` from `lib/designBrief.ts`) N times, **feeding novelty memory
forward** across iterations (accumulating `recentFingerprints` the way a real
account's history would), so we specifically test whether the avoid-list keeps
successive generations apart.

Collect N briefs (fingerprint + full locked DNA). Metrics:
- **Pairwise `dnaDistance`** over fingerprints → mean and min nearest-neighbor
  distance; **% of pairs below the 0.6 "too-similar" threshold** that
  `buildDesignBrief` itself targets.
- **Exact-fingerprint collision count** (structurally identical draws).
- **Per-knob coverage / entropy** — for each DNA axis (art_direction, template_id,
  timer_mode, …), how evenly the N draws cover the option space. Directly answers
  "do they get repetitive" (e.g. "timer_mode is 'none' 88% of the time" — expected;
  "art_direction is 'glass' 70%" — a problem).
- **Copying signal** = the nearest-neighbor distance distribution; a cluster of
  near-zero NN distances means arms are cloning each other.

### Tier B — copy / text repetition (real AI, small opt-in batch, default 10)
Gated behind an explicit toggle (costs money / rate-limited). Calls
`generatePopupWithVariants`, extracts headline/subhead/CTA, measures:
- **Headline pairwise similarity** (Jaccard over token n-grams + normalized edit
  distance) — catches "Get 15% Off Your First Order" clones.
- **Banned-opener / banned-word hit rate** against the `COPY_DISCIPLINE` list in
  `designBrief.ts` — are the guardrails holding?
- **Subhead-restates-headline rate** — token overlap between headline and subhead
  (the single failure the whole brief system is built to prevent).

### Output
A plain-language verdict plus drill-down matrices, e.g.:
> Structural: 96/100 unique, mean NN distance 0.71, 2% of pairs too close,
> art_direction coverage even, timer_mode 88% 'none' (expected).
> Copy (10 sampled): 0 exact headline dupes, max Jaccard 0.34, 1 subhead-restate.

Pure analysis — writes nothing to the DB (an optional saved report is a possible
later addition, not in this scope).

---

## 3. Generation timing analytics

**Assumption:** the *generation pipeline*, not the shopper-side widget.

### Schema — new model `GenerationTrace`
```
model GenerationTrace {
  id           String   @id @default(cuid())
  campaignId   String
  campaign     Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  round        Int
  kind         String   // "generate" | "knockout"
  queueMs      Int?     // enqueue -> function start
  initializeMs Int?     // fetch-campaign
  aiThinkingMs Int?     // the generate-ai model step
  structuringMs Int?
  savingMs     Int?
  totalMs      Int?
  succeeded    Boolean  @default(true)
  createdAt    DateTime @default(now())

  @@index([campaignId, createdAt])
}
```
Migration required (consistent with the pending prisma work already tracked for prod).

### Instrumentation
- Stamp an **enqueue timestamp** when we `inngest.send({ name: "campaign.generate" })`
  (in the event `data.enqueuedAt`), so the function can compute `queueMs` from its
  own start time.
- In `generateCampaign` (and optionally `evaluateKnockout`), record elapsed ms at
  each boundary — initialize (fetch-campaign), AI thinking (the `generate-ai`
  step), structuring, saving — and write one `GenerationTrace` row at the end.
  Timing capture is best-effort: a failed trace write must never fail generation.

### Tool (`lib/testing/genTiming.ts` + `gen_timing` action)
Reads the most recent traces and returns **p50 / p95 per stage** plus the raw
recent rows. UI shows the breakdown (queue wait / initialize / AI thinking /
structuring / saving). Optional "run a timed generation now" button kicks a real
generation and reports its trace when it lands.

---

## Testing strategy

- **Unit (no DB):** `planWave` conversion math and segment factors; wave impression
  distribution matches allocation; `dnaDistance` metric aggregation (mean/min/NN,
  too-close %); per-knob entropy; headline similarity + subhead-restate heuristics.
- **Integration:** `runTrafficSimulation` writes correctly-tagged events and shifts
  allocation across waves; `clear_sim_data` removes exactly the `sim:true` rows and
  leaves real events untouched; `recomputeCampaignAllocation({ force })` bypasses the
  throttle without changing default behavior; a real generation writes a
  `GenerationTrace` with sane stage timings.
- **Auth:** every new action rejects non-superadmins (reuses `requireSuperadmin`).

## Files touched

New:
- `src/lib/testing/trafficSim.ts`
- `src/lib/testing/diversity.ts`
- `src/lib/testing/genTiming.ts`
- Prisma migration for `GenerationTrace`.

Modified:
- `src/app/api/testing/route.ts` — new actions.
- `src/components/TesterToolkit.tsx` — new buttons/controls.
- `src/lib/bandit.ts` — `force` option on `recomputeCampaignAllocation`.
- `src/lib/inngest/generateCampaign.ts` — timing capture + enqueue stamp.
- (optional) `src/lib/inngest/evaluateKnockout.ts` — timing capture.
- `prisma/schema.prisma` — `GenerationTrace` model.
