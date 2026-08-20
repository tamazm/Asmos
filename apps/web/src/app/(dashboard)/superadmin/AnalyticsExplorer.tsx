import type {
  AnalyticsBreakdown,
  AnalyticsMetric,
  SuperadminAnalyticsData,
} from "@/lib/superadmin-analytics";

const METRICS: Array<{ value: AnalyticsMetric; label: string }> = [
  { value: "unique_visitors", label: "Unique visitors" },
  { value: "events", label: "Event count" },
  { value: "average_intent", label: "Average intent score" },
];

const BREAKDOWNS: Array<{ value: AnalyticsBreakdown; label: string }> = [
  { value: "user_intent", label: "User intent" },
  { value: "campaign", label: "Campaign" },
  { value: "variant", label: "Variant" },
  { value: "device", label: "Device" },
  { value: "test_axis", label: "Test axis" },
  { value: "utm_source", label: "UTM source" },
  { value: "none", label: "No breakdown" },
];

function intentClass(level: string): string {
  if (level === "high") return "bg-emerald-100 text-emerald-700";
  if (level === "medium") return "bg-amber-100 text-amber-700";
  if (level === "low") return "bg-slate-100 text-slate-600";
  return "bg-gray-100 text-gray-500";
}

function displayTime(timestamp: string): string {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? timestamp : date.toLocaleString();
}

export function AnalyticsExplorer({ data }: { data: SuperadminAnalyticsData }) {
  const events = new Set(data.eventDefinitions.map((definition) => definition.name));
  events.add(data.selection.event);

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 shadow-sm">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-[color:var(--color-text-primary)]">PostHog event lab</h2>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
            Testing
          </span>
        </div>
        <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
          Inspect Asmos events and build a temporary grouped metric. Nothing created here changes campaign traffic or customer dashboards.
        </p>
      </div>

      {!data.configured ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Add <code>POSTHOG_PERSONAL_API_KEY</code> and <code>POSTHOG_PROJECT_ID</code> to enable this test lab. Event capture can still run with only <code>NEXT_PUBLIC_POSTHOG_KEY</code>.
        </div>
      ) : (
        <>
          {data.errors.length > 0 ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {data.errors.map((error) => <p key={error}>{error}</p>)}
            </div>
          ) : null}

          <form method="get" action="/superadmin" className="grid gap-3 rounded-lg bg-[color:var(--color-surface-sunken)] p-4 md:grid-cols-5">
            <label className="flex flex-col gap-1 text-xs font-semibold text-[color:var(--color-text-secondary)] md:col-span-2">
              Event
              <select
                name="analyticsEvent"
                defaultValue={data.selection.event}
                className="h-10 rounded-lg border border-[color:var(--color-border)] bg-white px-3 text-sm text-[color:var(--color-text-primary)]"
              >
                {[...events].sort().map((event) => <option key={event} value={event}>{event}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-[color:var(--color-text-secondary)]">
              Metric
              <select
                name="analyticsMetric"
                defaultValue={data.selection.metric}
                className="h-10 rounded-lg border border-[color:var(--color-border)] bg-white px-3 text-sm text-[color:var(--color-text-primary)]"
              >
                {METRICS.map((metric) => <option key={metric.value} value={metric.value}>{metric.label}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-[color:var(--color-text-secondary)]">
              Break down by
              <select
                name="analyticsBreakdown"
                defaultValue={data.selection.breakdown}
                className="h-10 rounded-lg border border-[color:var(--color-border)] bg-white px-3 text-sm text-[color:var(--color-text-primary)]"
              >
                {BREAKDOWNS.map((breakdown) => <option key={breakdown.value} value={breakdown.value}>{breakdown.label}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-[color:var(--color-text-secondary)]">
              Range
              <select
                name="analyticsRange"
                defaultValue={data.selection.rangeDays}
                className="h-10 rounded-lg border border-[color:var(--color-border)] bg-white px-3 text-sm text-[color:var(--color-text-primary)]"
              >
                <option value={1}>Last 24 hours</option>
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
              </select>
            </label>
            <div className="md:col-span-5">
              <button className="rounded-lg bg-[color:var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
                Run analytics
              </button>
            </div>
          </form>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div className="overflow-hidden rounded-lg border border-[color:var(--color-border)]">
              <div className="border-b border-[color:var(--color-border)] px-4 py-3">
                <h3 className="text-sm font-semibold text-[color:var(--color-text-primary)]">Analytics result</h3>
                <p className="text-xs text-[color:var(--color-text-secondary)]">{data.selection.event}</p>
              </div>
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[color:var(--color-surface-sunken)] text-xs text-[color:var(--color-text-secondary)]">
                  <tr><th className="px-4 py-2">Group</th><th className="px-4 py-2 text-right">Value</th></tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--color-border)]">
                  {data.resultRows.map((row) => (
                    <tr key={row.dimension}>
                      <td className="px-4 py-2 text-[color:var(--color-text-primary)]">{row.dimension || "unknown"}</td>
                      <td className="px-4 py-2 text-right font-semibold tabular-nums text-[color:var(--color-text-primary)]">
                        {row.value === null ? "—" : row.value.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {data.resultRows.length === 0 ? (
                    <tr><td colSpan={2} className="px-4 py-6 text-center text-xs text-[color:var(--color-text-secondary)]">No matching events yet.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="overflow-hidden rounded-lg border border-[color:var(--color-border)]">
              <div className="border-b border-[color:var(--color-border)] px-4 py-3">
                <h3 className="text-sm font-semibold text-[color:var(--color-text-primary)]">Tracked event catalog</h3>
                <p className="text-xs text-[color:var(--color-text-secondary)]">Last 30 days</p>
              </div>
              <div className="max-h-72 overflow-auto">
                <table className="min-w-full text-left text-xs">
                  <thead className="sticky top-0 bg-[color:var(--color-surface-sunken)] text-[color:var(--color-text-secondary)]">
                    <tr><th className="px-3 py-2">Event</th><th className="px-3 py-2 text-right">Count</th><th className="px-3 py-2">Last seen</th></tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--color-border)]">
                    {data.eventDefinitions.map((definition) => (
                      <tr key={definition.name}>
                        <td className="px-3 py-2 font-mono text-[11px] text-[color:var(--color-text-primary)]">{definition.name}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{definition.count.toLocaleString()}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-[color:var(--color-text-secondary)]">{displayTime(definition.lastSeen)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-[color:var(--color-border)]">
            <div className="border-b border-[color:var(--color-border)] px-4 py-3">
              <h3 className="text-sm font-semibold text-[color:var(--color-text-primary)]">Latest tracked events</h3>
              <p className="text-xs text-[color:var(--color-text-secondary)]">Newest 75 Asmos and widget events</p>
            </div>
            <div className="max-h-96 overflow-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="sticky top-0 bg-[color:var(--color-surface-sunken)] text-[color:var(--color-text-secondary)]">
                  <tr>
                    <th className="px-3 py-2">Time</th><th className="px-3 py-2">Event</th><th className="px-3 py-2">Campaign / variant</th>
                    <th className="px-3 py-2">Intent</th><th className="px-3 py-2">Device</th><th className="px-3 py-2">Visitor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--color-border)]">
                  {data.recentEvents.map((event, index) => (
                    <tr key={`${event.timestamp}-${event.event}-${index}`}>
                      <td className="whitespace-nowrap px-3 py-2 text-[color:var(--color-text-secondary)]">{displayTime(event.timestamp)}</td>
                      <td className="px-3 py-2 font-mono text-[11px] text-[color:var(--color-text-primary)]">{event.event}</td>
                      <td className="max-w-56 px-3 py-2">
                        <div className="truncate text-[color:var(--color-text-primary)]">{event.variantName || "—"}</div>
                        <div className="truncate text-[10px] text-[color:var(--color-text-secondary)]">{event.campaignId || "—"}</div>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex rounded-full px-2 py-0.5 font-semibold ${intentClass(event.intentLevel)}`}>
                          {event.intentLevel || "unknown"}{event.intentScore === null ? "" : ` · ${event.intentScore}`}
                        </span>
                      </td>
                      <td className="px-3 py-2">{event.device || "—"}</td>
                      <td className="max-w-40 truncate px-3 py-2 font-mono text-[10px] text-[color:var(--color-text-secondary)]">{event.distinctId}</td>
                    </tr>
                  ))}
                  {data.recentEvents.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-6 text-center text-[color:var(--color-text-secondary)]">No tracked events returned.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
