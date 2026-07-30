"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ButtonArrow } from "@/components/ui/Button";
import { onboardingStepCompleted } from "@/lib/analytics";

export default function OnboardingWelcomePage() {
  const router = useRouter();

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("asmos_analyze_result");
      if (raw) {
        // Analysis data present — skip generic welcome, go straight to confirm details
        router.replace("/onboarding/business-profile");
        return;
      }
    } catch {
      // ignore
    }
  }, [router]);

  // Read storeName synchronously for the heading before redirect happens
  const storeName = (() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = sessionStorage.getItem("asmos_analyze_result");
      return raw ? (JSON.parse(raw).storeName ?? null) : null;
    } catch { return null; }
  })();

  function handleStart() {
    onboardingStepCompleted(1, "welcome");
  }

  return (
    <div className="flex flex-col items-center gap-5 text-center animate-page-enter">
      {/* Double-Bezel icon */}
      <div className="rounded-[1.375rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-1.5">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-[1rem] bg-[color:var(--color-primary-light)]"
          style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8)" }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
              fill="#165DFF"
            />
          </svg>
        </div>
      </div>

      <div className="max-w-sm">
        <h1 className="text-xl font-bold tracking-tight text-[color:var(--color-text-primary)]">
          {storeName ? `Welcome, ${storeName}` : "Welcome to Asmos"}
        </h1>
        <p
          className="mt-2 text-sm text-[color:var(--color-text-secondary)] leading-relaxed"
          style={{ textWrap: "pretty" } as React.CSSProperties}
        >
          Next, we will set up your business profile and compliance settings.
          Takes about a minute.
        </p>
      </div>

      <ButtonArrow href="/onboarding/business-profile" onClick={handleStart}>
        Get started
      </ButtonArrow>
    </div>
  );
}
