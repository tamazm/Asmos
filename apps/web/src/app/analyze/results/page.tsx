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
  score: number;
  grade: string;
  gradeLabel: string;
  checks: {
    hasPopup: boolean;
    hasExitIntent: boolean;
    hasEmailCapture: boolean;
    hasSocialProof: boolean;
    hasUrgency: boolean;
    hasABTest: boolean;
  };
}

const INDUSTRIES = [
  "Ecommerce / Retail",
  "SaaS / Software",
  "Health & Wellness",
  "Education",
  "Food & Beverage",
  "Other",
];

const CHECK_LABELS: Record<keyof AnalyzeResult["checks"], { label: string; points: number }> = {
  hasPopup:        { label: "Popup / opt-in tool",       points: 20 },
  hasEmailCapture: { label: "Email capture offer",        points: 20 },
  hasSocialProof:  { label: "Social proof & reviews",     points: 15 },
  hasExitIntent:   { label: "Exit-intent recovery",       points: 15 },
  hasUrgency:      { label: "Urgency / scarcity signals", points: 15 },
  hasABTest:       { label: "A/B testing",                points: 15 },
};

function gradeColor(grade: string) {
  if (grade.startsWith("A")) return "text-emerald-600";
  if (grade.startsWith("B")) return "text-blue-600";
  if (grade.startsWith("C")) return "text-amber-500";
  return "text-red-500";
}

function gradeBg(grade: string) {
  if (grade.startsWith("A")) return "bg-emerald-50 border-emerald-200";
  if (grade.startsWith("B")) return "bg-blue-50 border-blue-200";
  if (grade.startsWith("C")) return "bg-amber-50 border-amber-200";
  return "bg-red-50 border-red-200";
}

export default function AnalyzeResultsPage() {
  const router = useRouter();
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [storeName, setStoreName] = useState("");
  const [industry, setIndustry] = useState("");
  const [brandColor, setBrandColor] = useState("#165DFF");

  // Email gate state
  const [email, setEmail] = useState("");
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
      // If they already gave email this session, skip gate
      if (sessionStorage.getItem("asmos_email_captured")) {
        setEmailSubmitted(true);
      }
    } catch {
      router.replace("/");
    }
  }, [router]);

  function validateEmail(val: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateEmail(email)) {
      setEmailError("Enter a valid email address.");
      return;
    }
    setEmailError("");
    setSubmitting(true);
    // Store email in sessionStorage for pre-fill in sign-up
    sessionStorage.setItem("asmos_email_captured", email);
    // Short artificial delay so it feels like it's doing something
    await new Promise((r) => setTimeout(r, 600));
    setEmailSubmitted(true);
    setSubmitting(false);
  }

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

  const failedChecks = Object.entries(result.checks ?? {}).filter(([, v]) => !v);
  const missedPoints = failedChecks.reduce(
    (sum, [k]) => sum + (CHECK_LABELS[k as keyof typeof CHECK_LABELS]?.points ?? 0),
    0
  );

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

      <main className="flex flex-1 flex-col items-center px-6 py-12">
        <div className="w-full max-w-lg animate-page-enter space-y-6">

          {/* ── Score card ── */}
          <div className={`rounded-2xl border p-6 shadow-sm ${gradeBg(result.grade)}`}>
            <div className="flex items-center gap-5">
              {/* Big grade letter */}
              <div className={`text-6xl font-black leading-none tabular-nums ${gradeColor(result.grade)}`}>
                {result.grade}
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--color-text-secondary)]">
                  Conversion score for
                </p>
                <p className="text-lg font-bold text-[color:var(--color-text-primary)] leading-tight">
                  {result.storeName}
                </p>
                <p className={`text-sm font-medium mt-0.5 ${gradeColor(result.grade)}`}>
                  {result.gradeLabel ?? ""}
                  {" — "}
                  <span className="tabular-nums">{result.score ?? 0}/100</span>
                </p>
              </div>
            </div>

            {/* Check breakdown */}
            <div className="mt-5 space-y-2">
              {Object.entries(CHECK_LABELS).map(([key, { label, points }]) => {
                const passed = result.checks?.[key as keyof typeof result.checks] ?? false;
                return (
                  <div key={key} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`text-base leading-none ${passed ? "text-emerald-500" : "text-red-400"}`}>
                        {passed ? "✓" : "✗"}
                      </span>
                      <span className={passed ? "text-[color:var(--color-text-primary)]" : "text-[color:var(--color-text-secondary)] line-through"}>
                        {label}
                      </span>
                    </div>
                    <span className={`tabular-nums text-xs font-semibold ${passed ? "text-emerald-600" : "text-red-400"}`}>
                      {passed ? `+${points}` : `−${points}`}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Missed points message */}
            {missedPoints > 0 && (
              <p className="mt-4 text-sm font-medium text-[color:var(--color-text-secondary)]">
                You&apos;re leaving{" "}
                <span className="font-bold text-[color:var(--color-text-primary)]">{missedPoints} points</span>{" "}
                — and likely thousands in revenue — on the table.
              </p>
            )}
          </div>

          {/* ── Email gate ── */}
          {!emailSubmitted ? (
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 shadow-sm">
              <h2 className="text-lg font-bold text-[color:var(--color-text-primary)]">
                See exactly what to fix — free
              </h2>
              <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
                Enter your email and we&apos;ll show you a step-by-step plan to bring your score to an A+.
                No credit card. No catch.
              </p>
              <form onSubmit={handleEmailSubmit} className="mt-4 flex flex-col gap-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@yourstore.com"
                  autoFocus
                  className="w-full rounded-lg border border-[color:var(--color-border)] px-4 py-3 text-sm text-[color:var(--color-text-primary)] placeholder:text-[color:var(--color-text-secondary)] outline-none focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/20 transition-colors duration-150"
                />
                {emailError && (
                  <p className="text-xs text-red-500">{emailError}</p>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl bg-[color:var(--color-primary)] px-6 py-3 text-sm font-semibold text-white hover:bg-[color:var(--color-primary-dark)] transition-colors duration-150 active:scale-[0.98] disabled:opacity-60"
                >
                  {submitting ? "One moment..." : "Show me how to fix it — it's free"}
                </button>
                <p className="text-center text-xs text-[color:var(--color-text-secondary)]">
                  No spam. Unsubscribe any time.
                </p>
              </form>
            </div>
          ) : (
            /* ── Full results (post-email gate) ── */
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 shadow-sm">
              <h2 className="text-base font-bold text-[color:var(--color-text-primary)] mb-4">
                Confirm your store details
              </h2>

              {/* Brand color preview */}
              <div className="mb-5 flex items-center gap-4">
                <div
                  className="h-12 w-12 rounded-xl flex-shrink-0 shadow-sm border border-black/5"
                  style={{ backgroundColor: brandColor }}
                />
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-text-secondary)]">
                    Detected brand
                  </p>
                  <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">
                    {result.storeName}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div>
                  <label htmlFor="store-name" className="mb-1.5 block text-sm font-medium text-[color:var(--color-text-primary)]">
                    Store name
                  </label>
                  <input
                    id="store-name"
                    type="text"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/20 transition-colors duration-150"
                  />
                </div>
                <div>
                  <label htmlFor="industry" className="mb-1.5 block text-sm font-medium text-[color:var(--color-text-primary)]">
                    Industry
                  </label>
                  <select
                    id="industry"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/20 transition-colors duration-150 bg-[color:var(--color-surface)]"
                  >
                    {INDUSTRIES.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="brand-color" className="mb-1.5 block text-sm font-medium text-[color:var(--color-text-primary)]">
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
                    <div className="flex-1 rounded-lg border border-[color:var(--color-border)] px-3 py-2.5 text-sm text-[color:var(--color-text-secondary)] bg-[color:var(--color-surface-sunken)]">
                      {brandColor}
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={handleConfirm}
                className="mt-6 w-full rounded-xl bg-[color:var(--color-primary)] px-6 py-3 text-sm font-semibold text-white hover:bg-[color:var(--color-primary-dark)] transition-colors duration-150 active:scale-[0.98]"
              >
                Start fixing my score — it&apos;s free
              </button>
              <p className="mt-2 text-center text-xs text-[color:var(--color-text-secondary)]">
                Free to start. No credit card required.
              </p>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
