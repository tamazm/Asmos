"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

const INDUSTRIES = [
  "Ecommerce / Retail",
  "SaaS / Software",
  "Health & Wellness",
  "Education",
  "Food & Beverage",
  "Other",
];

export default function BusinessProfilePage() {
  const router = useRouter();
  const [industry, setIndustry] = useState(INDUSTRIES[0]);
  const [brandColor, setBrandColor] = useState("#6366f1");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/business-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ industry, brandColor }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not save business profile");
      }
      router.push("/onboarding/consent");
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
          Business profile
        </h1>
        <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
          This sets your default popup theming and helps us tailor
          suggestions to your industry.
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-[color:var(--color-text-primary)]">
          Industry
        </label>
        <select
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)]"
        >
          {INDUSTRIES.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-[color:var(--color-text-primary)]">
          Brand color
        </label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={brandColor}
            onChange={(e) => setBrandColor(e.target.value)}
            className="h-9 w-9 cursor-pointer rounded border border-[color:var(--color-border)]"
          />
          <span className="text-sm text-[color:var(--color-text-secondary)]">
            {brandColor}
          </span>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-[color:var(--color-text-primary)]">
          Logo
        </label>
        <input
          type="file"
          accept="image/*"
          className="w-full text-sm text-[color:var(--color-text-secondary)]"
        />
        <p className="mt-1 text-xs text-[color:var(--color-text-secondary)]">
          Logo upload lands in a later phase — industry and brand color are
          saved now.
        </p>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex justify-between">
        <Button href="/onboarding" variant="secondary">
          Back
        </Button>
        <Button onClick={handleContinue} className={saving ? "opacity-60" : ""}>
          {saving ? "Saving…" : "Continue"}
        </Button>
      </div>
    </div>
  );
}
