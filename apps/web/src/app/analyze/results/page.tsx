"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

interface AnalyzeResult {
  storeName: string;
  industry: string;
  brandColor: string;
  description: string;
  logoUrl: string;
  storeUrl: string;
}

const INDUSTRIES = [
  "Ecommerce / Retail",
  "SaaS / Software",
  "Health & Wellness",
  "Education",
  "Food & Beverage",
  "Other",
];

export default function AnalyzeResultsPage() {
  const router = useRouter();
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [storeName, setStoreName] = useState("");
  const [industry, setIndustry] = useState("");
  const [brandColor, setBrandColor] = useState("#165DFF");

  useEffect(() => {
    const raw = sessionStorage.getItem("asmos_analyze_result");
    if (!raw) {
      router.replace("/");
      return;
    }
    try {
      const data: AnalyzeResult = JSON.parse(raw);
      setResult(data);
      setStoreName(data.storeName ?? "");
      setIndustry(data.industry ?? INDUSTRIES[0]);
      setBrandColor(data.brandColor ?? "#165DFF");
    } catch {
      router.replace("/");
    }
  }, [router]);

  function handleConfirm() {
    if (!result) return;
    const updated = { ...result, storeName, industry, brandColor };
    sessionStorage.setItem("asmos_analyze_result", JSON.stringify(updated));
    router.push("/sign-up");
  }

  if (!result) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[color:var(--color-surface)]">
        <div
          className="h-8 w-8 rounded-full border-2 border-[color:var(--color-primary-light)] border-t-[color:var(--color-primary)]"
          style={{ animation: "spin 0.9s linear infinite" }}
          aria-label="Loading"
        />
        <style jsx global>{`
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[color:var(--color-surface)]">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-[color:var(--color-border)] px-6 py-4">
        <Image
          src="/assets/asmos-logo-primary-lightbg.webp"
          alt="Asmos"
          width={110}
          height={28}
          priority
          className="h-7 w-auto"
        />
        <Link
          href="/sign-in"
          className="text-sm text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)] transition-colors duration-150"
        >
          Already have an account?
        </Link>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-lg animate-page-enter">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-[color:var(--color-text-primary)]">
              Here&apos;s what we found
            </h1>
            <p className="mt-1.5 text-sm text-[color:var(--color-text-secondary)]">
              Review and correct any details before we build your popups.
            </p>
          </div>

          {/* Detected brand card */}
          <div className="mb-6 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 shadow-sm">
            {/* Brand color preview */}
            <div className="mb-5 flex items-center gap-4">
              <div
                className="h-14 w-14 rounded-xl flex-shrink-0 shadow-sm"
                style={{ backgroundColor: brandColor }}
                aria-label={`Brand color: ${brandColor}`}
              />
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-text-secondary)]">
                  Detected store
                </p>
                <p className="text-base font-semibold text-[color:var(--color-text-primary)]">
                  {result.storeName}
                </p>
                {result.storeUrl && (
                  <p className="text-xs text-[color:var(--color-text-secondary)] truncate max-w-xs">
                    {result.storeUrl}
                  </p>
                )}
              </div>
            </div>

            {/* Industry badge */}
            <div className="mb-5">
              <span className="inline-flex items-center rounded-full bg-[color:var(--color-primary-light)] px-2.5 py-0.5 text-xs font-medium text-[color:var(--color-primary)]">
                {result.industry}
              </span>
            </div>

            {/* Divider */}
            <div className="border-t border-[color:var(--color-border)] mb-5" />

            {/* Editable fields */}
            <div className="flex flex-col gap-4">
              <div>
                <label
                  htmlFor="store-name"
                  className="mb-1.5 block text-sm font-medium text-[color:var(--color-text-primary)]"
                >
                  Store name
                </label>
                <input
                  id="store-name"
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2.5 text-sm text-[color:var(--color-text-primary)] placeholder:text-[color:var(--color-text-secondary)] outline-none focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/20 transition-colors duration-150"
                />
              </div>

              <div>
                <label
                  htmlFor="industry"
                  className="mb-1.5 block text-sm font-medium text-[color:var(--color-text-primary)]"
                >
                  Industry
                </label>
                <select
                  id="industry"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2.5 text-sm text-[color:var(--color-text-primary)] outline-none focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/20 transition-colors duration-150 bg-[color:var(--color-surface)]"
                >
                  {INDUSTRIES.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="brand-color"
                  className="mb-1.5 block text-sm font-medium text-[color:var(--color-text-primary)]"
                >
                  Brand color
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id="brand-color"
                    type="color"
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    className="h-10 w-10 cursor-pointer rounded-lg border border-[color:var(--color-border)] p-0.5"
                  />
                  <div
                    className="flex-1 rounded-lg border border-[color:var(--color-border)] px-3 py-2.5 text-sm text-[color:var(--color-text-secondary)] bg-[color:var(--color-surface-sunken)]"
                  >
                    {brandColor}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleConfirm}
            className="w-full rounded-xl bg-[color:var(--color-primary)] px-6 py-3 text-sm font-semibold text-white hover:bg-[color:var(--color-primary-dark)] transition-colors duration-150 active:scale-[0.98]"
          >
            Create your account
          </button>
          <p className="mt-3 text-center text-xs text-[color:var(--color-text-secondary)]">
            Free to start. No credit card required.
          </p>
        </div>
      </main>
    </div>
  );
}
