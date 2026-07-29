"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const STEPS = [
  { href: "/onboarding", label: "Welcome" },
  { href: "/onboarding/business-profile", label: "Business Profile" },
  { href: "/onboarding/consent", label: "Compliance" },
  { href: "/onboarding/connect-store", label: "Connect Store" },
];

export function OnboardingProgress() {
  const pathname = usePathname();
  const activeIndex = Math.max(
    0,
    STEPS.findIndex((step) => step.href === pathname),
  );

  return (
    <div className="w-full max-w-lg">
      {/* Step indicators */}
      <ol className="flex items-center">
        {STEPS.map((step, index) => {
          const done = index < activeIndex;
          const active = index === activeIndex;
          return (
            <li key={step.href} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors duration-200",
                    done || active
                      ? "bg-[color:var(--color-primary)] text-white"
                      : "bg-[color:var(--color-neutral-badge)] text-[color:var(--color-text-secondary)]",
                  )}
                  aria-current={active ? "step" : undefined}
                >
                  {done ? (
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 16 16"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M3.5 8L6.5 11L12.5 5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>
                <span
                  className={cn(
                    "hidden text-xs font-medium sm:block",
                    active
                      ? "text-[color:var(--color-text-primary)]"
                      : "text-[color:var(--color-text-secondary)]",
                  )}
                >
                  {step.label}
                </span>
              </div>

              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    "mx-2 flex-1 h-0.5 rounded-full transition-colors duration-300",
                    index < activeIndex
                      ? "bg-[color:var(--color-primary)]"
                      : "bg-[color:var(--color-border)]",
                  )}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>

      {/* Progress text */}
      <p className="mt-2 text-center text-xs text-[color:var(--color-text-secondary)]">
        Step {activeIndex + 1} of {STEPS.length}
      </p>
    </div>
  );
}
