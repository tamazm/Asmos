export default function IntegrationsLoading() {
  return (
    <div className="animate-pulse flex flex-col gap-6">
      <div className="h-8 w-32 rounded-lg bg-[color:var(--color-surface-sunken)]" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-[color:var(--color-surface-sunken)]" />
              <div className="flex-1">
                <div className="h-4 w-24 rounded bg-[color:var(--color-surface-sunken)]" />
                <div className="mt-2 h-3 w-full rounded bg-[color:var(--color-surface-sunken)]" />
                <div className="mt-1 h-3 w-3/4 rounded bg-[color:var(--color-surface-sunken)]" />
              </div>
            </div>
            <div className="mt-4 h-9 w-24 rounded-lg bg-[color:var(--color-surface-sunken)]" />
          </div>
        ))}
      </div>
    </div>
  );
}
