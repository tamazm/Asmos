"use client";

import { useState } from "react";
import Link from "next/link";
import { DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";

export type VariantStat = {
  id: string;
  name: string;
  isControl: boolean;
  isWinner: boolean;
  trafficPercent: number;
  impressions: number;
  submissions: number;
  conversionRate: number;
};

export type RecentCampaignRow = {
  id: string;
  name: string;
  status: string;
  impressions: number;
  conversions: number;
  variants: VariantStat[];
};

export function RecentCampaignsBoard({ rows }: { rows: RecentCampaignRow[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = rows.find((row) => row.id === selectedId) ?? null;
  const ranked = selected
    ? [...selected.variants].sort((a, b) => b.conversionRate - a.conversionRate)
    : [];

  return (
    <div>
      <h2 className="mb-3 text-sm font-medium text-[color:var(--color-text-secondary)]">
        Recent Campaigns
      </h2>

      <div className="relative overflow-hidden">
        <div
          className="flex transition-transform duration-300 ease-in-out"
          style={{ width: "200%", transform: selectedId ? "translateX(-50%)" : "translateX(0%)" }}
        >
          <div className="w-1/2 shrink-0 pr-3">
            <DataTable<RecentCampaignRow>
              rows={rows}
              emptyMessage="No campaigns yet — create your first popup to get started."
              onRowClick={(row) => setSelectedId(row.id)}
              columns={[
                { header: "Name", render: (row) => row.name },
                {
                  header: "Status",
                  render: (row) => (
                    <Badge variant={row.status === "ACTIVE" ? "success" : "neutral"}>
                      {row.status}
                    </Badge>
                  ),
                },
                { header: "Impressions", render: (row) => row.impressions.toLocaleString() },
                { header: "Conversions", render: (row) => row.conversions.toLocaleString() },
              ]}
            />
          </div>

          <div className="w-1/2 shrink-0 pl-3">
            {selected && (
              <div className="flex flex-col gap-4 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    className="rounded-lg border border-[color:var(--color-border)] px-3 py-1.5 text-sm text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-sunken)]"
                  >
                    ← Back
                  </button>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold text-[color:var(--color-text-primary)]">
                      {selected.name}
                    </h3>
                    <p className="text-xs text-[color:var(--color-text-secondary)]">
                      {ranked.length} variant{ranked.length === 1 ? "" : "s"} · ranked by
                      conversion rate
                    </p>
                  </div>
                  <Link
                    href={`/campaigns/${selected.id}`}
                    className="shrink-0 text-sm text-[color:var(--color-primary)] hover:underline"
                  >
                    Manage campaign →
                  </Link>
                </div>

                <div className="flex flex-col gap-2">
                  {ranked.map((variant, index) => (
                    <BracketRow key={variant.id} rank={index + 1} variant={variant} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function BracketRow({ rank, variant }: { rank: number; variant: VariantStat }) {
  const isLeader = rank === 1;
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border p-3 ${
        isLeader
          ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary-light)]"
          : "border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)]"
      }`}
    >
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          isLeader
            ? "bg-[color:var(--color-primary)] text-white"
            : "bg-[color:var(--color-surface)] text-[color:var(--color-text-secondary)]"
        }`}
      >
        {isLeader ? "🏆" : `#${rank}`}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-[color:var(--color-text-primary)]">
            {variant.name}
          </p>
          {variant.isControl && <Badge variant="neutral">Control</Badge>}
          {variant.isWinner && <Badge variant="success">Winner</Badge>}
        </div>
        <p className="text-xs text-[color:var(--color-text-secondary)]">
          {variant.impressions.toLocaleString()} impressions ·{" "}
          {variant.submissions.toLocaleString()} conversions
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className="text-sm font-bold text-[color:var(--color-text-primary)]">
          {variant.conversionRate.toFixed(2)}%
        </p>
        <p className="text-xs text-[color:var(--color-text-secondary)]">
          {variant.trafficPercent}% traffic
        </p>
      </div>
    </div>
  );
}
