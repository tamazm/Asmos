export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Header */}
      <div className="h-10 w-48 rounded-lg bg-[color:var(--color-surface-sunken)]" />
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 shadow-sm">
            <div className="h-3 w-24 rounded bg-[color:var(--color-surface-sunken)]" />
            <div className="mt-2 h-8 w-16 rounded bg-[color:var(--color-surface-sunken)]" />
          </div>
        ))}
      </div>
      {/* Recent campaigns */}
      <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 shadow-sm">
        <div className="mb-4 h-4 w-36 rounded bg-[color:var(--color-surface-sunken)]" />
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 w-full rounded-lg bg-[color:var(--color-surface-sunken)]" />
          ))}
        </div>
      </div>
    </div>
  );
}
