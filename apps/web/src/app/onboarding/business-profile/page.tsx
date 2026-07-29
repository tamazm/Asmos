"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

interface AnalyzeResult {
  storeName?: string;
  industry?: string;
  brandColor?: string;
}

const INDUSTRIES = [
  { value: "Ecommerce / Retail", icon: "🛒", label: "Ecommerce / Retail" },
  { value: "SaaS / Software", icon: "💻", label: "SaaS / Software" },
  { value: "Health & Wellness", icon: "🌿", label: "Health & Wellness" },
  { value: "Education", icon: "📚", label: "Education" },
  { value: "Food & Beverage", icon: "☕", label: "Food & Beverage" },
  { value: "Other", icon: "✦", label: "Other" },
];

const PRESET_COLORS = [
  "#165DFF", "#6366F1", "#8B5CF6", "#EC4899",
  "#10B981", "#F97316", "#EAB308", "#0D0D10",
];

export default function BusinessProfilePage() {
  const router = useRouter();
  const [industry, setIndustry] = useState(INDUSTRIES[0].value);
  const [brandColor, setBrandColor] = useState("#165DFF");
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
    <div className="flex flex-col gap-6 animate-page-enter">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-[color:var(--color-text-primary)]">
          Business profile
        </h1>
        <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
          This sets your popup theme and tailors suggestions to your industry.
        </p>
      </div>

      {/* Industry selector — visual cards */}
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
                  "flex flex-col items-center gap-2 rounded-xl border p-4 text-center text-sm font-medium transition-all duration-150 cursor-pointer",
                  active
                    ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary-light)] text-[color:var(--color-primary)] shadow-sm"
                    : "border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text-secondary)] hover:border-[color:var(--color-primary)]/40 hover:bg-[color:var(--color-primary-light)]/30",
                ].join(" ")}
                aria-pressed={active}
              >
                <span className="text-2xl leading-none" role="img" aria-hidden="true">
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
                "h-8 w-8 rounded-lg border-2 transition-all duration-100 cursor-pointer",
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
