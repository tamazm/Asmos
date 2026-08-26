import "server-only";

type PostHogCaptureEvent = {
  event: string;
  distinctId: string;
  properties?: Record<string, unknown>;
  timestamp?: string;
};

const captureHost = (process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com").replace(/\/$/, "");
const queryHost = (
  process.env.POSTHOG_QUERY_HOST ??
  captureHost.replace("://eu.i.posthog.com", "://eu.posthog.com").replace("://us.i.posthog.com", "://us.posthog.com")
).replace(/\/$/, "");

export function isPostHogCaptureConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);
}

export function isPostHogQueryConfigured(): boolean {
  return Boolean(process.env.POSTHOG_PERSONAL_API_KEY && process.env.POSTHOG_PROJECT_ID);
}

/** Escape a value used as a HogQL string literal. */
export function hogqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export async function capturePostHogEvents(events: PostHogCaptureEvent[]): Promise<void> {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!apiKey || events.length === 0) return;

  const response = await fetch(`${captureHost}/batch/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      batch: events.map(({ event, distinctId, properties, timestamp }) => ({
        event,
        properties: {
          ...properties,
          distinct_id: distinctId,
        },
        timestamp: timestamp ?? new Date().toISOString(),
      })),
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`PostHog capture failed: ${response.status}`);
  }
}

export async function queryPostHog<T = unknown>(hogql: string): Promise<T[]> {
  const personalApiKey = process.env.POSTHOG_PERSONAL_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID;
  if (!personalApiKey || !projectId) {
    throw new Error("PostHog Query API is not configured");
  }

  const response = await fetch(`${queryHost}/api/projects/${encodeURIComponent(projectId)}/query/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${personalApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query: hogql } }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`PostHog query failed: ${response.status}`);
  }

  const data = (await response.json()) as { results?: T[] };
  return data.results ?? [];
}
