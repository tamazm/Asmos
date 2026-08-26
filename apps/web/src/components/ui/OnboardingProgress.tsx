"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const STEPS = [
  {
    label: "Profile",
    matchPaths: [
      "/onboarding",
      "/onboarding/business-profile",
    ],
  },
  {
    label: "Consent",
    matchPaths: ["/onboarding/consent"],
  },
  {
    label: "Connect Store",
    matchPaths: ["/onboarding/connect-store"],
  },
  {
    label: "Your Popup",
    matchPaths: ["/onboarding/generate-popup", "/onboarding/launch-confirmation"],
  },
];

export function OnboardingProgress() {
  const pathname = usePathname();

  // Find active step index by checking if pathname starts with or equals any matchPath
  const activeIndex = Math.max(
    0,
    STEPS.findIndex((step) =>
      step.matchPaths.some((p) => pathname === p || pathname.startsWith(p + "/")),
    ),
  );

  return (
    <div className="w-full max-w-xl">
      {/* Step indicators */}
      <ol className="flex items-center">
        {STEPS.map((step, index) => {
          const done = index < activeIndex;
          const active = index === activeIndex;
          const pending = !done && !active;
          return (
            <li key={step.label} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1.5">
                {/* Double-Bezel step bubble — the outline is reserved for the
                    active step; every state shares this same markup so the
                    color/background transition animates instead of the
                    element being swapped out. */}
                <div
                  className={cn(
                    "rounded-[0.625rem] p-0.5 transition-colors duration-200",
                    active ? "bg-[color:var(--color-primary)]/15" : "bg-transparent",
                  )}
                  aria-current={active ? "step" : undefined}
                  aria-hidden={pending ? "true" : undefined}
                >
                  <div
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-[0.5rem] text-xs font-semibold transition-colors duration-200",
                      done || active
                        ? "bg-[color:var(--color-primary)] text-white"
                        : "bg-[color:var(--color-neutral-badge)] text-[color:var(--color-text-secondary)]",
                    )}
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
