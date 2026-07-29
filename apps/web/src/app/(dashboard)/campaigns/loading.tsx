export default function CampaignsLoading() {
  return (
    <div className="animate-pulse flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="h-8 w-40 rounded-lg bg-[color:var(--color-surface-sunken)]" />
        <div className="h-9 w-36 rounded-lg bg-[color:var(--color-surface-sunken)]" />
      </div>
      <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
        <div className="border-b border-[color:var(--color-border)] px-5 py-3">
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-3 rounded bg-[color:var(--color-surface-sunken)]" />
            ))}
          </div>
        </div>
        <div className="divide-y divide-[color:var(--color-border)]">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <div className="h-4 w-40 rounded bg-[color:var(--color-surface-sunken)]" />
              <div className="h-4 w-16 rounded-full bg-[color:var(--color-surface-sunken)]" />
              <div className="h-4 w-20 rounded bg-[color:var(--color-surface-sunken)]" />
              <div className="ml-auto h-4 w-12 rounded bg-[color:var(--color-surface-sunken)]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
