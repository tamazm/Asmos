export function StatCard({
  label,
  value,
  trend,
}: {
  label: string;
  value: string;
  /** Optional trend indicator shown below the main value. */
  trend?: {
    value: string;
    direction: "up" | "down" | "neutral";
    /** Optional label suffix, e.g. "vs last week" */
    label?: string;
  };
}) {
  const trendColor =
    trend?.direction === "up"
      ? "text-[color:var(--color-success)]"
      : trend?.direction === "down"
      ? "text-red-500"
      : "text-[color:var(--color-text-secondary)]";

  const trendIcon =
    trend?.direction === "up" ? (
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
        <path d="M5 1.5L8.5 5M5 1.5L1.5 5M5 1.5V8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ) : trend?.direction === "down" ? (
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
        <path d="M5 8.5L1.5 5M5 8.5L8.5 5M5 8.5V1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ) : null;

  return (
    /* Double-Bezel outer shell */
    <div className="rounded-[1.25rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-1.5 shadow-sm transition-shadow duration-300 hover:shadow-md">
      {/* Inner core */}
      <div
        className="rounded-[0.875rem] bg-[color:var(--color-surface)] px-4 py-4"
        style={{ boxShadow: "inset 0 1px 1px rgba(255,255,255,0.9)" }}
      >
        <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-text-secondary)]">
          {label}
        </p>
        <div className="mt-2 flex items-baseline gap-2">
          <p className="text-2xl font-bold tabular-nums text-[color:var(--color-text-primary)]">
            {value}
          </p>
        </div>
        {trend && (
          <div className={`mt-1.5 flex items-center gap-1 ${trendColor}`}>
            {trendIcon}
            <span className="text-xs font-medium">
              {trend.value}
              {trend.label ? ` ${trend.label}` : ""}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
