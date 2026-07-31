export default function LeadsLoading() {
  return (
    <div className="animate-pulse flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="h-8 w-24 rounded-lg bg-[color:var(--color-surface-sunken)]" />
        <div className="h-9 w-28 rounded-lg bg-[color:var(--color-surface-sunken)]" />
      </div>
      <div className="flex gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-9 w-36 rounded-lg bg-[color:var(--color-surface-sunken)]" />
        ))}
      </div>
      <div className="overflow-x-auto rounded-[1rem] bg-[color:var(--color-surface)] border border-[color:var(--color-border)]">
        <div className="min-w-[600px]">
          <div className="border-b border-[color:var(--color-border)] px-5 py-3">
            <div className="grid grid-cols-5 gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-3 rounded bg-[color:var(--color-surface-sunken)]" />
              ))}
            </div>
          </div>
          <div className="divide-y divide-[color:var(--color-border)]">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="grid grid-cols-5 gap-4 px-5 py-4">
                {Array.from({ length: 5 }).map((_, j) => (
                  <div key={j} className="h-4 rounded bg-[color:var(--color-surface-sunken)]" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
