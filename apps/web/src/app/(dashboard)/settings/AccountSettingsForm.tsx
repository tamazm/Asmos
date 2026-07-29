"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

const INDUSTRIES = [
  "Ecommerce / Retail",
  "SaaS / Software",
  "Health & Wellness",
  "Education",
  "Food & Beverage",
  "Other",
];

export function AccountSettingsForm({
  initialName,
  initialIndustry,
  initialBrandColor,
  initialGdpr,
  initialCcpa,
  initialBannerText,
}: {
  initialName: string;
  initialIndustry: string | null;
  initialBrandColor: string | null;
  initialGdpr: boolean;
  initialCcpa: boolean;
  initialBannerText: string | null;
}) {
  const [name, setName] = useState(initialName);
  const [industry, setIndustry] = useState(initialIndustry ?? INDUSTRIES[0]);
  const [brandColor, setBrandColor] = useState(initialBrandColor ?? "#6366f1");
  const [gdpr, setGdpr] = useState(initialGdpr);
  const [ccpa, setCcpa] = useState(initialCcpa);
  const [bannerText, setBannerText] = useState(
    initialBannerText ??
      "We use cookies to personalize your experience. By continuing, you agree to our use of cookies.",
  );
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  async function handleSave() {
    setSaving(true);
    setStatus("idle");
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          industry,
          brandColor,
          consentGdprEnabled: gdpr,
          consentCcpaEnabled: ccpa,
          consentBannerText: bannerText,
        }),
      });
      if (!res.ok) throw new Error();
      setStatus("saved");
    } catch {
      setStatus("error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
      <h2 className="text-sm font-medium text-[color:var(--color-text-primary)]">
        Business profile
      </h2>

      <div>
        <label className="mb-1 block text-sm font-medium text-[color:var(--color-text-primary)]">
          Business name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)]"
        />
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

      <hr className="border-[color:var(--color-border)]" />

      <h2 className="text-sm font-medium text-[color:var(--color-text-primary)]">
        Consent & privacy
      </h2>

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

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} className={saving ? "opacity-60" : ""}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
        {status === "saved" && (
          <span className="text-sm text-[color:var(--color-success)]">Saved</span>
        )}
        {status === "error" && (
          <span className="text-sm text-red-500">Could not save. Try again.</span>
        )}
      </div>
    </div>
  );
}
