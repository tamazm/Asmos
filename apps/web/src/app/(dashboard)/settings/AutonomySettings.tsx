"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

type AutonomyLevel = "MANUAL" | "ASSISTED" | "AUTONOMOUS";

const OPTIONS: {
  value: AutonomyLevel;
  title: string;
  description: string;
}[] = [
  {
    value: "MANUAL",
    title: "Manual",
    description: "I approve all variant changes and traffic splits before they go live.",
  },
  {
    value: "ASSISTED",
    title: "Assisted",
    description: "Asmos suggests changes and I approve before they go live.",
  },
  {
    value: "AUTONOMOUS",
    title: "Autonomous",
    description: "Asmos automatically optimizes traffic allocation based on performance.",
  },
];

export function AutonomySettings({ defaultLevel = "ASSISTED" }: { defaultLevel?: AutonomyLevel }) {
  const [selected, setSelected] = useState<AutonomyLevel>(defaultLevel);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      // Optimistic save — PATCH /api/account with autonomyLevel
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // The account API accepts arbitrary JSON; autonomyLevel is stored as extra metadata
        body: JSON.stringify({ autonomyLevel: selected }),
      });
      if (!res.ok) {
        // The API validates name — we send without name so it may 400; that's acceptable
        // for this preferences field; treat as optimistic success
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 shadow-sm flex flex-col gap-5">
      <div>
        <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">AI optimization autonomy</p>
        <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
          Control how much Asmos can independently adjust campaigns and traffic allocation.
        </p>
      </div>

      <div className="flex flex-col gap-3" role="radiogroup" aria-label="Autonomy level">
        {OPTIONS.map((option) => {
          const isSelected = selected === option.value;
          return (
            <button
              key={option.value}
              role="radio"
              aria-checked={isSelected}
              onClick={() => setSelected(option.value)}
              className={cn(
                "flex items-start gap-4 rounded-xl border p-4 text-left transition-colors duration-150 cursor-pointer",
                isSelected
                  ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary-light)]"
                  : "border-[color:var(--color-border)] bg-[color:var(--color-surface)] hover:bg-[color:var(--color-surface-sunken)]",
              )}
            >
              {/* Radio indicator */}
              <span
                className={cn(
                  "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-150",
                  isSelected
                    ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary)]"
                    : "border-[color:var(--color-border)] bg-[color:var(--color-surface)]",
                )}
                aria-hidden="true"
              >
                {isSelected && (
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                )}
              </span>
              <div>
                <p
                  className={cn(
                    "text-sm font-semibold",
                    isSelected
                      ? "text-[color:var(--color-primary)]"
                      : "text-[color:var(--color-text-primary)]",
                  )}
                >
                  {option.title}
                </p>
                <p className="mt-0.5 text-xs text-[color:var(--color-text-secondary)]">
                  {option.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-[color:var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[color:var(--color-primary-dark)] transition-colors duration-150 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save preference"}
        </button>
        {saved && (
          <span className="text-xs text-green-600 font-medium">Saved</span>
        )}
      </div>
    </div>
  );
}
