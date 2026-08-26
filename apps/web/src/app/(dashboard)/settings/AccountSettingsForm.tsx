"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { INDUSTRY_BUCKETS, normalizeIndustry } from "@/lib/popupScraping";

export function AccountSettingsForm({
  initialName,
  initialIndustry,
  initialGdpr,
  initialCcpa,
  initialBannerText,
}: {
  initialName: string;
  initialIndustry: string | null;
  initialGdpr: boolean;
  initialCcpa: boolean;
  initialBannerText: string | null;
}) {
  const [name, setName] = useState(initialName);
  // Normalized through the same bucketer scraped data is matched against —
  // an existing account may still hold an older free-text value (this used
  // to be a different, unrelated 6-item list) or nothing at all, and this
  // maps either onto one of the exact buckets generation actually fetches by.
  const [industry, setIndustry] = useState<string>(normalizeIndustry(initialIndustry ?? ""));
  // Brand colour is no longer a merchant-set field here at all — see
  // popupGeneration.ts's brandTokensFromAnalyzeResult. Colour comes from what's
  // measured on the store's own site, or a real scraped colour from the same
  // industry as a fallback, never from something typed into a settings form.
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
    <div className="flex min-w-0 flex-col gap-5 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 sm:p-6">
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
          className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/20 transition-colors duration-150"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-[color:var(--color-text-primary)]">
          Industry
        </label>
        <select
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/20 transition-colors duration-150 bg-[color:var(--color-surface)]"
        >
          {INDUSTRY_BUCKETS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <hr className="border-[color:var(--color-border)]" />

      <h2 className="text-sm font-medium text-[color:var(--color-text-primary)]">
        Consent & privacy
      </h2>

      <div className="flex flex-col gap-3">
        <label className="flex min-w-0 items-start gap-2 text-sm text-[color:var(--color-text-primary)]">
          <input
            type="checkbox"
            checked={gdpr}
            onChange={(e) => setGdpr(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-[color:var(--color-border)] accent-[color:var(--color-primary)]"
          />
          Enable GDPR consent requirements (EU visitors)
        </label>
        <label className="flex min-w-0 items-start gap-2 text-sm text-[color:var(--color-text-primary)]">
          <input
            type="checkbox"
            checked={ccpa}
            onChange={(e) => setCcpa(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-[color:var(--color-border)] accent-[color:var(--color-primary)]"
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
          className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/20 transition-colors duration-150"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
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
