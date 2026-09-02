"use client";

import type { ReactNode } from "react";

export type IntegrationStatusKind = "connected" | "reconnect" | "disconnected";

/** Consistent status pill used across every integration card. */
export function StatusBadge({ status }: { status: IntegrationStatusKind }) {
  if (status === "connected") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-success-bg)] px-2.5 py-0.5 text-xs font-medium text-[color:var(--color-success)]">
        <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-success)]" />
        Connected
      </span>
    );
  }
  return (
    <span className="rounded-full bg-[color:var(--color-neutral-badge)] px-2.5 py-0.5 text-xs font-medium text-[color:var(--color-text-secondary)]">
      {status === "reconnect" ? "Reconnect required" : "Not connected"}
    </span>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 text-[color:var(--color-text-secondary)] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
    >
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Shared shell for every integration card: a uniform, collapsed-by-default
 * header row (logo · name · subtitle · status · chevron) that toggles an
 * expanded body. Keeping the collapsed header identical across all providers is
 * what makes the Integrations grid read as one consistent system regardless of
 * how many fields a given provider needs.
 */
export function IntegrationCardShell({
  icon,
  name,
  subtitle,
  status,
  expanded,
  onToggle,
  headerAccessory,
  children,
}: {
  icon: ReactNode;
  name: string;
  subtitle: string;
  status: IntegrationStatusKind;
  expanded: boolean;
  onToggle: () => void;
  /** Optional element shown between the status badge and chevron (e.g. a warning dot). */
  headerAccessory?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-[color:var(--color-surface-sunken)] sm:p-5"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="shrink-0">{icon}</span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-[color:var(--color-text-primary)]">{name}</span>
            <span className="block truncate text-xs text-[color:var(--color-text-secondary)]">{subtitle}</span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <StatusBadge status={status} />
          {headerAccessory}
          <Chevron open={expanded} />
        </span>
      </button>

      {expanded && (
        <div className="flex flex-col gap-4 border-t border-[color:var(--color-border)] px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
          {children}
        </div>
      )}
    </div>
  );
}
