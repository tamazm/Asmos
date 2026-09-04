export default function VariantDetailLoading() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between border-b border-[color:var(--color-border)] pb-4">
        <div>
          <div className="mb-2 h-3 w-28 rounded bg-[color:var(--color-border)]" />
          <div className="flex items-center gap-3">
            <div className="h-6 w-48 rounded-lg bg-[color:var(--color-border)]" />
            <div className="h-5 w-16 rounded-full bg-[color:var(--color-border)]" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-20 rounded-lg bg-[color:var(--color-border)]" />
          <div className="h-10 w-28 rounded-lg bg-[color:var(--color-border)]" />
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 shadow-sm"
          >
            <div className="h-3 w-24 rounded bg-[color:var(--color-border)]" />
            <div className="mt-3 h-8 w-16 rounded-lg bg-[color:var(--color-border)]" />
          </div>
        ))}
      </div>

      {/* Design card */}
      <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 shadow-sm">
        <div className="mb-4 h-4 w-32 rounded bg-[color:var(--color-border)]" />
        <div className="grid grid-cols-2 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i}>
              <div className="mb-1 h-2.5 w-16 rounded bg-[color:var(--color-border)]" />
              <div className="h-4 w-40 rounded bg-[color:var(--color-border)]" />
            </div>
          ))}
        </div>
      </div>

      {/* Performance card */}
      <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 shadow-sm">
        <div className="mb-4 h-4 w-48 rounded bg-[color:var(--color-border)]" />
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i}>
              <div className="mb-1.5 flex justify-between">
                <div className="h-3 w-32 rounded bg-[color:var(--color-border)]" />
                <div className="h-3 w-10 rounded bg-[color:var(--color-border)]" />
              </div>
              <div className="h-2 w-full rounded-full bg-[color:var(--color-border)]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
