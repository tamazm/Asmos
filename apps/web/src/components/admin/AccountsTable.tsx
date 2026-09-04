"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { updatePlanTier, updateAIGenerationsCount } from "@/app/(app)/(dashboard)/admin/actions";
import type { PlanTier } from ".prisma/client";
import { AI_GENERATION_LIMITS } from "@/lib/limits";

type AccountItem = {
  id: string;
  name: string;
  industry: string | null;
  planTier: PlanTier;
  aiGenerationsCount: number;
  createdAt: Date;
};

type SortKey = "name" | "planTier" | "gensUsed" | "createdAt";

const PLAN_TIERS: PlanTier[] = ["FREE", "STARTER", "GROWTH", "SCALE"];

function usageOf(acc: AccountItem): number {
  const limit = AI_GENERATION_LIMITS[acc.planTier] ?? 3;
  return limit > 0 ? acc.aiGenerationsCount / limit : 0;
}

function SortHeader({
  label,
  sortKeyName,
  activeKey,
  dir,
  onSort,
}: {
  label: string;
  sortKeyName: SortKey;
  activeKey: SortKey;
  dir: "asc" | "desc";
  onSort: (key: SortKey) => void;
}) {
  const active = activeKey === sortKeyName;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKeyName)}
      className={`flex items-center gap-1 font-semibold ${active ? "text-[color:var(--color-primary)]" : "text-[color:var(--color-text)]"}`}
    >
      {label}
      <span className="text-[10px] leading-none">{active ? (dir === "asc" ? "▲" : "▼") : ""}</span>
    </button>
  );
}

export function AccountsTable({ accounts }: { accounts: AccountItem[] }) {
  const [isPending, startTransition] = useTransition();
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<PlanTier | "ALL">("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const clearRowError = (accountId: string) => {
    setRowErrors((prev) => {
      if (!(accountId in prev)) return prev;
      const next = { ...prev };
      delete next[accountId];
      return next;
    });
  };

  const handleTierChange = (accountId: string, tier: PlanTier) => {
    if (!confirm(`Are you sure you want to change this account to ${tier}?`)) return;
    clearRowError(accountId);
    startTransition(async () => {
      const result = await updatePlanTier(accountId, tier);
      if (!result.success) {
        setRowErrors((prev) => ({ ...prev, [accountId]: result.error }));
      }
    });
  };

  const handleUpdateGensLeft = (accountId: string, newGensLeft: number, tier: PlanTier) => {
    const limit = AI_GENERATION_LIMITS[tier] ?? 3;
    const newCount = Math.max(0, limit - newGensLeft);
    clearRowError(accountId);
    startTransition(async () => {
      const result = await updateAIGenerationsCount(accountId, newCount);
      if (!result.success) {
        setRowErrors((prev) => ({ ...prev, [accountId]: result.error }));
      }
    });
  };

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  const visibleAccounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = accounts.filter((acc) => {
      if (tierFilter !== "ALL" && acc.planTier !== tierFilter) return false;
      if (!q) return true;
      return acc.name.toLowerCase().includes(q) || (acc.industry ?? "").toLowerCase().includes(q);
    });

    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "planTier":
          cmp = PLAN_TIERS.indexOf(a.planTier) - PLAN_TIERS.indexOf(b.planTier);
          break;
        case "gensUsed":
          cmp = usageOf(a) - usageOf(b);
          break;
        case "createdAt":
          cmp = a.createdAt.getTime() - b.createdAt.getTime();
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return sorted;
  }, [accounts, search, tierFilter, sortKey, sortDir]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or industry…"
          className="min-w-[220px] flex-1 rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm text-[color:var(--color-text)] focus:border-[color:var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-primary)]"
        />
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value as PlanTier | "ALL")}
          className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm text-[color:var(--color-text)] focus:border-[color:var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-primary)]"
        >
          <option value="ALL">All plans</option>
          {PLAN_TIERS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <span className="text-xs text-[color:var(--color-text-secondary)]">
          {visibleAccounts.length} of {accounts.length}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
        <table className="w-full text-left text-sm text-[color:var(--color-text-secondary)]">
          <thead className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] text-xs uppercase text-[color:var(--color-text)]">
            <tr>
              <th className="px-6 py-4"><SortHeader label="Account" sortKeyName="name" activeKey={sortKey} dir={sortDir} onSort={toggleSort} /></th>
              <th className="px-6 py-4 font-semibold">Industry</th>
              <th className="px-6 py-4"><SortHeader label="Plan Tier" sortKeyName="planTier" activeKey={sortKey} dir={sortDir} onSort={toggleSort} /></th>
              <th className="px-6 py-4"><SortHeader label="Gens Left" sortKeyName="gensUsed" activeKey={sortKey} dir={sortDir} onSort={toggleSort} /></th>
              <th className="px-6 py-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--color-border)]">
            {visibleAccounts.map((acc) => (
              <Fragment key={acc.id}>
              <tr className="hover:bg-[color:var(--color-surface-sunken)] align-top">
                <td className="whitespace-nowrap px-6 py-4 font-medium">
                  <Link
                    href={`/admin/accounts/${acc.id}`}
                    className="text-[color:var(--color-text)] hover:text-[color:var(--color-primary)] hover:underline"
                  >
                    {acc.name}
                  </Link>
                </td>
                <td className="px-6 py-4">{acc.industry || "N/A"}</td>
                <td className="px-6 py-4">
                  <select
                    disabled={isPending}
                    value={acc.planTier}
                    onChange={(e) => handleTierChange(acc.id, e.target.value as PlanTier)}
                    className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-2 py-1 text-sm text-[color:var(--color-text)] focus:border-[color:var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-primary)]"
                  >
                    {PLAN_TIERS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      disabled={isPending}
                      // Keyed on the server-authoritative value so the field
                      // remounts (picking up the fresh defaultValue) once
                      // revalidatePath brings back the real post-update count,
                      // instead of silently going stale after a successful edit.
                      key={acc.aiGenerationsCount}
                      defaultValue={(AI_GENERATION_LIMITS[acc.planTier] ?? 3) - acc.aiGenerationsCount}
                      onBlur={(e) => handleUpdateGensLeft(acc.id, parseInt(e.target.value) || 0, acc.planTier)}
                      className="w-20 rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-2 py-1 text-sm text-[color:var(--color-text)] focus:border-[color:var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-primary)]"
                    />
                    <span className="text-xs text-[color:var(--color-text-secondary)]">
                      / {AI_GENERATION_LIMITS[acc.planTier] ?? 3}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    disabled={isPending || acc.aiGenerationsCount === 0}
                    onClick={() => handleUpdateGensLeft(acc.id, AI_GENERATION_LIMITS[acc.planTier] ?? 3, acc.planTier)}
                    className="rounded-md bg-[color:var(--color-surface-sunken)] px-3 py-1.5 text-xs font-medium text-[color:var(--color-text)] hover:bg-[color:var(--color-border)] disabled:opacity-50"
                  >
                    Reset Full
                  </button>
                </td>
              </tr>
              {rowErrors[acc.id] && (
                <tr>
                  <td colSpan={5} className="px-6 pb-3 -mt-1">
                    <p className="text-xs text-red-600 bg-red-50 rounded-md px-2 py-1.5 inline-block">{rowErrors[acc.id]}</p>
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
            {visibleAccounts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-[color:var(--color-text-secondary)]">
                  {accounts.length === 0 ? "No accounts found." : "No accounts match your search/filter."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
