import "server-only";

import { hogqlString, isPostHogQueryConfigured, queryPostHog } from "@/lib/posthog-server";

export type AnalyticsMetric = "events" | "unique_visitors" | "average_intent";
export type AnalyticsBreakdown = "none" | "user_intent" | "campaign" | "variant" | "device" | "test_axis" | "utm_source";
export type AnalyticsRangeDays = 1 | 7 | 30 | 90;

export type SuperadminAnalyticsSelection = {
  event: string;
  metric: AnalyticsMetric;
  breakdown: AnalyticsBreakdown;
  rangeDays: AnalyticsRangeDays;
};

export type PostHogEventDefinition = {
  name: string;
  count: number;
  lastSeen: string;
};

export type RecentPostHogEvent = {
  timestamp: string;
  event: string;
  distinctId: string;
  campaignId: string;
  variantName: string;
  intentLevel: string;
  intentScore: number | null;
  device: string;
};

export type AnalyticsResultRow = {
  dimension: string;
  value: number | null;
};

export type SuperadminAnalyticsData = {
  configured: boolean;
  selection: SuperadminAnalyticsSelection;
  eventDefinitions: PostHogEventDefinition[];
  recentEvents: RecentPostHogEvent[];
  resultRows: AnalyticsResultRow[];
  errors: string[];
};

const DEFAULT_EVENT = "asmos_user_intent_scored";
const ASMOS_EVENT_FILTER = `(
  startsWith(event, 'asmos_')
  OR startsWith(event, 'widget_')
  OR event IN ('email_captured', 'campaign_created', 'popup_variant_auto_generated', 'popup_variant_eliminated')
)`;

const METRIC_EXPRESSIONS: Record<AnalyticsMetric, string> = {
  events: "count()",
  unique_visitors: "count(DISTINCT distinct_id)",
  average_intent: "round(avg(toFloat(properties.user_intent_score)), 1)",
};

const BREAKDOWN_EXPRESSIONS: Record<Exclude<AnalyticsBreakdown, "none">, string> = {
  user_intent: "coalesce(toString(properties.user_intent_level), 'unknown')",
  campaign: "coalesce(toString(properties.campaign_id), 'unknown')",
  variant: "coalesce(toString(properties.variant_name), 'unknown')",
  device: "coalesce(toString(properties.device), 'unknown')",
  test_axis: "coalesce(toString(properties.test_axis), 'unknown')",
  utm_source: "coalesce(toString(properties.utm_source), 'direct / unknown')",
};

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * PostHog returns aggregates as JSON numbers for counts but as strings for
 * ClickHouse Decimals (anything that went through `round(avg(...))`), so every
 * numeric column is coerced here rather than trusted from the tuple type.
 */
function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNum(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseSuperadminAnalyticsSelection(
  searchParams: Record<string, string | string[] | undefined>,
): SuperadminAnalyticsSelection {
  const event = one(searchParams.analyticsEvent)?.trim() || DEFAULT_EVENT;
  const metricCandidate = one(searchParams.analyticsMetric);
  const breakdownCandidate = one(searchParams.analyticsBreakdown);
  const rangeCandidate = Number(one(searchParams.analyticsRange));

  const metric = metricCandidate && metricCandidate in METRIC_EXPRESSIONS
    ? (metricCandidate as AnalyticsMetric)
    : "unique_visitors";
  const breakdown = breakdownCandidate && (breakdownCandidate === "none" || breakdownCandidate in BREAKDOWN_EXPRESSIONS)
    ? (breakdownCandidate as AnalyticsBreakdown)
    : "user_intent";
  const rangeDays = ([1, 7, 30, 90] as const).includes(rangeCandidate as AnalyticsRangeDays)
    ? (rangeCandidate as AnalyticsRangeDays)
    : 30;

  return { event, metric, breakdown, rangeDays };
}

async function safely<T>(label: string, query: Promise<T[]>): Promise<{ data: T[]; error?: string }> {
  try {
    return { data: await query };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown PostHog error";
    return { data: [], error: `${label}: ${detail}` };
  }
}

export async function getSuperadminAnalytics(
  selection: SuperadminAnalyticsSelection,
): Promise<SuperadminAnalyticsData> {
  if (!isPostHogQueryConfigured()) {
    return {
      configured: false,
      selection,
      eventDefinitions: [],
      recentEvents: [],
      resultRows: [],
      errors: [],
    };
  }

  const breakdownExpression = selection.breakdown === "none"
    ? null
    : BREAKDOWN_EXPRESSIONS[selection.breakdown];
  const builderQuery = breakdownExpression
    ? `
      SELECT ${breakdownExpression} AS dimension, ${METRIC_EXPRESSIONS[selection.metric]} AS value
      FROM events
      WHERE event = ${hogqlString(selection.event)}
        AND timestamp > now() - interval ${selection.rangeDays} day
      GROUP BY dimension
      ORDER BY value DESC
      LIMIT 50
    `
    : `
      SELECT 'All events' AS dimension, ${METRIC_EXPRESSIONS[selection.metric]} AS value
      FROM events
      WHERE event = ${hogqlString(selection.event)}
        AND timestamp > now() - interval ${selection.rangeDays} day
    `;

  const [definitions, recent, result] = await Promise.all([
    safely("Event catalog", queryPostHog<[string, number, string]>(`
      SELECT event, count() AS event_count, max(timestamp) AS last_seen
      FROM events
      WHERE ${ASMOS_EVENT_FILTER}
        AND timestamp > now() - interval 30 day
      GROUP BY event
      ORDER BY event_count DESC
      LIMIT 100
    `)),
    safely("Recent events", queryPostHog<[string, string, string, string, string, string, number | null, string]>(`
      SELECT
        toString(timestamp),
        event,
        distinct_id,
        coalesce(toString(properties.campaign_id), ''),
        coalesce(toString(properties.variant_name), ''),
        coalesce(toString(properties.user_intent_level), ''),
        if(properties.user_intent_score IS NULL, null, toFloat(properties.user_intent_score)),
        coalesce(toString(properties.device), '')
      FROM events
      WHERE ${ASMOS_EVENT_FILTER}
        AND timestamp > now() - interval 90 day
      ORDER BY timestamp DESC
      LIMIT 75
    `)),
    safely("Analytics builder", queryPostHog<[string, number | null]>(builderQuery)),
  ]);

  return {
    configured: true,
    selection,
    eventDefinitions: definitions.data.map(([name, count, lastSeen]) => ({ name, count: num(count), lastSeen })),
    recentEvents: recent.data.map(([
      timestamp,
      event,
      distinctId,
      campaignId,
      variantName,
      intentLevel,
      intentScore,
      device,
    ]) => ({
      timestamp,
      event,
      distinctId,
      campaignId,
      variantName,
      intentLevel,
      intentScore: nullableNum(intentScore),
      device,
    })),
    resultRows: result.data.map(([dimension, value]) => ({ dimension, value: nullableNum(value) })),
    errors: [definitions.error, recent.error, result.error].filter((error): error is string => Boolean(error)),
  };
}
