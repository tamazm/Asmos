"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

export type RewardRow = {
  id: string;
  label: string;
  category: string | null;
  description: string | null;
  type: string;
  couponCode: string | null;
  weight: number;
  campaignId: string;
  campaignName: string;
  variantName: string;
  totalCodes: number;
  usedCodes: number;
};

const UNCATEGORIZED = "Uncategorized";

export function RewardsBoard({ rows }: { rows: RewardRow[] }) {
  const grouped = useMemo(() => {
    const map = new Map<string, RewardRow[]>();
    for (const row of rows) {
      const key = row.category?.trim() || UNCATEGORIZED;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === UNCATEGORIZED) return 1;
      if (b === UNCATEGORIZED) return -1;
      return a.localeCompare(b);
    });
  }, [rows]);

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-surface)] py-20 text-center">
        <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">No rewards yet</p>
        <p className="mt-1 max-w-xs text-sm text-[color:var(--color-text-secondary)]">
          Rewards are created as part of a campaign&apos;s variants — add one from a campaign&apos;s
          Variants tab, then come back here to manage its codes.
        </p>
        <Link
          href="/campaigns"
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[color:var(--color-primary)] px-4 h-10 text-sm font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-[color:var(--color-primary-dark)] active:scale-[0.97]"
        >
          Go to Pop-ups
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {grouped.map(([category, categoryRows]) => (
        <div key={category} className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-[color:var(--color-text-secondary)]">
            {category}
          </h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {categoryRows.map((row) => (
              <RewardCard key={row.id} row={row} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function RewardCard({ row }: { row: RewardRow }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);
  const [prefix, setPrefix] = useState("");
  const [count, setCount] = useState(50);

  const available = row.totalCodes - row.usedCodes;

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      const text = await file.text();
      // Accept plain one-per-line lists as well as CSV — take the first
      // column of each non-empty line, skipping an optional "code" header.
      const codes = text
        .split(/\r?\n/)
        .map((line) => line.split(",")[0]?.trim())
        .filter((c): c is string => Boolean(c) && c.toLowerCase() !== "code");

      const res = await fetch(`/api/rewards/${row.id}/codes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "import", codes }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? "Import failed");
      }
      const data = await res.json();
      setFeedback(`Imported ${data.created} new code(s)${data.created < data.requested ? ` (${data.requested - data.created} duplicate/skipped)` : ""}.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerate() {
    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      const res = await fetch(`/api/rewards/${row.id}/codes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "generate", prefix, count }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? "Generation failed");
      }
      const data = await res.json();
      setFeedback(`Generated ${data.created} code(s).`);
      setShowGenerate(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-[color:var(--color-text-primary)]">{row.label}</p>
            <Badge variant="neutral">{row.type.replace(/_/g, " ").toLowerCase()}</Badge>
          </div>
          <p className="mt-0.5 text-xs text-[color:var(--color-text-secondary)]">
            {row.campaignName} · {row.variantName}
          </p>
          {row.description && (
            <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">{row.description}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 rounded-lg bg-[color:var(--color-surface-sunken)] px-3 py-2 text-sm">
        <span className="text-[color:var(--color-text-primary)] font-semibold">{available}</span>
        <span className="text-[color:var(--color-text-secondary)]">available</span>
        <span className="text-[color:var(--color-border)]">·</span>
        <span className="text-[color:var(--color-text-primary)] font-semibold">{row.usedCodes}</span>
        <span className="text-[color:var(--color-text-secondary)]">used</span>
        {row.totalCodes === 0 && row.couponCode && (
          <span className="ml-auto text-xs text-[color:var(--color-text-secondary)]">
            Shared code: {row.couponCode}
          </span>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {feedback && <p className="text-xs text-[color:var(--color-primary)]">{feedback}</p>}

      {showGenerate ? (
        <div className="flex flex-col gap-2 rounded-lg border border-dashed border-[color:var(--color-border)] p-3">
          <div className="flex items-center gap-2">
            <input
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              placeholder="Prefix (e.g. SUMMER)"
              className="min-w-0 flex-1 rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)]"
            />
            <input
              type="number"
              min={1}
              max={1000}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-20 rounded-lg border border-[color:var(--color-border)] px-2 py-2 text-sm outline-none focus:border-[color:var(--color-primary)]"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleGenerate} disabled={busy} className={busy ? "opacity-60" : ""}>
              {busy ? "Generating…" : `Generate ${count} codes`}
            </Button>
            <Button variant="secondary" onClick={() => setShowGenerate(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 border-t border-[color:var(--color-border)] pt-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt"
            onChange={handleImportFile}
            className="hidden"
          />
          <Button
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className={busy ? "opacity-60" : ""}
          >
            Bulk import (CSV)
          </Button>
          <Button variant="secondary" onClick={() => setShowGenerate(true)} disabled={busy}>
            Generate promo codes
          </Button>
          <a
            href={`/api/rewards/${row.id}/codes/export?status=all`}
            className="inline-flex items-center justify-center rounded-lg border border-[color:var(--color-border)] px-4 py-2 text-sm font-medium text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-surface-sunken)] transition-colors"
          >
            Export (CSV)
          </a>
        </div>
      )}
    </div>
  );
}
