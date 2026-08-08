# AI Popup Variation & Learning Roadmap

Written after auditing the current generation pipeline end to end (widget.js → `/api/widget/events` → PostHog → `fetchVariantAnalytics` → `popupGeneration.ts` → template renderer). Covers the two gaps identified: popups aren't visually varied enough, and the system doesn't learn from detailed behavioral data.

## Where things stand today

Confirmed working:
- Per-campaign A/B loop: `evaluateKnockout.ts` reads real conversion data and generates a new variant targeting the next-highest-leverage untested axis. Reachable on all plan tiers as of the latest limits fix.
- Basic behavioral capture: `widget.js` collects scroll depth, time-on-page, referrer, UTMs, and dismiss-after-ms, and forwards them to PostHog.

Confirmed gaps (this roadmap addresses all of them):
- One physical popup template (`renderSplitScreenTemplate`); AI only picks among 4 CSS layout variants of it.
- All visitors of a variant share one PostHog `distinct_id` (keyed by `variantId`), which breaks funnels/cohorts/replay.
- No session replay, rage-click, or dead-click detection — nothing that surfaces "people can't find the button."
- `INTERACTION` (partial engagement) events aren't fired at all in the current AI-template widget path.
- Rich behavioral fields (scroll depth, dismiss timing, UTMs) reach PostHog but are never read back — `AnalyticsVariant` only carries impressions/conversion_rate/dismiss_rate/significance_flag.
- Postgres has no fallback storage for any of this — `CampaignEvent` is just `{type, createdAt}`.
- The system prompt (`POPUP_GENERATION_SYSTEM_PROMPT`) is static; nothing learns across accounts/campaigns over time.

## Phase 0 — Data integrity fixes

Foundational, cheap, and everything downstream depends on this being correct first. Bad or missing data here poisons every later phase.

- Fix the PostHog `distinct_id`: generate and persist a real per-visitor id (e.g. a first-party cookie set by `widget.js`) instead of `widget_visitor_${variantId}`. Without this, no funnel, cohort, or replay feature downstream will ever produce trustworthy results.
- Wire `INTERACTION` and step-level events into the *current* AI-template path in `widget.js` (today it's only implemented in the legacy inline-card path). At minimum: teaser CTA clicked (step 1 → 2), email field focused, step 2 → 3 transition.
- Persist behavioral context server-side, not just forward-and-forget to PostHog. Add columns (or a JSON blob) to `CampaignEvent`, or a new `CampaignEventDetail` table, for `scrollDepthPct`, `dismissAfterMs`, `stepReached`, referrer/UTMs. This also makes the Postgres fallback path (when PostHog isn't configured) actually useful.
- Extend `fetchVariantAnalytics()` / `AnalyticsVariant` to surface this detail (avg dismiss-time, step-drop-off distribution) instead of just the four current aggregate numbers.

## Phase 1 — Real qualitative signal capture

Turns "conversion went down" into "people open it, see the offer, but abandon at the email field" — the kind of detail needed to reason like a CRO expert.

- Load `posthog-js` properly in the injected widget with session recording enabled, gated behind the existing GDPR/CCPA consent banner (already built — just needs wiring).
- Rage-click / dead-click detection on the CTA and form elements (PostHog supports this natively once the real SDK + recording is in place).
- Full per-step funnel instrumentation for the teaser → capture → reveal flow (extends Phase 0's step events into a proper funnel view).
- Field-level abandonment tracking: focused vs. completed, per field.
- Define a small set of named "failure patterns" from combinations of the above, e.g.:
  - high impressions + low step-2 entry → offer isn't compelling or isn't noticed
  - high step-2 entry + low submit → form friction or trust issue
  - near-zero `dismissAfterMs` at high volume → popup is firing at the wrong time / feels intrusive
  - high step-1 → step-2 clicks but rage clicks on the CTA → button/target itself has a UX problem (the literal "can't find/use the button" case)

## Phase 2 — Feed rich signals into the per-campaign loop

- Extend `buildPopupInput`/`AnalyticsVariant` to carry the new structured signals from Phase 0/1.
- Extend the system prompt's variant-generation logic to reason over funnel-step drop-off and named failure patterns, not just top-line conversion/dismiss rate.
- Have `motivating_metric` cite the specific behavioral pattern, not just a conversion delta (e.g. "62% of visitors abandon at the email field — testing a one-field, no-name variant" instead of "email-only variant converting higher").

## Phase 3 — Template library expansion (visual variety)

Independent of the data work above — this is a design/engineering track that can run in parallel.

- Build 2–4 additional, structurally distinct templates: corner slide-in toast, full-screen takeover, top announcement bar, and a gamified wheel/scratch-card actually wired into the current AI generation path (campaign type already supports `WHEEL`/`SCRATCH_CARD`, but the AI-template engine never produces one today).
- Add a `template_id` to the AI's output schema (`popupSpecSchema`) alongside `layout_style`, so the model chooses *which template* in addition to which layout within it.
- Add a renderer dispatch layer (today there's only `renderSplitScreenTemplate`) that routes by `template_id`.
- Update the system prompt's blueprint section with per-template guidance (when a takeover beats a corner toast, etc.).

## Phase 4 — Cross-account learning ("guidelines get smarter")

The highest-effort, most novel piece. Needs real traffic history from Phases 0–2 before it's worth building — there's nothing to learn from yet.

- Periodic job that aggregates anonymized outcomes across accounts/campaigns (reuse the failure-pattern taxonomy from Phase 1).
- Apply real statistical rigor — minimum sample sizes and confidence thresholds — before treating any pattern as signal (same bar `computeSignificanceFlag` already applies per-campaign, just at a global scale).
- Decide the injection mechanism into `POPUP_GENERATION_SYSTEM_PROMPT`:
  - human-reviewed prompt updates (safest, slowest), or
  - a dynamically injected "learned playbook" section, versioned, auto-updated on a schedule, or
  - hybrid: auto-mine candidate patterns, human approves before they ship.
- Start with the hybrid/human-gated option — fully automatic prompt mutation with no review is a real risk (a bad pattern with a false-positive significance result would degrade every customer's popups at once).

## Sequencing

Two parallel tracks:

- **Data track**: Phase 0 → Phase 1 → Phase 2 → Phase 4 (strictly sequential — each phase's output is the next phase's input; Phase 4 additionally needs real elapsed traffic time before it's useful).
- **Design track**: Phase 3 — no dependency on the data track, can start immediately alongside Phase 0.

Recommended starting point: Phase 0. It's well-defined, has no open product/design decisions, directly fixes a real bug (the shared `distinct_id`), and unblocks every later phase. Phases 1, 3, and 4 all involve decisions worth confirming first — session recording has privacy/consent implications beyond just flipping it on, new templates need design direction, and Phase 4's injection mechanism is a real product call.
