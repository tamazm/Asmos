"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { Sparkline } from "@/components/ui/Sparkline";
import { ConfidenceBar } from "@/components/ui/ConfidenceBar";
import { type VariantStat } from "./VariantManager";
import { colorForIndex } from "./mockBracketData";

export type PerformanceRow = {
  id: string;
  label: string;
  color: string;
  createdAt: string;
  status: "Winner" | "Live" | "Eliminated";
  trafficPercent: number;
  visitors: number;
  conversionRate: number;
  confidenceToBeBest: number;
  trend: number[];
  last24h: number;
};

/** Deterministic sparkline from a string seed. */
function seededTrend(seed: string): number[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const points = 8;
  const trend: number[] = [];
  let value = 1 + (hash % 5);
  for (let i = 0; i < points; i++) {
    value += ((hash * (i + 1)) % 7) - 3;
    trend.push(Math.max(0.2, value));
  }
  return trend;
}

function variantInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return name.slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function buildPerformanceRows(variants: VariantStat[]): PerformanceRow[] {
  // Sort by conversion rate descending to rank them
  const ranked = [...variants].sort((a, b) => b.conversionRate - a.conversionRate);

  return variants.map((v, index) => {
    const rank = ranked.findIndex((r) => r.id === v.id);

    let status: PerformanceRow["status"];
    if (v.isWinner) {
      status = "Winner";
    } else if (v.trafficPercent >= 5) {
      status = "Live";
    } else {
      status = "Eliminated";
    }

    // Confidence to be best: use confidenceVsControl if available, otherwise
    // derive from rank (top is highest, others scale down)
    let confidenceToBeBest: number;
    if (v.confidenceVsControl !== null && v.confidenceVsControl !== undefined) {
      confidenceToBeBest = Math.min(99.9, Math.max(0.1, v.confidenceVsControl));
    } else if (rank === 0) {
      confidenceToBeBest = 0; // control or top; no comparison
    } else {
      // Proportional fallback: higher conversion rank → lower confidence (losing)
      confidenceToBeBest = Math.max(0.1, 50 - rank * 10);
    }

    const color = index === 0 ? "var(--color-primary)" : colorForIndex(index);

    return {
      id: v.id,
      label: variantInitials(v.name),
      color,
      createdAt: "N/A",
      status,
      trafficPercent: v.trafficPercent,
      visitors: v.impressions,
      conversionRate: v.conversionRate,
      confidenceToBeBest,
      trend: seededTrend(v.id),
      last24h: 0,
    };
  });
}

function statusBadgeVariant(status: PerformanceRow["status"]) {
  return status === "Eliminated" ? "neutral" : "success";
}

export function PerformanceTable({ variants }: { variants: VariantStat[] }) {
  const [query, setQuery] = useState("");
  const rows = buildPerformanceRows(variants).filter((row) =>
    row.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-[color:var(--color-text-primary)]">
          All Variants ({variants.length})
        </h2>
        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search variants..."
            aria-label="Search variants"
            className="w-56 rounded-lg border border-[color:var(--color-border)] px-3 py-1.5 text-sm outline-none focus:border-[color:var(--color-primary)]"
          />
          <button
            type="button"
            className="rounded-lg border border-[color:var(--color-border)] px-3 py-1.5 text-sm text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-sunken)]"
          >
            Filter
          </button>
          <button
            type="button"
            aria-label="Export"
            className="rounded-lg border border-[color:var(--color-border)] px-3 py-1.5 text-sm text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-sunken)]"
          >
            Export
          </button>
        </div>
      </div>

      <DataTable<PerformanceRow>
        rows={rows}
        emptyMessage="No variants match your search."
        columns={[
          {
            header: "Variant",
            render: (row) => (
              <div className="flex items-center gap-2">
                <span
                  className="h-6 w-6 shrink-0 rounded-md"
                  style={{
                    backgroundColor: typeof row.color === "string" && row.color.startsWith("var(") ? undefined : row.color,
                    background: typeof row.color === "string" && row.color.startsWith("var(") ? row.color : undefined,
                  }}
                  aria-hidden="true"
                />
                <div>
                  <p className="font-medium text-[color:var(--color-text-primary)]">
                    {row.label}
                  </p>
                  <p className="text-xs text-[color:var(--color-text-secondary)]">
                    Created {row.createdAt}
                  </p>
                </div>
              </div>
            ),
          },
          {
            header: "Status",
            render: (row) => (
              <Badge variant={statusBadgeVariant(row.status)}>
                {row.status === "Winner" ? "Live (Winner)" : row.status}
              </Badge>
            ),
          },
          {
            header: "Traffic Allocation",
            render: (row) => (
              <div className="w-28">
                <p className="mb-1 text-xs">{row.trafficPercent.toFixed(1)}%</p>
                <div className="h-1.5 overflow-hidden rounded-full bg-[color:var(--color-neutral-badge)]">
                  <div
                    className="h-full rounded-full bg-[color:var(--color-primary)]"
                    style={{ width: `${Math.min(100, row.trafficPercent)}%` }}
                  />
                </div>
              </div>
            ),
          },
          { header: "Visitors", render: (row) => row.visitors.toLocaleString() },
          {
            header: "Conversions",
            render: (row) => Math.round(row.visitors * (row.conversionRate / 100)).toLocaleString(),
          },
          {
            header: "Conversion Rate",
            render: (row) => (
              <span className="font-medium text-[color:var(--color-text-primary)]">
                {row.conversionRate.toFixed(2)}%
              </span>
            ),
          },
          {
            header: "Confidence to be best",
            render: (row) =>
              row.confidenceToBeBest < 1 ? (
                <span className="text-xs text-[color:var(--color-text-secondary)]">&lt;1%</span>
              ) : (
                <div className="w-28">
                  <ConfidenceBar percent={row.confidenceToBeBest} />
                </div>
              ),
          },
          {
            header: "Trend",
            render: (row) => (
              <Sparkline
                data={row.trend}
                color={typeof row.color === "string" && row.color.startsWith("var(") ? "#111827" : row.color}
              />
            ),
          },
          {
            header: "Last 24h",
            render: () => (
              <span className="text-xs text-[color:var(--color-text-secondary)]">
                N/A
              </span>
            ),
          },
        ]}
      />
    </div>
  );
}
