"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

// ─── Option definitions ────────────────────────────────────────────────────────

const GOALS = [
  {
    value: "email_capture",
    label: "Email capture",
    description: "Collect email addresses from visitors",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="2" y="5" width="20" height="14" rx="2" stroke="#165DFF" strokeWidth="1.75" strokeLinejoin="round" />
        <path d="M2 8l10 7 10-7" stroke="#165DFF" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    value: "discount",
    label: "Discount offer",
    description: "Give a first-order discount to new visitors",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M9 15L15 9" stroke="#165DFF" strokeWidth="1.75" strokeLinecap="round" />
        <circle cx="9.5" cy="9.5" r="1" fill="#165DFF" />
        <circle cx="14.5" cy="14.5" r="1" fill="#165DFF" />
        <path d="M3 10.5V6a1 1 0 011-1h4.5l9 9a2 2 0 010 2.83l-3.17 3.17a2 2 0 01-2.83 0L3 12.5" stroke="#165DFF" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    value: "contest",
    label: "Contest / giveaway",
    description: "Run a giveaway to grow your audience",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z" stroke="#165DFF" strokeWidth="1.75" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    value: "lead_gen",
    label: "Lead generation",
    description: "Capture contact info for follow-up",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="#165DFF" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="7" r="4" stroke="#165DFF" strokeWidth="1.75" />
      </svg>
    ),
  },
] as const;

type GoalValue = (typeof GOALS)[number]["value"];

// ─── Icon Well ─────────────────────────────────────────────────────────────────

function IconWell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[1.125rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-1.5 flex-shrink-0">
      <div
        className="flex h-10 w-10 items-center justify-center rounded-[0.75rem] bg-[color:var(--color-primary-light)]"
        style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8)" }}
      >
        {children}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ConversionGoalPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<GoalValue>("email_capture");

  // Pre-fill from analyze result
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("asmos_analyze_result");
      if (raw) {
        const data = JSON.parse(raw) as { conversionGoal?: string };
        const mapped = data.conversionGoal as GoalValue | undefined;
        if (mapped && GOALS.some((g) => g.value === mapped)) {
          setSelected(mapped);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  function handleContinue() {
    try {
      sessionStorage.setItem("asmos_conversion_goal", selected);
    } catch {
      // ignore
    }
    router.push("/onboarding/offer-selection");
  }

  return (
    <div className="flex flex-col gap-6 animate-page-enter">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-[color:var(--color-text-primary)]">
          What should your popup achieve?
        </h1>
        <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
          Asmos uses this to write copy and pick the right format.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {GOALS.map((goal) => {
          const active = selected === goal.value;
          return (
            <button
              key={goal.value}
              type="button"
              onClick={() => setSelected(goal.value)}
              aria-pressed={active}
              className={cn(
                "group flex items-center gap-4 rounded-2xl border p-4 text-left transition-[border-color,background-color,box-shadow] duration-200 cursor-pointer",
                active
                  ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary-light)] shadow-sm"
                  : "border-[color:var(--color-border)] bg-[color:var(--color-surface)] hover:border-[color:var(--color-primary)]/40 hover:bg-[color:var(--color-surface-sunken)]",
              )}
            >
              <IconWell>{goal.icon}</IconWell>
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    "text-sm font-semibold leading-snug",
                    active
                      ? "text-[color:var(--color-primary)]"
                      : "text-[color:var(--color-text-primary)]",
                  )}
                >
                  {goal.label}
                </p>
                <p className="mt-0.5 text-xs text-[color:var(--color-text-secondary)] leading-relaxed">
                  {goal.description}
                </p>
              </div>
              {/* Selection indicator */}
              <div
                className={cn(
                  "h-4 w-4 rounded-full border-2 flex-shrink-0 transition-colors duration-150",
                  active
                    ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary)]"
                    : "border-[color:var(--color-border)] bg-transparent",
                )}
                aria-hidden="true"
              >
                {active && (
                  <div className="flex items-center justify-center h-full">
                    <div className="h-1.5 w-1.5 rounded-full bg-white" />
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex justify-between gap-3 pt-1">
        <Button href="/onboarding/business-profile" variant="secondary">
          Back
        </Button>
        <Button onClick={handleContinue}>
          Continue
        </Button>
      </div>
    </div>
  );
}
