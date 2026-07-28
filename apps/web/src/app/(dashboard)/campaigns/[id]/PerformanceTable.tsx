"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { Sparkline } from "@/components/ui/Sparkline";
import { ConfidenceBar } from "@/components/ui/ConfidenceBar";
import { performanceRows, type PerformanceRow } from "./mockBracketData";

function statusBadgeVariant(status: PerformanceRow["status"]) {
  return status === "Eliminated" ? "neutral" : "success";
}

export function PerformanceTable() {
  const [query, setQuery] = useState("");
  const rows = performanceRows.filter((row) =>
    row.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-[color:var(--color-text-primary)]">
          All Variants ({performanceRows.length})
        </h2>
        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search variants..."
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
            ⭳
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
                  style={{ backgroundColor: row.color }}
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
            render: (row) => <Sparkline data={row.trend} color={row.color} />,
          },
          {
            header: "Last 24h",
            render: (row) => (
              <span
                className={
                  row.last24h >= 0
                    ? "text-xs font-medium text-[color:var(--color-success)]"
                    : "text-xs font-medium text-red-500"
                }
              >
                {row.last24h >= 0 ? "+" : ""}
                {row.last24h.toFixed(2)}%
              </span>
            ),
          },
        ]}
      />
    </div>
  );
}
