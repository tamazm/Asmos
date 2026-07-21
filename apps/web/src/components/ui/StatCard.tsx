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
    <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
      <p className="text-sm text-[color:var(--color-text-secondary)]">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <p className="text-2xl font-bold text-[color:var(--color-text-primary)]">
          {value}
        </p>
        {trend && (
          <span
            className={
              trend.positive
                ? "text-xs font-medium text-green-600"
                : "text-xs font-medium text-red-500"
            }
          >
            {trend.positive ? "+" : ""}
            {trend.value}
          </span>
        )}
      </div>
    </div>
  );
}
