"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * /onboarding - immediately forwards to business-profile.
 * The separate welcome screen was removed from the lean onboarding flow.
 * A spinner keeps the frame stable during the client-side redirect.
 */
export default function OnboardingWelcomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/onboarding/business-profile");
  }, [router]);

  return (
    <div className="flex min-h-[60px] items-center justify-center">
      <div
        className="h-5 w-5 rounded-full border-2 border-[color:var(--color-primary-light)] border-t-[color:var(--color-primary)]"
        style={{ animation: "spin 0.8s linear infinite" }}
        aria-label="Loading"
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
