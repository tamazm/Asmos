export default function CampaignInsightsLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading AI insights">
      {/* Page header skeleton */}
      <div className="flex flex-col gap-2 border-b border-[color:var(--color-border)] pb-4">
        <div className="h-4 w-32 animate-pulse rounded-md bg-[color:var(--color-surface-sunken)]" />
        <div className="h-6 w-40 animate-pulse rounded-md bg-[color:var(--color-surface-sunken)]" />
      </div>

      {/* Campaign context bar skeleton */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-5 py-3">
        <div className="h-4 w-36 animate-pulse rounded-md bg-[color:var(--color-surface-sunken)]" />
        <div className="h-4 w-20 animate-pulse rounded-md bg-[color:var(--color-surface-sunken)]" />
        <div className="h-4 w-24 animate-pulse rounded-md bg-[color:var(--color-surface-sunken)]" />
        <div className="h-4 w-24 animate-pulse rounded-md bg-[color:var(--color-surface-sunken)]" />
        <div className="h-4 w-28 animate-pulse rounded-md bg-[color:var(--color-surface-sunken)]" />
      </div>

      {/* Section intro skeleton */}
      <div className="flex flex-col gap-2">
        <div className="h-5 w-48 animate-pulse rounded-md bg-[color:var(--color-surface-sunken)]" />
        <div className="h-4 w-full max-w-xl animate-pulse rounded-md bg-[color:var(--color-surface-sunken)]" />
        <div className="h-4 w-3/4 max-w-lg animate-pulse rounded-md bg-[color:var(--color-surface-sunken)]" />
      </div>

      {/* Generate button row skeleton */}
      <div className="flex items-center justify-between gap-3">
        <div className="h-4 w-72 animate-pulse rounded-md bg-[color:var(--color-surface-sunken)]" />
        <div className="h-10 w-40 animate-pulse rounded-lg bg-[color:var(--color-surface-sunken)]" />
      </div>

      {/* Insight cards skeleton */}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex flex-col gap-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5"
        >
          <div className="h-3 w-32 animate-pulse rounded-md bg-[color:var(--color-surface-sunken)]" />
          <div className="flex flex-col gap-2">
            <div className="h-4 w-full animate-pulse rounded-md bg-[color:var(--color-surface-sunken)]" />
            <div className="h-4 w-5/6 animate-pulse rounded-md bg-[color:var(--color-surface-sunken)]" />
            <div className="h-4 w-4/6 animate-pulse rounded-md bg-[color:var(--color-surface-sunken)]" />
          </div>
        </div>
      ))}
    </div>
  );
}
