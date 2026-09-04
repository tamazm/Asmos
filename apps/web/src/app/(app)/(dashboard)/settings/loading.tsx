export default function SettingsLoading() {
  return (
    <div className="animate-pulse flex flex-col gap-6">
      <div className="h-8 w-28 rounded-lg bg-[color:var(--color-surface-sunken)]" />
      {/* Tab bar */}
      <div className="flex gap-2 border-b border-[color:var(--color-border)] pb-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 w-24 rounded-lg bg-[color:var(--color-surface-sunken)]" />
        ))}
      </div>
      {/* Content card */}
      <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 shadow-sm">
        <div className="flex flex-col gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <div className="h-3 w-24 rounded bg-[color:var(--color-surface-sunken)]" />
              <div className="h-10 w-full rounded-lg bg-[color:var(--color-surface-sunken)]" />
            </div>
          ))}
          <div className="h-10 w-32 rounded-lg bg-[color:var(--color-surface-sunken)]" />
        </div>
      </div>
    </div>
  );
}
