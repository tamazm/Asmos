export function ConfidenceBar({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[color:var(--color-neutral-badge)]">
        <div
          className="h-full rounded-full bg-[color:var(--color-primary)]"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="w-10 text-right text-xs font-medium text-[color:var(--color-text-secondary)]">
        {clamped.toFixed(0)}%
      </span>
    </div>
  );
}
