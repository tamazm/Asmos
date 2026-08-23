"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { DashboardCard, TrendPill } from "./primitives";
import { IconTarget } from "./icons";
import type { DashboardMetrics } from "@/lib/dashboardMetrics";

const HORIZONS = [
  { days: 30, label: "30 days" },
  { days: 60, label: "60 days" },
  { days: 90, label: "90 days" },
];

export function ConversionGoalCard({ goal }: { goal: DashboardMetrics["goal"] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [target, setTarget] = useState(goal.targetCvr ? String(goal.targetCvr) : "");
  const [horizon, setHorizon] = useState(30);
  const [error, setError] = useState<string | null>(null);

  const configured = goal.targetCvr !== null && !editing;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const parsed = Number(target);
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 100) {
      setError("Enter a rate between 0 and 100.");
      return;
    }
    setError(null);
    const response = await fetch("/api/account/goal", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetCvr: parsed, days: horizon }),
    });
    if (!response.ok) {
      setError("Could not save the target. Try again.");
      return;
    }
    setEditing(false);
    startTransition(() => router.refresh());
  }

  return (
    <DashboardCard
      icon={<IconTarget />}
      title="Conversion Goal"
      action={
        goal.targetCvr !== null && !editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="shrink-0 rounded-md border border-[color:var(--color-border)] px-2.5 py-1 text-xs font-medium text-[color:var(--color-text-secondary)] transition-colors duration-200 hover:bg-[color:var(--color-surface-sunken)] hover:text-[color:var(--color-text-primary)]"
          >
            Edit
          </button>
        ) : null
      }
    >
      <p className="text-xs text-[color:var(--color-text-secondary)]">Goal</p>
      <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">{goal.label}</p>

      {configured ? (
        <>
          <div className="mt-3 border-t border-[color:var(--color-border)] pt-3">
            <p className="text-xs text-[color:var(--color-text-secondary)]">Current CVR</p>
            <div className="mt-0.5 flex items-baseline gap-2">
              <span className="text-2xl font-bold tabular-nums tracking-tight text-[color:var(--color-text-primary)]">
                {goal.currentCvr.toFixed(1)}%
              </span>
              <TrendPill trend={goal.cvrTrend} />
            </div>
          </div>

          <div className="mt-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[color:var(--color-text-secondary)]">Goal Progress</span>
              <span className="font-semibold tabular-nums text-[color:var(--color-text-primary)]">
                {Math.round(goal.progress ?? 0)}%
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--color-surface-sunken)]">
              <div
                className="h-full rounded-full bg-[color:var(--color-primary)]"
                style={{ width: `${Math.max(2, Math.min(100, goal.progress ?? 0))}%` }}
              />
            </div>
          </div>

          <div className="mt-auto grid grid-cols-2 divide-x divide-[color:var(--color-border)] border-t border-[color:var(--color-border)] pt-3">
            <div className="pr-3">
              <p className="text-xs text-[color:var(--color-text-secondary)]">Target CVR</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-[color:var(--color-text-primary)]">
                {goal.targetCvr?.toFixed(goal.targetCvr % 1 === 0 ? 0 : 1)}%
              </p>
            </div>
            <div className="pl-3">
              <p className="text-xs text-[color:var(--color-text-secondary)]">Time Remaining</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-[color:var(--color-text-primary)]">
                {goal.daysRemaining === null
                  ? "--"
                  : `${goal.daysRemaining} ${goal.daysRemaining === 1 ? "day" : "days"}`}
              </p>
            </div>
          </div>
        </>
      ) : (
        <form onSubmit={save} className="mt-3 flex flex-1 flex-col border-t border-[color:var(--color-border)] pt-3">
          <p className="text-xs leading-relaxed text-[color:var(--color-text-secondary)]">
            You are converting at{" "}
            <span className="font-semibold text-[color:var(--color-text-primary)]">
              {goal.currentCvr.toFixed(1)}%
            </span>{" "}
            today. Set a target to track progress against it.
          </p>

          <label className="mt-3 block text-xs font-medium text-[color:var(--color-text-secondary)]">
            Target conversion rate
          </label>
          <div className="relative mt-1">
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0.1"
              max="100"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              placeholder={(goal.currentCvr * 1.2).toFixed(1)}
              className="w-full rounded-lg border border-[color:var(--color-border)] py-2 pl-3 pr-7 text-sm tabular-nums text-[color:var(--color-text-primary)] focus:border-[color:var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-primary)]/20"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[color:var(--color-text-secondary)]">
              %
            </span>
          </div>

          <label className="mt-2.5 block text-xs font-medium text-[color:var(--color-text-secondary)]">
            Reach it within
          </label>
          <div className="mt-1 flex gap-1.5">
            {HORIZONS.map((option) => (
              <button
                key={option.days}
                type="button"
                onClick={() => setHorizon(option.days)}
                className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors duration-200 ${
                  horizon === option.days
                    ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary-light)] text-[color:var(--color-primary)]"
                    : "border-[color:var(--color-border)] text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-sunken)]"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

          <div className="mt-auto flex gap-2 pt-3">
            <button
              type="submit"
              disabled={pending}
              className="flex-1 rounded-lg bg-[color:var(--color-primary)] px-3 py-2 text-xs font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-[color:var(--color-primary-dark)] active:scale-[0.97] disabled:opacity-60"
            >
              {pending ? "Saving" : "Set target"}
            </button>
            {goal.targetCvr !== null && (
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-xs font-medium text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-sunken)]"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}
    </DashboardCard>
  );
}
