"use client";

import { useState, useEffect } from "react";
import { type VariantStat } from "./VariantManager";

type ScheduledVariantStatus = "generating" | "queued" | "live";

type ScheduledVariant = {
  id: string;
  name: string;
  status: ScheduledVariantStatus;
  addedAt: number; // timestamp ms
  color: string;
};

const STATUS_LABELS: Record<ScheduledVariantStatus, string> = {
  generating: "Generating",
  queued: "Queued",
  live: "Live",
};

const STATUS_COLORS: Record<ScheduledVariantStatus, string> = {
  generating: "bg-amber-100 text-amber-700 ring-amber-200",
  queued: "bg-[color:var(--color-surface-sunken)] text-[color:var(--color-text-secondary)] ring-[color:var(--color-border)]",
  live: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

const VARIANT_COLORS = ["#2563EB", "#059669", "#D97706", "#DC2626", "#7C3AED"];

function buildScheduledVariants(variants: VariantStat[], newlyAddedId: string | null): ScheduledVariant[] {
  // Non-control variants become scheduled/live entries
  // The most recently added one (by createdAt proxy: lowest impressions) cycles through states
  const nonControl = variants.filter((v) => !v.isControl);

  return nonControl.map((v, i) => {
    let status: ScheduledVariantStatus;

    if (v.id === newlyAddedId) {
      status = "generating";
    } else if (v.impressions === 0) {
      status = "queued";
    } else {
      status = "live";
    }

    return {
      id: v.id,
      name: v.name,
      status,
      addedAt: Date.now() - i * 120_000,
      color: VARIANT_COLORS[i % VARIANT_COLORS.length],
    };
  });
}

function GeneratingRow() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] px-4 py-3">
      <div className="relative flex h-7 w-7 shrink-0 items-center justify-center">
        {/* Outer ring pulse */}
        <span className="absolute h-full w-full rounded-full bg-[color:var(--color-primary)] animate-ping opacity-20" />
        <span className="h-2 w-2 rounded-full bg-[color:var(--color-primary)]" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-[color:var(--color-text-primary)]">
          Another variant generating
          <span className="ml-0.5 inline-block animate-pulse">...</span>
        </p>
        <p className="text-xs text-[color:var(--color-text-secondary)]">
          AI is analyzing performance and writing challenger copy
        </p>
      </div>
      <div className="h-4 w-16 rounded-full bg-[color:var(--color-border)] animate-pulse" />
    </div>
  );
}

function VariantRow({ variant }: { variant: ScheduledVariant }) {
  const isGenerating = variant.status === "generating";
  const isLive = variant.status === "live";

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors duration-300 ${
        isLive
          ? "border-emerald-200 bg-emerald-50/40"
          : isGenerating
            ? "border-amber-200 bg-amber-50/40"
            : "border-[color:var(--color-border)] bg-[color:var(--color-surface)]"
      }`}
    >
      {/* Color dot */}
      <div
        className="h-7 w-7 shrink-0 rounded-lg flex items-center justify-center text-white text-[10px] font-bold"
        style={{ backgroundColor: isGenerating ? undefined : variant.color, opacity: isGenerating ? 0 : 1, background: isGenerating ? "var(--color-border)" : variant.color }}
      >
        {isGenerating ? (
          <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
        ) : (
          variant.name.slice(0, 2).toUpperCase()
        )}
      </div>

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`text-sm font-medium ${isGenerating ? "text-[color:var(--color-text-secondary)]" : "text-[color:var(--color-text-primary)]"}`}>
            {isGenerating ? "Generating..." : variant.name}
          </p>
        </div>
        {isLive && (
          <p className="text-xs text-[color:var(--color-text-secondary)]">
            Receiving auto-allocated traffic
          </p>
        )}
        {variant.status === "queued" && (
          <p className="text-xs text-[color:var(--color-text-secondary)]">
            Waiting to go live
          </p>
        )}
      </div>

      {/* Status badge */}
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${STATUS_COLORS[variant.status]}`}
      >
        {isGenerating && (
          <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
        )}
        {isLive && (
          <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />
        )}
        {STATUS_LABELS[variant.status]}
      </span>
    </div>
  );
}

export function ScheduledVariants({
  variants,
  newlyAddedVariantId,
}: {
  variants: VariantStat[];
  newlyAddedVariantId: string | null;
}) {
  const [scheduledList, setScheduledList] = useState<ScheduledVariant[]>([]);
  const [showGeneratingRow, setShowGeneratingRow] = useState(false);

  useEffect(() => {
    const list = buildScheduledVariants(variants, newlyAddedVariantId);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setScheduledList(list);

    // Show the "generating" row when a new variant was just added
    if (newlyAddedVariantId) {
      setShowGeneratingRow(true);
      // Auto-hide after the generation "completes"
      const t = setTimeout(() => {
        setShowGeneratingRow(false);
        // Transition that variant to "live"
        setScheduledList((prev) =>
          prev.map((v) =>
            v.id === newlyAddedVariantId ? { ...v, status: "live" as const } : v,
          ),
        );
      }, 3000);
      return () => clearTimeout(t);
    } else {
      setShowGeneratingRow(false);
    }
  }, [variants, newlyAddedVariantId]);

  if (scheduledList.length === 0 && !showGeneratingRow) {
    return null;
  }

  const liveCount = scheduledList.filter((v) => v.status === "live").length;
  const queuedCount = scheduledList.filter((v) => v.status === "queued").length;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[color:var(--color-text-primary)]">
            Scheduled variants
          </h3>
          <p className="mt-0.5 text-xs text-[color:var(--color-text-secondary)]">
            Challengers accumulate over time. Asmos routes traffic to top performers automatically.
          </p>
        </div>

        {(liveCount > 0 || queuedCount > 0) && (
          <div className="flex items-center gap-2 shrink-0">
            {liveCount > 0 && (
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                {liveCount} live
              </span>
            )}
            {queuedCount > 0 && (
              <span className="inline-flex items-center rounded-full bg-[color:var(--color-surface-sunken)] px-2 py-0.5 text-[10px] font-medium text-[color:var(--color-text-secondary)] ring-1 ring-inset ring-[color:var(--color-border)]">
                {queuedCount} queued
              </span>
            )}
          </div>
        )}
      </div>

      {/* List */}
      <div className="flex flex-col gap-2">
        {scheduledList.map((v) => (
          <VariantRow key={v.id} variant={v} />
        ))}

        {showGeneratingRow && <GeneratingRow />}
      </div>

      {/* Footer note */}
      <div className="flex items-start gap-2.5 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] px-4 py-3">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0 text-[color:var(--color-text-secondary)]" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
          <path d="M12 8v4m0 4h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <p className="text-xs text-[color:var(--color-text-secondary)]">
          New variants enter at minimal traffic. Asmos increases their share as they prove performance.
        </p>
      </div>
    </div>
  );
}
