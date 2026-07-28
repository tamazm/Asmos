export type DonutSegment = { label: string; value: number; color: string };

export function DonutChart({ segments }: { segments: DonutSegment[] }) {
  const total = segments.reduce((sum, seg) => sum + seg.value, 0) || 1;
  const radius = 40;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius;
  const gap = 3;

  const offsets: number[] = [];
  segments.reduce((offset, seg) => {
    offsets.push(offset);
    return offset + (seg.value / total) * circumference;
  }, 0);

  return (
    <div className="flex items-center gap-5">
      <svg width={100} height={100} viewBox="0 0 100 100" className="-rotate-90 shrink-0">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="var(--color-neutral-badge)"
          strokeWidth={strokeWidth}
        />
        {segments.map((seg, i) => {
          const fraction = seg.value / total;
          const dash = Math.max(fraction * circumference - gap, 0);
          return (
            <circle
              key={i}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offsets[i]}
              strokeLinecap="butt"
            />
          );
        })}
      </svg>
      <ul className="flex flex-col gap-2">
        {segments.map((seg, i) => (
          <li key={i} className="flex items-center gap-2 text-xs">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: seg.color }}
              aria-hidden="true"
            />
            <span className="text-[color:var(--color-text-primary)]">{seg.label}</span>
            <span className="text-[color:var(--color-text-secondary)]">
              {((seg.value / total) * 100).toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
