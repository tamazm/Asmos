export default function ReportsLoading() {
  return (
    <div className="animate-pulse flex flex-col gap-6">
      <div className="h-8 w-24 rounded-lg bg-[color:var(--color-surface-sunken)]" />
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-9 w-36 rounded-lg bg-[color:var(--color-surface-sunken)]" />
        ))}
        <div className="h-9 w-28 rounded-lg bg-[color:var(--color-surface-sunken)]" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 shadow-sm flex flex-col gap-4">
            <div className="h-4 w-40 rounded bg-[color:var(--color-surface-sunken)]" />
            <div className="h-3 w-full rounded bg-[color:var(--color-surface-sunken)]" />
            <div className="h-3 w-3/4 rounded bg-[color:var(--color-surface-sunken)]" />
            <div className="h-9 w-32 rounded-lg bg-[color:var(--color-surface-sunken)]" />
          </div>
        ))}
      </div>
    </div>
  );
}
