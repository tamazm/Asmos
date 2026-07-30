"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { onboardingStepCompleted } from "@/lib/analytics";

interface AnalyzeResult {
  storeName?: string;
  industry?: string;
  brandColor?: string;
  storeUrl?: string;
}

const INDUSTRIES = [
  {
    value: "Ecommerce / Retail",
    label: "Ecommerce / Retail",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="3" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M16 10a4 4 0 01-8 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    value: "SaaS / Software",
    label: "SaaS / Software",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M7 8l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="13" y1="13" x2="17" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    value: "Health & Wellness",
    label: "Health & Wellness",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    value: "Education",
    label: "Education",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    value: "Food & Beverage",
    label: "Food & Beverage",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M18 8h1a4 4 0 010 8h-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="6" y1="1" x2="6" y2="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="10" y1="1" x2="10" y2="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="14" y1="1" x2="14" y2="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    value: "Other",
    label: "Other",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="12" cy="8" r="1" fill="currentColor" />
        <line x1="12" y1="12" x2="12" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
];

const PRESET_COLORS = [
  "#165DFF", "#6366F1", "#8B5CF6", "#EC4899",
  "#10B981", "#F97316", "#EAB308", "#0D0D10",
];

export default function BusinessProfilePage() {
  const router = useRouter();
  const [industry, setIndustry] = useState(INDUSTRIES[0].value);
  const [brandColor, setBrandColor] = useState("#165DFF");
  const [businessName, setBusinessName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill from sessionStorage if available
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("asmos_analyze_result");
      if (raw) {
        const data: AnalyzeResult = JSON.parse(raw);
        if (data.industry) setIndustry(data.industry);
        if (data.brandColor) setBrandColor(data.brandColor);
        if (data.storeName) setBusinessName(data.storeName);
      }
    } catch {
      // ignore
    }
  }, []);

  async function handleContinue() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/business-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ industry, brandColor, name: businessName || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not save business profile");
      }
      onboardingStepCompleted(2, "business-profile");
      router.push("/onboarding/consent");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-page-enter">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-[color:var(--color-text-primary)]">
          Business profile
        </h1>
        <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
          This sets your popup theme and tailors suggestions to your industry.
        </p>
      </div>

      {/* Business name */}
      <div>
        <label htmlFor="business-name" className="mb-1.5 block text-sm font-medium text-[color:var(--color-text-primary)]">
          Business name
        </label>
        <input
          id="business-name"
          type="text"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          placeholder="Your store or company name"
          className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2.5 text-sm text-[color:var(--color-text-primary)] placeholder:text-[color:var(--color-text-secondary)] outline-none focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/20 transition-colors duration-150"
        />
      </div>

      {/* Industry selector -- visual cards */}
      <div>
        <p className="mb-3 text-sm font-medium text-[color:var(--color-text-primary)]">
          Industry
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {INDUSTRIES.map((opt) => {
            const active = industry === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setIndustry(opt.value)}
                className={[
                  "flex flex-col items-center gap-2 rounded-2xl border p-4 text-center text-sm font-medium transition-colors duration-150 cursor-pointer",
                  active
                    ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary-light)] text-[color:var(--color-primary)] shadow-sm"
                    : "border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text-secondary)] hover:border-[color:var(--color-primary)]/40 hover:bg-[color:var(--color-primary-light)]/30",
                ].join(" ")}
                aria-pressed={active}
              >
                <span className={active ? "text-[color:var(--color-primary)]" : "text-[color:var(--color-text-secondary)]"}>
                  {opt.icon}
                </span>
                <span className="leading-tight">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Brand color picker */}
      <div>
        <p className="mb-3 text-sm font-medium text-[color:var(--color-text-primary)]">
          Brand color
        </p>

        {/* Live preview swatch */}
        <div className="mb-3 flex items-center gap-3">
          <div
            className="h-10 w-10 flex-shrink-0 rounded-lg border border-black/10 shadow-sm transition-colors duration-200"
            style={{ backgroundColor: brandColor }}
            aria-label={`Selected color: ${brandColor}`}
          />
          <span className="font-mono text-sm text-[color:var(--color-text-secondary)] tabular-nums">
            {brandColor}
          </span>
        </div>

        {/* Preset colors */}
        <div className="mb-3 flex flex-wrap gap-2">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setBrandColor(c)}
              className={[
                "h-8 w-8 rounded-lg border-2 transition-colors duration-100 cursor-pointer",
                brandColor.toLowerCase() === c.toLowerCase()
                  ? "border-[color:var(--color-primary)] scale-110 shadow-sm"
                  : "border-transparent hover:scale-105",
              ].join(" ")}
              style={{ backgroundColor: c }}
              aria-label={`Set color ${c}`}
              aria-pressed={brandColor.toLowerCase() === c.toLowerCase()}
            />
          ))}
        </div>

        {/* Custom color input */}
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={brandColor}
            onChange={(e) => setBrandColor(e.target.value)}
            className="h-9 w-9 cursor-pointer rounded-lg border border-[color:var(--color-border)] p-0.5"
            aria-label="Custom color picker"
          />
          <span className="text-xs text-[color:var(--color-text-secondary)]">
            Custom color
          </span>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex justify-between gap-3 pt-1">
        <Button href="/onboarding" variant="secondary">
          Back
        </Button>
        <Button
          onClick={handleContinue}
          className={saving ? "opacity-60 pointer-events-none" : ""}
        >
          {saving ? "Saving..." : "Continue"}
        </Button>
      </div>
    </div>
  );
}
