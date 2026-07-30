export default function CampaignDetailLoading() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      {/* Page header skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-4 w-24 rounded-lg bg-[color:var(--color-border)]" />
          <div className="h-4 w-4 rounded bg-[color:var(--color-border)]" />
          <div className="h-6 w-48 rounded-lg bg-[color:var(--color-border)]" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-6 w-16 rounded-full bg-[color:var(--color-border)]" />
          <div className="h-8 w-8 rounded-lg bg-[color:var(--color-border)]" />
        </div>
      </div>

      {/* Tabs skeleton */}
      <div className="flex items-center gap-1 border-b border-[color:var(--color-border)] pb-0">
        {[80, 72, 68, 60, 64].map((w, i) => (
          <div
            key={i}
            className="h-9 rounded-t-lg bg-[color:var(--color-border)]"
            style={{ width: w }}
          />
        ))}
      </div>

      {/* Stat cards skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 shadow-sm"
          >
            <div className="h-3 w-20 rounded bg-[color:var(--color-border)]" />
            <div className="mt-3 h-8 w-16 rounded-lg bg-[color:var(--color-border)]" />
          </div>
        ))}
      </div>

      {/* Content area skeleton */}
      <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 shadow-sm">
        <div className="flex flex-col gap-4">
          <div className="h-4 w-32 rounded bg-[color:var(--color-border)]" />
          <div className="h-3 w-full max-w-md rounded bg-[color:var(--color-border)]" />
          <div className="h-3 w-3/4 max-w-sm rounded bg-[color:var(--color-border)]" />
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="h-4 w-24 rounded bg-[color:var(--color-border)]" />
                  <div className="h-5 w-14 rounded-full bg-[color:var(--color-border)]" />
                </div>
                <div className="mt-3 flex gap-4">
                  <div className="h-3 w-16 rounded bg-[color:var(--color-border)]" />
                  <div className="h-3 w-16 rounded bg-[color:var(--color-border)]" />
                  <div className="h-3 w-16 rounded bg-[color:var(--color-border)]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
