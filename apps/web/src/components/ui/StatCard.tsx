export function StatCard({
  label,
  value,
  trend,
}: {
  label: string;
  value: string;
  trend?: { value: string; positive: boolean };
}) {
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
          {trend && (
            <span
              className={
                trend.positive
                  ? "text-xs font-medium text-[color:var(--color-success)]"
                  : "text-xs font-medium text-red-500"
              }
            >
              {trend.positive ? "+" : ""}
              {trend.value}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
