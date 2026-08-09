"use client";

import { useEffect } from "react";
import { cn } from "@/lib/cn";

/**
 * Centered overlay modal for flows that need more room than an inline
 * expand/collapse panel can give them (e.g. a searchable, paginated table).
 * Closes on Escape and backdrop click.
 */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  size = "lg",
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  size?: "md" | "lg" | "xl";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const sizeClasses = { md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" }[size];

  return (
    <div className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/30 px-4 py-8 sm:py-16" onClick={onClose}>
      <div
        className={cn(
          "flex w-full flex-col rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-xl",
          sizeClasses,
        )}
        style={{ animation: "modal-in 180ms var(--ease-out-quart, ease-out) both" }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`@keyframes modal-in { from { opacity: 0; transform: translateY(8px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }`}</style>
        <div className="flex items-start justify-between gap-4 border-b border-[color:var(--color-border)] px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-[color:var(--color-text-primary)]">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-[color:var(--color-text-secondary)]">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-lg p-1.5 text-[color:var(--color-text-secondary)] transition-colors duration-150 hover:bg-[color:var(--color-surface-sunken)] hover:text-[color:var(--color-text-primary)]"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
