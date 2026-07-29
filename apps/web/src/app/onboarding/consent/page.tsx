"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { onboardingStepCompleted } from "@/lib/analytics";

export default function ConsentSetupPage() {
  const router = useRouter();
  const [gdpr, setGdpr] = useState(true);
  const [ccpa, setCcpa] = useState(true);
  const [bannerText, setBannerText] = useState(
    "We use cookies to personalize your experience. By continuing, you agree to our use of cookies.",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFinish() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gdpr, ccpa, bannerText }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not save consent settings");
      }
      onboardingStepCompleted(3, "consent");
      router.push("/onboarding/connect-store");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold text-[color:var(--color-text-primary)]">
          Consent & compliance
        </h1>
        <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
          The widget won&apos;t track visitors until they accept this banner.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-2 text-sm text-[color:var(--color-text-primary)]">
          <input
            type="checkbox"
            checked={gdpr}
            onChange={(e) => setGdpr(e.target.checked)}
            className="h-4 w-4 rounded border-[color:var(--color-border)] accent-[color:var(--color-primary)]"
          />
          Enable GDPR consent requirements (EU visitors)
        </label>
        <label className="flex items-center gap-2 text-sm text-[color:var(--color-text-primary)]">
          <input
            type="checkbox"
            checked={ccpa}
            onChange={(e) => setCcpa(e.target.checked)}
            className="h-4 w-4 rounded border-[color:var(--color-border)] accent-[color:var(--color-primary)]"
          />
          Enable CCPA consent requirements (California visitors)
        </label>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-[color:var(--color-text-primary)]">
          Consent banner text
        </label>
        <textarea
          value={bannerText}
          onChange={(e) => setBannerText(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)]"
        />
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex justify-between">
        <Button href="/onboarding/business-profile" variant="secondary">
          Back
        </Button>
        <Button onClick={handleFinish} className={saving ? "opacity-60" : ""}>
          {saving ? "Saving…" : "Finish Setup"}
        </Button>
      </div>
    </div>
  );
}
