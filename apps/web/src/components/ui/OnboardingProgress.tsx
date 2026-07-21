"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const STEPS = [
  { href: "/onboarding", label: "Welcome" },
  { href: "/onboarding/connect-website", label: "Connect Website" },
  { href: "/onboarding/verify", label: "Verify Install" },
  { href: "/onboarding/business-profile", label: "Business Profile" },
  { href: "/onboarding/consent", label: "Consent Setup" },
];

export function OnboardingProgress() {
  const pathname = usePathname();
  const activeIndex = Math.max(
    0,
    STEPS.findIndex((step) => step.href === pathname),
  );

  return (
    <ol className="flex items-center gap-2">
      {STEPS.map((step, index) => (
        <li key={step.href} className="flex items-center gap-2">
          <div
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium",
              index <= activeIndex
                ? "bg-[color:var(--color-primary)] text-white"
                : "bg-[color:var(--color-neutral-badge)] text-[color:var(--color-text-secondary)]",
            )}
          >
            {index + 1}
          </div>
          {index < STEPS.length - 1 && (
            <div
              className={cn(
                "h-0.5 w-8 sm:w-12",
                index < activeIndex
                  ? "bg-[color:var(--color-primary)]"
                  : "bg-[color:var(--color-border)]",
              )}
            />
          )}
        </li>
      ))}
    </ol>
  );
}
