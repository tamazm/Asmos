"use client";

import { useState, useTransition } from "react";
import { updatePlanTier, updateAIGenerationsCount } from "@/app/(dashboard)/admin/actions";
import type { PlanTier } from ".prisma/client";
import { AI_GENERATION_LIMITS } from "@/lib/limits";

// Header-level tier/gens-left editor for a single account, mirroring
// AccountsTable's inline controls (see fixes there - actions are properly
// awaited and their result checked instead of fired-and-forgotten inside
// startTransition, which is what previously caused "changed but errored
// out").
export function AccountControls({
  accountId,
  planTier,
  aiGenerationsCount,
}: {
  accountId: string;
  planTier: PlanTier;
  aiGenerationsCount: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const limit = AI_GENERATION_LIMITS[planTier] ?? 3;
  const gensLeft = Math.max(0, limit - aiGenerationsCount);

  const handleTierChange = (tier: PlanTier) => {
    if (!confirm(`Change this account's plan to ${tier}?`)) return;
    setError(null);
    startTransition(async () => {
      const result = await updatePlanTier(accountId, tier);
      if (!result.success) setError(result.error);
    });
  };

  const handleGensLeftBlur = (value: string) => {
    const newGensLeft = parseInt(value) || 0;
    const newLimit = AI_GENERATION_LIMITS[planTier] ?? 3;
    const newCount = Math.max(0, newLimit - newGensLeft);
    setError(null);
    startTransition(async () => {
      const result = await updateAIGenerationsCount(accountId, newCount);
      if (!result.success) setError(result.error);
    });
  };

  const handleResetFull = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateAIGenerationsCount(accountId, 0);
      if (!result.success) setError(result.error);
    });
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <select
          disabled={isPending}
          value={planTier}
          onChange={(e) => handleTierChange(e.target.value as PlanTier)}
          className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm font-medium text-[color:var(--color-text)] focus:border-[color:var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[color:var(--color-primary)]"
        >
          <option value="FREE">FREE</option>
          <option value="STARTER">STARTER</option>
          <option value="GROWTH">GROWTH</option>
          <option value="SCALE">SCALE</option>
        </select>

        <div className="flex items-center gap-1.5 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-2 py-1.5">
          <input
            type="number"
            disabled={isPending}
            key={aiGenerationsCount}
            defaultValue={gensLeft}
            onBlur={(e) => handleGensLeftBlur(e.target.value)}
            className="w-14 bg-transparent text-sm text-[color:var(--color-text)] focus:outline-none"
          />
          <span className="text-xs text-[color:var(--color-text-secondary)] whitespace-nowrap">/ {limit} left</span>
        </div>

        <button
          disabled={isPending || aiGenerationsCount === 0}
          onClick={handleResetFull}
          className="rounded-lg bg-[color:var(--color-surface-sunken)] px-3 py-2 text-xs font-medium text-[color:var(--color-text)] hover:bg-[color:var(--color-border)] disabled:opacity-50"
        >
          Reset Full
        </button>
      </div>
      {error && <p className="text-xs text-red-600 bg-red-50 rounded-md px-2 py-1">{error}</p>}
    </div>
  );
}
