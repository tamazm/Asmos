import Link from "next/link";
import { cn } from "@/lib/cn";
import type { Trend } from "@/lib/dashboardMetrics";

/** 1,234 → "1,234" · 295,000 → "295K" · 1,240,000 → "1.2M".
 *  Numbers stay exact until they get long enough to crowd their tile. */
export function formatCompact(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (value >= 100_000) return `${Math.round(value / 1000)}K`;
  return value.toLocaleString();
}

export function formatRelativeTime(date: Date) {
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Small directional delta. Renders nothing when there is no prior window to
 *  compare against, which keeps "no data" visually distinct from "flat". */
export function TrendPill({
  trend,
  suffix,
  className,
}: {
  trend: Trend;
  suffix?: string;
  className?: string;
}) {
  if (!trend) return null;
  const up = trend.direction === "up";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium tabular-nums",
        up ? "text-[color:var(--color-success)]" : "text-red-500",
        className,
      )}
    >
      <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true" className={up ? "" : "rotate-180"}>
        <path d="M4 0.5 L8 7.5 L0 7.5 Z" fill="currentColor" />
      </svg>
      {trend.value.toFixed(1)}%{suffix ? ` ${suffix}` : ""}
    </span>
  );
}

export function CardTitleIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[color:var(--color-text-secondary)]" aria-hidden="true">
      {children}
    </span>
  );
}

export function SeeAllLink({ href, label = "See All" }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      className="shrink-0 rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-2.5 py-1 text-xs font-medium text-[color:var(--color-text-secondary)] transition-[background-color,color,box-shadow] duration-200 hover:bg-[color:var(--color-surface-sunken)] hover:text-[color:var(--color-text-primary)]"
    >
      {label}
    </Link>
  );
}

export function DashboardCard({
  icon,
  title,
  action,
  children,
  className,
  bodyClassName,
}: {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        "flex flex-col rounded-[14px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)]",
        "shadow-[0_1px_2px_rgba(13,13,16,0.04)] transition-shadow duration-300 hover:shadow-[0_2px_10px_rgba(13,13,16,0.06)]",
        className,
      )}
    >
      <header className="flex items-center justify-between gap-3 px-5 pb-3 pt-4">
        <h2 className="flex min-w-0 items-center gap-2 text-[15px] font-semibold tracking-tight text-[color:var(--color-text-primary)]">
          <CardTitleIcon>{icon}</CardTitleIcon>
          <span className="truncate">{title}</span>
        </h2>
        {action}
      </header>
      <div className={cn("flex flex-1 flex-col px-5 pb-5", bodyClassName)}>{children}</div>
    </section>
  );
}

/** Uniform "this card has nothing to show yet" body. Deliberately plain: a
 *  quiet line of text reads as an empty state, a styled panel reads as a
 *  feature the user is missing out on. */
export function CardEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center px-2 py-6 text-center text-xs leading-relaxed text-[color:var(--color-text-secondary)]">
      {children}
    </div>
  );
}

/** Rounded tile that holds a small glyph in list rows. */
export function RowIcon({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "primary" | "success";
}) {
  return (
    <span
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border",
        tone === "primary"
          ? "border-[color:var(--color-primary)]/15 bg-[color:var(--color-primary-light)] text-[color:var(--color-primary)]"
          : tone === "success"
            ? "border-[color:var(--color-success)]/20 bg-[color:var(--color-success-bg)] text-[color:var(--color-success)]"
            : "border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] text-[color:var(--color-text-secondary)]",
      )}
      aria-hidden="true"
    >
      {children}
    </span>
  );
}
