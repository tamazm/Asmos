"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { onboardingStepCompleted } from "@/lib/analytics";

export default function OnboardingWelcomePage() {
  const [storeName, setStoreName] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("asmos_analyze_result");
      if (raw) {
        const data = JSON.parse(raw);
        if (data.storeName) setStoreName(data.storeName);
      }
    } catch {
      // ignore
    }
  }, []);

  function handleStart() {
    onboardingStepCompleted(1, "welcome");
  }

  return (
    <div className="flex flex-col items-center gap-4 text-center animate-page-enter">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--color-primary-light)]">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="#165DFF" />
        </svg>
      </div>
      <div>
        <h1 className="text-xl font-semibold text-[color:var(--color-text-primary)]">
          {storeName ? `Welcome, ${storeName}` : "Welcome to Asmos"}
        </h1>
        <p className="mt-2 text-sm text-[color:var(--color-text-secondary)]" style={{ textWrap: "pretty" } as React.CSSProperties}>
          Next, we will set up your business profile and compliance settings.
          Takes about a minute.
        </p>
      </div>
      <Button href="/onboarding/business-profile" className="mt-2" onClick={handleStart}>
        Get started
      </Button>
    </div>
  );
}
