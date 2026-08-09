"use client";

import { Fragment, useState, useTransition } from "react";
import Link from "next/link";
import { updatePlanTier, updateAIGenerationsCount } from "@/app/(dashboard)/admin/actions";
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

export function AccountsTable({ accounts }: { accounts: AccountItem[] }) {
  const [isPending, startTransition] = useTransition();
  // Bug fix: previously these actions were fired via
  // `startTransition(() => updateX(...))`, which discards the returned
  // promise — any rejection became an unhandled rejection in the browser
  // even when the underlying write succeeded, which is what surfaced as
  // "it got changed but errored out". Now every call is awaited and its
  // result checked, with real failures surfaced per-row instead of thrown.
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

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

  return (
    <div className="overflow-x-auto rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
      <table className="w-full text-left text-sm text-[color:var(--color-text-secondary)]">
        <thead className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] text-xs uppercase text-[color:var(--color-text)]">
          <tr>
            <th className="px-6 py-4 font-semibold">Account</th>
            <th className="px-6 py-4 font-semibold">Industry</th>
            <th className="px-6 py-4 font-semibold">Plan Tier</th>
            <th className="px-6 py-4 font-semibold">Gens Left</th>
            <th className="px-6 py-4 font-semibold text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[color:var(--color-border)]">
          {accounts.map((acc) => (
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
                  <option value="FREE">FREE</option>
                  <option value="STARTER">STARTER</option>
                  <option value="GROWTH">GROWTH</option>
                  <option value="SCALE">SCALE</option>
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
          {accounts.length === 0 && (
            <tr>
              <td colSpan={5} className="px-6 py-8 text-center text-[color:var(--color-text-secondary)]">
                No accounts found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
