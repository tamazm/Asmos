export default function AnalyticsLoading() {
  return (
    <div className="animate-pulse flex flex-col gap-6">
      <div className="h-8 w-32 rounded-lg bg-[color:var(--color-surface-sunken)]" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 shadow-sm">
            <div className="h-3 w-24 rounded bg-[color:var(--color-surface-sunken)]" />
            <div className="mt-2 h-8 w-16 rounded bg-[color:var(--color-surface-sunken)]" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 shadow-sm">
            <div className="mb-4 h-4 w-40 rounded bg-[color:var(--color-surface-sunken)]" />
            <div className="flex flex-col gap-4">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="flex flex-col gap-1">
                  <div className="h-3 w-32 rounded bg-[color:var(--color-surface-sunken)]" />
                  <div className="h-2 w-full rounded-full bg-[color:var(--color-surface-sunken)]" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
