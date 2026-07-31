"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

type OptimizationMode = "auto" | "manual";
type VariantCount = 2 | 3 | 4;
type AutonomyLevel = "fully_autonomous" | "notify_me" | "manual_only";

const OPTIMIZATION_OPTIONS: { id: OptimizationMode; label: string; description: string }[] = [
  {
    id: "auto",
    label: "Run A/B test automatically",
    description: "Asmos tests 2 variants and shifts traffic to the winner",
  },
  {
    id: "manual",
    label: "Manual control",
    description: "You decide when to switch variants",
  },
];

const VARIANT_COUNT_OPTIONS: VariantCount[] = [2, 3, 4];

const AUTONOMY_OPTIONS: { id: AutonomyLevel; label: string; description: string }[] = [
  {
    id: "fully_autonomous",
    label: "Fully autonomous",
    description: "Auto-switch to winner when confident",
  },
  {
    id: "notify_me",
    label: "Notify me",
    description: "Alert when a winner is found, you switch manually",
  },
  {
    id: "manual_only",
    label: "Manual only",
    description: "No auto-switching",
  },
];

export default function TestingStrategyPage() {
  const router = useRouter();
  const [optimizationMode, setOptimizationMode] = useState<OptimizationMode>("auto");
  const [variantCount, setVariantCount] = useState<VariantCount>(2);
  const [autonomy, setAutonomy] = useState<AutonomyLevel>("fully_autonomous");

  function handleContinue() {
    try {
      sessionStorage.setItem(
        "asmos_testing_strategy",
        JSON.stringify({ optimizationMode, variantCount, autonomy }),
      );
    } catch { /* ignore */ }
    router.push("/onboarding/connect-store");
  }

  return (
    <div className="flex flex-col gap-6 animate-page-enter">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-[color:var(--color-text-primary)]">
          Testing strategy
        </h1>
        <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
          Choose how Asmos should optimize your popup.
        </p>
      </div>

      {/* Optimization mode */}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-[color:var(--color-text-primary)]">
          How should Asmos optimize your popup?
        </p>
        <div className="flex flex-col gap-2">
          {OPTIMIZATION_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setOptimizationMode(opt.id)}
              aria-pressed={optimizationMode === opt.id}
              className={cn(
                "flex items-start gap-3 rounded-xl border px-4 py-3.5 text-left transition-[border-color,background-color] duration-200",
                optimizationMode === opt.id
                  ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary-light)]"
                  : "border-[color:var(--color-border)] bg-[color:var(--color-surface)] hover:bg-[color:var(--color-surface-sunken)]",
              )}
            >
              {/* Selection indicator */}
              <span
                className={cn(
                  "mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200",
                  optimizationMode === opt.id
                    ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary)]"
                    : "border-[color:var(--color-border)] bg-white",
                )}
                aria-hidden="true"
              >
                {optimizationMode === opt.id && (
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                )}
              </span>
              <div>
                <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">
                  {opt.label}
                </p>
                <p className="mt-0.5 text-xs text-[color:var(--color-text-secondary)]">
                  {opt.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Variant count */}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-[color:var(--color-text-primary)]">
          How many variants?
        </p>
        <div className="flex gap-2">
          {VARIANT_COUNT_OPTIONS.map((count) => (
            <button
              key={count}
              type="button"
              onClick={() => setVariantCount(count)}
              aria-pressed={variantCount === count}
              className={cn(
                "flex h-10 w-14 items-center justify-center rounded-lg border text-sm font-semibold transition-[border-color,background-color,color] duration-200",
                variantCount === count
                  ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary)] text-white"
                  : "border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-sunken)]",
              )}
            >
              {count}
            </button>
          ))}
        </div>
        <p className="text-xs text-[color:var(--color-text-secondary)]">
          Asmos generates one design variant per slot.
        </p>
      </div>

      {/* Autonomy level */}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-[color:var(--color-text-primary)]">
          How autonomous should Asmos be?
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {AUTONOMY_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setAutonomy(opt.id)}
              aria-pressed={autonomy === opt.id}
              className={cn(
                "flex flex-col rounded-xl border px-4 py-3 text-left transition-[border-color,background-color] duration-200 sm:flex-1 sm:min-w-[140px]",
                autonomy === opt.id
                  ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary-light)]"
                  : "border-[color:var(--color-border)] bg-[color:var(--color-surface)] hover:bg-[color:var(--color-surface-sunken)]",
              )}
            >
              <span
                className={cn(
                  "text-sm font-semibold",
                  autonomy === opt.id
                    ? "text-[color:var(--color-primary)]"
                    : "text-[color:var(--color-text-primary)]",
                )}
              >
                {opt.label}
              </span>
              <span className="mt-0.5 text-xs text-[color:var(--color-text-secondary)]">
                {opt.description}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-2">
        <Button href="/onboarding/consent" variant="secondary">
          Back
        </Button>
        <Button onClick={handleContinue}>
          Continue
        </Button>
      </div>
    </div>
  );
}
