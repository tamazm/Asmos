"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { onboardingStepCompleted } from "@/lib/analytics";
import { cn } from "@/lib/cn";

interface AnalyzeResult {
  storeName?: string;
  industry?: string;
  brandColor?: string;
  storeUrl?: string;
}

// ─── Option lists ──────────────────────────────────────────────────────────────

const ROLES = [
  { value: "founder", label: "Founder / Owner" },
  { value: "marketer", label: "Marketer" },
  { value: "developer", label: "Developer" },
  { value: "agency", label: "Agency" },
  { value: "other", label: "Other" },
];

const GOALS = [
  { value: "email_capture", label: "Email capture" },
  { value: "discount", label: "Discount offer" },
  { value: "contest", label: "Contest / giveaway" },
  { value: "lead_gen", label: "Lead generation" },
];

const TRAFFIC_RANGES = [
  { value: "lt_1k", label: "Less than 1k/mo" },
  { value: "1k_10k", label: "1k – 10k/mo" },
  { value: "10k_100k", label: "10k – 100k/mo" },
  { value: "gt_100k", label: "100k+/mo" },
];

const EMAIL_PLATFORMS = [
  { value: "klaviyo", label: "Klaviyo" },
  { value: "mailchimp", label: "Mailchimp" },
  { value: "omnisend", label: "Omnisend" },
  { value: "none", label: "None" },
  { value: "other", label: "Other" },
];

// ─── Pill selector ─────────────────────────────────────────────────────────────

function PillSelector<T extends string>({
  label,
  options,
  value,
  onChange,
  required,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  required?: boolean;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-[color:var(--color-text-primary)]">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value as T)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors duration-150 cursor-pointer",
                active
                  ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary-light)] text-[color:var(--color-primary)]"
                  : "border-[color:var(--color-border)] text-[color:var(--color-text-secondary)] hover:border-[color:var(--color-primary)]/40",
              )}
              aria-pressed={active}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Detected field row ────────────────────────────────────────────────────────

function DetectedField({
  label,
  value,
  onEdit,
  children,
}: {
  label: string;
  value: React.ReactNode;
  onEdit: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-[color:var(--color-text-primary)]">{label}</p>
      <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
        <svg className="h-4 w-4 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 16 16">
          <path stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M2 8l3.5 3.5L14 3.5" />
        </svg>
        <span className="flex-1 text-sm font-medium text-emerald-800">{value}</span>
        <button
          type="button"
          onClick={onEdit}
          className="text-[11px] font-medium text-emerald-600 hover:text-emerald-800 transition-colors underline-offset-2 hover:underline flex-shrink-0"
          aria-label={`Edit ${label}`}
        >
          Edit
        </button>
      </div>
      {children}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BusinessProfilePage() {
  const router = useRouter();
  const [analyzeData, setAnalyzeData] = useState<AnalyzeResult | null>(null);

  // Detected (prefilled) state
  const [industry, setIndustry] = useState("Ecommerce / Retail");
  const [brandColor, setBrandColor] = useState("#165DFF");
  const [businessName, setBusinessName] = useState("");

  // Edit overrides
  const [editingIndustry, setEditingIndustry] = useState(false);
  const [editingColor, setEditingColor] = useState(false);

  // Questions Asmos cannot infer
  const [role, setRole] = useState<string>("");
  const [goal, setGoal] = useState<string>("");
  const [traffic, setTraffic] = useState<string>("");
  const [emailPlatform, setEmailPlatform] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill from sessionStorage
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("asmos_analyze_result");
      if (raw) {
        const data: AnalyzeResult = JSON.parse(raw);
        setAnalyzeData(data);
        if (data.industry) setIndustry(data.industry);
        if (data.brandColor) setBrandColor(data.brandColor);
        if (data.storeName) setBusinessName(data.storeName);
      }
    } catch {
      // ignore
    }
  }, []);

  const hasAnalyzeData = analyzeData !== null;

  async function handleContinue() {
    if (!role) { setError("Please select your role."); return; }
    if (!goal) { setError("Please select a primary goal."); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/business-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          industry,
          brandColor,
          name: businessName || undefined,
          role,
          conversionGoal: goal,
          monthlyTraffic: traffic || undefined,
          emailPlatform: emailPlatform || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Could not save business profile");
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
          {hasAnalyzeData ? "Confirm a few details" : "Business profile"}
        </h1>
        <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
          {hasAnalyzeData
            ? "We detected these from your store. Correct anything that looks off, then answer a couple of quick questions."
            : "This sets your popup theme and tailors suggestions to your business."}
        </p>
      </div>

      {/* ── Detected: industry ── */}
      {hasAnalyzeData && !editingIndustry ? (
        <DetectedField
          label="Industry"
          value={`Detected: ${industry}`}
          onEdit={() => setEditingIndustry(true)}
        />
      ) : (
        <div>
          <label htmlFor="industry-input" className="mb-1.5 block text-sm font-medium text-[color:var(--color-text-primary)]">
            Industry
          </label>
          <input
            id="industry-input"
            type="text"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder="e.g. Ecommerce / Retail"
            className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/20 transition-colors duration-150"
          />
          {hasAnalyzeData && (
            <button
              type="button"
              onClick={() => setEditingIndustry(false)}
              className="mt-1 text-[11px] text-[color:var(--color-primary)] hover:underline"
            >
              Revert to detected value
            </button>
          )}
        </div>
      )}

      {/* ── Detected: brand color ── */}
      {hasAnalyzeData && !editingColor ? (
        <DetectedField
          label="Brand color"
          value={
            <span className="flex items-center gap-2">
              <span
                className="inline-block h-4 w-4 rounded-full border border-black/10 flex-shrink-0"
                style={{ backgroundColor: brandColor }}
              />
              <span className="font-mono">{brandColor}</span>
            </span>
          }
          onEdit={() => setEditingColor(true)}
        />
      ) : (
        <div>
          <p className="mb-2 text-sm font-medium text-[color:var(--color-text-primary)]">Brand color</p>
          <div className="flex items-center gap-3 mb-3">
            <div
              className="h-10 w-10 rounded-lg border border-black/10 flex-shrink-0"
              style={{ backgroundColor: brandColor }}
            />
            <span className="font-mono text-sm text-[color:var(--color-text-secondary)] tabular-nums">{brandColor}</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              className="h-9 w-9 cursor-pointer rounded-lg border border-[color:var(--color-border)] p-0.5"
              aria-label="Pick brand color"
            />
            <span className="text-xs text-[color:var(--color-text-secondary)]">Choose a color</span>
          </div>
          {hasAnalyzeData && (
            <button
              type="button"
              onClick={() => setEditingColor(false)}
              className="mt-1 text-[11px] text-[color:var(--color-primary)] hover:underline"
            >
              Revert to detected value
            </button>
          )}
        </div>
      )}

      {/* ── Divider ── */}
      <div className="border-t border-[color:var(--color-border)]" />

      {/* ── Questions Asmos cannot infer ── */}
      <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-text-secondary)]">
        A couple of quick questions
      </p>

      {/* Role */}
      <PillSelector
        label="What is your role?"
        options={ROLES}
        value={role as never}
        onChange={setRole}
        required
      />

      {/* Primary goal */}
      <PillSelector
        label="Primary conversion goal"
        options={GOALS}
        value={goal as never}
        onChange={setGoal}
        required
      />

      {/* Monthly traffic */}
      <PillSelector
        label="Monthly store traffic"
        options={TRAFFIC_RANGES}
        value={traffic as never}
        onChange={setTraffic}
      />

      {/* Email platform */}
      <PillSelector
        label="Email platform"
        options={EMAIL_PLATFORMS}
        value={emailPlatform as never}
        onChange={setEmailPlatform}
      />

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
