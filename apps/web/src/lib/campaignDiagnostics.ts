/**
 * lib/campaignDiagnostics.ts
 *
 * Merchant-facing read of *why* a popup is or isn't converting.
 *
 * The dashboard used to show impressions and conversion rate and nothing else,
 * which tells a merchant that something is wrong but never what. The widget has
 * been recording the missing half for a while - per-session interaction
 * telemetry (dead clicks, rage clicks, field abandonment, CTA hesitation,
 * time-to-first-keystroke) and a per-event intent score - but until now it was
 * only ever read by the popup generator and PostHog. This module turns those
 * same rows into plain-language findings for the person paying for the product.
 *
 * Reads Postgres (`CampaignEvent.details`) rather than the PostHog Query API on
 * purpose: this is customer-facing, and it must not go blank for accounts whose
 * PostHog keys aren't configured. `CampaignEvent` is always written, PostHog is
 * a mirror - see the comment in /api/widget/events.
 *
 * Deliberately self-contained. The equivalent logic in popupGeneration.ts drags
 * in the Anthropic / Bedrock / Gemini SDKs at module scope, and importing it
 * here would load all three onto a dashboard page render.
 */

import { classifyUserIntent, userIntentLevelFromScore, type UserIntentLevel } from "@/lib/userIntent";

// ─── Thresholds ──────────────────────────────────────────────────────────────
// These mirror popupGeneration.ts's classifyFailurePatterns on purpose: what a
// merchant reads here has to match what the generator acts on, or the dashboard
// explains one problem while the AI fixes another. Keep the two in sync.
const UX_SIGNAL_THRESHOLD = 0.12;
const CTA_HESITATION_MS = 2_500;
const SLOW_FIRST_KEYSTROKE_MS = 12_000;
const QUICK_DISMISS_MS = 2_000;

/** Below this many measured sessions, findings are shown as early signals. */
const MIN_SESSIONS_FOR_CONFIDENCE = 30;

/** A conversion rate under this, with high-intent traffic, reads as friction. */
const LOW_CONVERSION_RATE = 0.02;
const HIGH_INTENT_AUDIENCE_RATE = 0.4;
const LOW_INTENT_AUDIENCE_RATE = 0.15;

// ─── Types ───────────────────────────────────────────────────────────────────

/** The subset of a CampaignEvent row this module needs. */
export type DiagnosticEvent = {
  id: string;
  type: string;
  visitorId: string | null;
  details: unknown;
};

export type IntentMix = {
  /** Visitors we could attribute an intent score to (needs a visitorId). */
  trackedVisitors: number;
  low: number;
  medium: number;
  high: number;
  /** Share of tracked visitors whose strongest demonstrated score reached 60+. */
  highRate: number;
  averageScore: number | null;
  /** Events that carried intent data but no visitorId, so could not be attributed. */
  unattributedEvents: number;
};

export type FrictionKey =
  | "cant_find_the_cta"
  | "interaction_rage"
  | "field_abandonment"
  | "cta_hesitation"
  | "slow_to_engage"
  | "premature_dismissal";

export type FrictionFinding = {
  key: FrictionKey;
  /** What happened, in the merchant's language. */
  headline: string;
  /** What it means about the popup. */
  meaning: string;
  /** The concrete change that addresses it. */
  fix: string;
  sessions: number;
  /** Share of the denominator below showing this, 0..1. */
  rate: number;
  /** What the rate is a share of - dismissal-based findings don't use sessions. */
  denominator: "sessions" | "dismissals";
  severity: "high" | "medium" | "low";
};

export type DiagnosticVerdict = {
  tone: "healthy" | "friction" | "reach" | "unknown";
  headline: string;
  detail: string;
};

export type VariantDiagnostics = {
  variantId: string;
  intent: IntentMix;
  /** Sessions that reported interaction telemetry (one summary per popup view). */
  measuredSessions: number;
  findings: FrictionFinding[];
  medianSecondsToFirstKeystroke: number | null;
  verdict: DiagnosticVerdict;
};

// ─── Session telemetry ───────────────────────────────────────────────────────

type SessionSummary = {
  step?: number | string;
  deadClicks?: number;
  rageClicks?: number;
  abandonedField?: boolean;
  ctaHoverNoClickMs?: number;
  timeToFirstKeystrokeMs?: number | null;
  fieldFocusCount?: number;
  typedChars?: number;
  reachedStep?: number;
  converted?: boolean;
  dismissAfterMs?: number;
  userIntentScore?: number;
};

const EMPTY_INTENT: IntentMix = {
  trackedVisitors: 0,
  low: 0,
  medium: 0,
  high: 0,
  highRate: 0,
  averageScore: null,
  unattributedEvents: 0,
};

function asSummary(details: unknown): SessionSummary {
  return (details ?? {}) as SessionSummary;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

// ─── Intent ──────────────────────────────────────────────────────────────────

/**
 * One cohort per *visitor*, not per event. A visitor climbs from low to high
 * across a single session, so counting every intermediate event separately
 * would report one interested person as several bored ones.
 *
 * Events with no visitorId are counted but not attributed: pre-visitorId rows
 * and any traffic from an outdated widget.js genuinely cannot be resolved to a
 * person, and silently treating each of those events as its own visitor would
 * inflate the denominator and drag every cohort toward "low".
 */
export function summarizeIntent(events: DiagnosticEvent[]): IntentMix {
  const bestByVisitor = new Map<string, number>();
  let unattributedEvents = 0;

  for (const event of events) {
    const details = asSummary(event.details);
    const stored = details.userIntentScore;
    const score =
      typeof stored === "number"
        ? stored
        : classifyUserIntent({
            eventType: event.type,
            step: details.step,
            deadClicks: details.deadClicks,
            rageClicks: details.rageClicks,
            fieldFocusCount: details.fieldFocusCount,
            timeToFirstKeystrokeMs: details.timeToFirstKeystrokeMs,
            typedChars: details.typedChars,
            abandonedField: details.abandonedField,
            ctaHoverNoClickMs: details.ctaHoverNoClickMs,
            reachedStep: details.reachedStep,
            converted: details.converted,
            dismissAfterMs: details.dismissAfterMs,
          }).score;

    if (!event.visitorId) {
      unattributedEvents += 1;
      continue;
    }
    bestByVisitor.set(event.visitorId, Math.max(bestByVisitor.get(event.visitorId) ?? 0, score));
  }

  const scores = [...bestByVisitor.values()];
  if (scores.length === 0) return { ...EMPTY_INTENT, unattributedEvents };

  const counts: Record<UserIntentLevel, number> = { low: 0, medium: 0, high: 0 };
  for (const score of scores) counts[userIntentLevelFromScore(score)] += 1;

  const total = scores.length;
  return {
    trackedVisitors: total,
    low: counts.low,
    medium: counts.medium,
    high: counts.high,
    highRate: counts.high / total,
    averageScore: Math.round((scores.reduce((sum, s) => sum + s, 0) / total) * 10) / 10,
    unattributedEvents,
  };
}

// ─── Friction ────────────────────────────────────────────────────────────────

type FrictionCopy = Omit<FrictionFinding, "sessions" | "rate" | "denominator" | "severity">;

const FRICTION_COPY: Record<FrictionKey, FrictionCopy> = {
  cant_find_the_cta: {
    key: "cant_find_the_cta",
    headline: "Visitors clicked things that aren't clickable",
    meaning:
      "They wanted to act but couldn't tell what the button was. Something in the design reads as interactive when it isn't.",
    fix: "Make the button unmistakably a button - stronger contrast, more padding, and no other element styled to compete with it.",
  },
  interaction_rage: {
    key: "interaction_rage",
    headline: "Visitors clicked the same spot over and over",
    meaning: "Something looked broken or unresponsive. This is frustration, not interest.",
    fix: "Check the popup on a real phone. Repeated clicking usually means a tap target that doesn't respond or a form that silently fails.",
  },
  field_abandonment: {
    key: "field_abandonment",
    headline: "Visitors opened the email field, then left without typing",
    meaning:
      "The offer worked - the ask didn't. They got as far as the field and reconsidered giving you their address.",
    fix: "Reassure at the point of hesitation: a short privacy line under the field, and restate the reward next to it rather than on the previous step.",
  },
  cta_hesitation: {
    key: "cta_hesitation",
    headline: "Visitors read the button but didn't click",
    meaning: "They considered it and weren't convinced. This is a copy problem, not a layout one.",
    fix: "Rewrite the button to name what they get (\"Get my 10% off\") instead of what they do (\"Submit\"), and restate the value beside it.",
  },
  slow_to_engage: {
    key: "slow_to_engage",
    headline: "Visitors took a long time before typing anything",
    meaning: "There's too much to read before they can act. The popup is asking them to process rather than respond.",
    fix: "Cut the word count, raise the headline size, and let the offer land in one glance.",
  },
  premature_dismissal: {
    key: "premature_dismissal",
    headline: "Visitors closed the popup almost immediately",
    meaning:
      "It arrived before they were ready. Under two seconds is a reflex dismissal, not a judgement of the offer.",
    fix: "Delay the trigger, or switch to exit-intent or a scroll-depth trigger so it appears after they've engaged with the page.",
  },
};

function severityFor(rate: number, measuredSessions: number): FrictionFinding["severity"] {
  if (measuredSessions < MIN_SESSIONS_FOR_CONFIDENCE) return "low";
  if (rate >= 0.3) return "high";
  if (rate >= 0.15) return "medium";
  return "low";
}

function finding(
  key: FrictionKey,
  sessions: number,
  measuredSessions: number,
): FrictionFinding {
  const rate = measuredSessions > 0 ? sessions / measuredSessions : 0;
  return {
    ...FRICTION_COPY[key],
    sessions,
    rate,
    denominator: "sessions",
    severity: severityFor(rate, measuredSessions),
  };
}

// ─── Public entry point ──────────────────────────────────────────────────────

export function summarizeVariantDiagnostics(input: {
  variantId: string;
  events: DiagnosticEvent[];
  impressions: number;
  submissions: number;
}): VariantDiagnostics {
  const { variantId, events, impressions, submissions } = input;

  // The runtime emits exactly one INTERACTION with step "session_summary" per
  // popup view (see lib/templates/runtime.ts flushTelemetry), which is what
  // makes "share of sessions" a meaningful denominator here.
  const summaries: SessionSummary[] = [];
  const dismissTimings: number[] = [];

  for (const event of events) {
    const details = asSummary(event.details);
    if (event.type === "INTERACTION" && details.step === "session_summary") {
      summaries.push(details);
    }
    if (event.type === "DISMISSED" && typeof details.dismissAfterMs === "number") {
      dismissTimings.push(details.dismissAfterMs);
    }
  }

  const measuredSessions = summaries.length;
  const keystrokeTimes = summaries
    .map((s) => s.timeToFirstKeystrokeMs)
    .filter((ms): ms is number => typeof ms === "number" && ms >= 0);
  const medianKeystrokeMs = median(keystrokeTimes);

  const candidates: Array<{ key: FrictionKey; sessions: number; threshold: number }> = [
    {
      key: "cant_find_the_cta",
      sessions: summaries.filter((s) => (s.deadClicks ?? 0) > 0).length,
      threshold: UX_SIGNAL_THRESHOLD,
    },
    {
      key: "interaction_rage",
      sessions: summaries.filter((s) => (s.rageClicks ?? 0) > 0).length,
      threshold: UX_SIGNAL_THRESHOLD / 2,
    },
    {
      key: "field_abandonment",
      sessions: summaries.filter((s) => s.abandonedField === true).length,
      threshold: UX_SIGNAL_THRESHOLD,
    },
    {
      key: "cta_hesitation",
      sessions: summaries.filter((s) => (s.ctaHoverNoClickMs ?? 0) > CTA_HESITATION_MS).length,
      threshold: UX_SIGNAL_THRESHOLD * 1.5,
    },
  ];

  const findings = candidates
    .filter((c) => measuredSessions > 0 && c.sessions / measuredSessions > c.threshold)
    .map((c) => finding(c.key, c.sessions, measuredSessions));

  if (medianKeystrokeMs !== null && medianKeystrokeMs > SLOW_FIRST_KEYSTROKE_MS) {
    findings.push(finding("slow_to_engage", keystrokeTimes.length, measuredSessions));
  }

  // Dismissals have their own denominator - every dismissal is measured, but
  // not every dismissal produces a session summary.
  const quickDismissals = dismissTimings.filter((ms) => ms < QUICK_DISMISS_MS).length;
  if (dismissTimings.length > 0 && quickDismissals / dismissTimings.length > 0.3) {
    const rate = quickDismissals / dismissTimings.length;
    findings.push({
      ...FRICTION_COPY.premature_dismissal,
      sessions: quickDismissals,
      rate,
      denominator: "dismissals",
      severity: severityFor(rate, dismissTimings.length),
    });
  }

  findings.sort((a, b) => b.rate - a.rate);

  const intent = summarizeIntent(events);
  const conversionRate = impressions > 0 ? submissions / impressions : 0;

  return {
    variantId,
    intent,
    measuredSessions,
    findings,
    medianSecondsToFirstKeystroke:
      medianKeystrokeMs === null ? null : Math.round(medianKeystrokeMs / 100) / 10,
    verdict: buildVerdict({ intent, conversionRate, measuredSessions, findings, impressions }),
  };
}

function buildVerdict(input: {
  intent: IntentMix;
  conversionRate: number;
  measuredSessions: number;
  findings: FrictionFinding[];
  impressions: number;
}): DiagnosticVerdict {
  const { intent, conversionRate, measuredSessions, findings, impressions } = input;

  if (impressions < MIN_SESSIONS_FOR_CONFIDENCE) {
    return {
      tone: "unknown",
      headline: "Not enough traffic to read yet",
      detail: `This variant needs around ${MIN_SESSIONS_FOR_CONFIDENCE} impressions before the behaviour below means anything. It has ${impressions.toLocaleString()}.`,
    };
  }

  if (intent.trackedVisitors === 0 && measuredSessions === 0) {
    return {
      tone: "unknown",
      headline: "No behavioural data recorded",
      detail:
        "This variant has traffic but no interaction telemetry. That usually means the widget script on the site predates behavioural tracking - reinstall it to start collecting.",
    };
  }

  const top = findings[0];

  if (intent.highRate >= HIGH_INTENT_AUDIENCE_RATE && conversionRate < LOW_CONVERSION_RATE) {
    return {
      tone: "friction",
      headline: "You're reaching interested people and losing them",
      detail: top
        ? `${Math.round(intent.highRate * 100)}% of visitors showed strong intent but only ${(conversionRate * 100).toFixed(1)}% converted. The gap is the popup, not the audience - start with "${top.headline.toLowerCase()}".`
        : `${Math.round(intent.highRate * 100)}% of visitors showed strong intent but only ${(conversionRate * 100).toFixed(1)}% converted. The offer is landing; something between interest and submit is not.`,
    };
  }

  if (intent.trackedVisitors > 0 && intent.highRate < LOW_INTENT_AUDIENCE_RATE) {
    return {
      tone: "reach",
      headline: "Most visitors never engage with this popup",
      detail: `Just ${intent.high.toLocaleString()} of ${intent.trackedVisitors.toLocaleString()} scored visitors reached high intent. Fixing the form won't move this - it's a question of when the popup appears and whether the offer is relevant to the page it appears on.`,
    };
  }

  if (top && top.severity === "high") {
    return {
      tone: "friction",
      headline: top.headline,
      detail: `${Math.round(top.rate * 100)}% of measured sessions show this. ${top.fix}`,
    };
  }

  return {
    tone: "healthy",
    headline: "No dominant friction signal",
    detail:
      "Intent and behaviour look reasonable for this variant. Further gains are more likely to come from the offer itself than from the popup mechanics.",
  };
}

/** Convenience wrapper for a whole campaign, keyed by variant id. */
export function summarizeCampaignDiagnostics(
  variants: Array<{ id: string; events: DiagnosticEvent[]; impressions: number; submissions: number }>,
): Record<string, VariantDiagnostics> {
  const out: Record<string, VariantDiagnostics> = {};
  for (const variant of variants) {
    out[variant.id] = summarizeVariantDiagnostics({
      variantId: variant.id,
      events: variant.events,
      impressions: variant.impressions,
      submissions: variant.submissions,
    });
  }
  return out;
}
