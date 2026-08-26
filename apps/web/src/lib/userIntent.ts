export const USER_INTENT_VERSION = 1;

export type UserIntentLevel = "low" | "medium" | "high";

export type UserIntentInput = {
  eventType: string;
  step?: number | string;
  scrollDepthPct?: number;
  timeOnPageSeconds?: number;
  dismissAfterMs?: number;
  deadClicks?: number;
  rageClicks?: number;
  fieldFocusCount?: number;
  timeToFirstKeystrokeMs?: number | null;
  typedChars?: number;
  abandonedField?: boolean;
  ctaHoverNoClickMs?: number;
  scrolledInside?: boolean;
  reachedStep?: number;
  converted?: boolean;
};

export type UserIntent = {
  level: UserIntentLevel;
  score: number;
  signals: string[];
  version: typeof USER_INTENT_VERSION;
};

export function userIntentLevelFromScore(score: number): UserIntentLevel {
  if (score >= 60) return "high";
  if (score >= 30) return "medium";
  return "low";
}

/**
 * Transparent, deterministic intent scoring for popup visitors.
 *
 * The score describes demonstrated engagement, not personal identity or a
 * prediction about an individual. PostHog rolls the score up by visitor and
 * variant; the campaign-improvement generator uses those aggregate cohorts.
 */
export function classifyUserIntent(input: UserIntentInput): UserIntent {
  const eventType = input.eventType.toUpperCase();
  const signals: string[] = [];

  if (eventType === "SUBMISSION" || eventType === "GIFT_CLAIMED" || input.converted === true) {
    return {
      level: "high",
      score: 100,
      signals: ["converted"],
      version: USER_INTENT_VERSION,
    };
  }

  let score = 0;
  const add = (points: number, signal: string) => {
    score += points;
    signals.push(signal);
  };

  if (eventType === "INTERACTION") add(5, "popup_interaction");

  const timeOnPage = input.timeOnPageSeconds ?? 0;
  if (timeOnPage >= 120) add(20, "time_on_page_120s");
  else if (timeOnPage >= 45) add(14, "time_on_page_45s");
  else if (timeOnPage >= 15) add(7, "time_on_page_15s");

  const scrollDepth = input.scrollDepthPct ?? 0;
  if (scrollDepth >= 80) add(15, "scroll_depth_80");
  else if (scrollDepth >= 50) add(10, "scroll_depth_50");
  else if (scrollDepth >= 25) add(4, "scroll_depth_25");

  if (typeof input.step === "number" && input.step >= 2) {
    add(input.step >= 3 ? 20 : 12, `reached_step_${input.step}`);
  } else if (typeof input.step === "string") {
    const stepScores: Record<string, number> = {
      email_field_focus: 20,
      email_first_keystroke: 55,
      invalid_email_submit: 35,
      code_copied: 50,
    };
    const stepScore = stepScores[input.step];
    if (stepScore) add(stepScore, input.step);
  }

  if ((input.fieldFocusCount ?? 0) > 0) add(15, "focused_form_field");
  if ((input.typedChars ?? 0) > 0) add(35, "typed_in_form");
  if ((input.reachedStep ?? 0) >= 2) {
    add((input.reachedStep ?? 0) >= 3 ? 20 : 12, `summary_reached_step_${input.reachedStep}`);
  }
  if (input.timeToFirstKeystrokeMs !== null && input.timeToFirstKeystrokeMs !== undefined) {
    add(10, "started_typing");
  }
  if ((input.ctaHoverNoClickMs ?? 0) >= 800) add(8, "cta_consideration");
  if (input.scrolledInside) add(4, "scrolled_popup");
  if ((input.deadClicks ?? 0) > 0) add(3, "dead_click_engagement");
  if ((input.rageClicks ?? 0) > 0) add(3, "rage_click_engagement");
  if (input.abandonedField) add(8, "abandoned_focused_field");

  if (eventType === "DISMISSED" && (input.dismissAfterMs ?? Number.POSITIVE_INFINITY) < 2_000) {
    score -= 10;
    signals.push("quick_dismissal");
  }

  const boundedScore = Math.max(0, Math.min(100, Math.round(score)));
  return {
    level: userIntentLevelFromScore(boundedScore),
    score: boundedScore,
    signals,
    version: USER_INTENT_VERSION,
  };
}
