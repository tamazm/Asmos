"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

interface CheckItem {
  found: boolean;
  description: string;
}

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
  topIssue: string;
  verdict: string;
  screenshotBase64?: string | null;
  analysisSource?: "anthropic" | "gemini" | "heuristic";
  // AI shape
  popup?: CheckItem;
  emailCapture?: CheckItem;
  socialProof?: CheckItem;
  urgency?: CheckItem;
  exitIntent?: CheckItem;
  stickyBar?: CheckItem;
  liveChat?: CheckItem;
  // legacy heuristic shape
  checks?: {
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

interface CheckMeta {
  label: string;
  description: string;
  key: keyof AnalyzeResult;
  emptyLabel: string;
}

const CHECK_META: CheckMeta[] = [
  { key: "popup",        label: "Popup / opt-in",          description: "Captures visitors with an offer before they leave",        emptyLabel: "No popup detected — you're losing email subscribers" },
  { key: "emailCapture", label: "Email capture offer",      description: "Discount or lead magnet to collect emails",               emptyLabel: "No email capture — visitors leave with no way to re-engage" },
  { key: "socialProof",  label: "Social proof & reviews",   description: "Reviews, ratings, or trust signals that build confidence", emptyLabel: "No social proof — cold traffic won't convert without trust" },
  { key: "urgency",      label: "Urgency / scarcity",       description: "Limited time or low stock messaging",                     emptyLabel: "No urgency — shoppers have no reason to buy now vs later" },
  { key: "exitIntent",   label: "Exit-intent recovery",     description: "Catches visitors about to bounce with a last offer",      emptyLabel: "No exit intent — you're losing 70%+ of abandoning visitors" },
  { key: "stickyBar",    label: "Sticky announcement bar",  description: "Persistent top bar promoting offers or shipping",         emptyLabel: "No sticky bar — your offer isn't always visible" },
  { key: "liveChat",     label: "Live chat / support",      description: "Real-time support that removes buying friction",          emptyLabel: "No live chat — questions go unanswered = lost sales" },
];

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

function getCheckValue(result: AnalyzeResult, key: keyof AnalyzeResult): { found: boolean; description: string } {
  const val = result[key];
  if (val && typeof val === "object" && "found" in (val as object)) {
    return val as CheckItem;
  }
  // Legacy heuristic shape
  const legacyMap: Record<string, keyof NonNullable<AnalyzeResult["checks"]>> = {
    popup: "hasPopup",
    emailCapture: "hasEmailCapture",
    socialProof: "hasSocialProof",
    urgency: "hasUrgency",
    exitIntent: "hasExitIntent",
  };
  if (result.checks && legacyMap[key as string]) {
    const found = result.checks[legacyMap[key as string]] ?? false;
    return { found, description: found ? "Detected" : "None detected" };
  }
  return { found: false, description: "None detected" };
}

export default function AnalyzeResultsPage() {
  const router = useRouter();
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [storeName, setStoreName] = useState("");
  const [industry, setIndustry] = useState("");
  const [brandColor, setBrandColor] = useState("#165DFF");

  const [email, setEmail] = useState("");
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("asmos_analyze_result");
    if (!raw) { router.replace("/"); return; }
    try {
      const data: AnalyzeResult = JSON.parse(raw);
      setResult(data);
      setStoreName(data.storeName ?? "");
      setIndustry(data.industry ?? INDUSTRIES[0]);
      setBrandColor(data.brandColor ?? "#165DFF");
      if (sessionStorage.getItem("asmos_email_captured")) setEmailSubmitted(true);
    } catch { router.replace("/"); }
  }, [router]);

  function validateEmail(val: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateEmail(email)) { setEmailError("Enter a valid email address."); return; }
    setEmailError("");
    setSubmitting(true);
    sessionStorage.setItem("asmos_email_captured", email);
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
        <div className="h-8 w-8 rounded-full border-2 border-[color:var(--color-primary-light)] border-t-[color:var(--color-primary)]" style={{ animation: "spin 0.9s linear infinite" }} aria-label="Loading" />
        <style jsx global>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const checks = CHECK_META.map((m) => ({ ...m, ...getCheckValue(result, m.key) }));
  const passedCount = checks.filter((c) => c.found).length;
  const failedCount = checks.length - passedCount;
  const isAI = result.analysisSource === "anthropic" || result.analysisSource === "gemini";

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[color:var(--color-surface)]">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-[color:var(--color-border)] px-6 py-4">
        <Image src="/assets/asmos-logo-primary-lightbg.webp" alt="Asmos" width={110} height={28} priority className="h-7 w-auto" />
        <Link href="/sign-in" className="text-sm text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)] transition-colors duration-150">
          Already have an account?
        </Link>
      </header>

      <main className="flex flex-1 flex-col items-center px-6 py-12">
        <div className="w-full max-w-lg animate-page-enter space-y-5">

          {/* ── Screenshot preview ── */}
          {result.screenshotBase64 && (
            <div className="overflow-hidden rounded-2xl border border-[color:var(--color-border)] shadow-sm">
              {/* Browser chrome bar */}
              <div className="flex items-center gap-1.5 border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] px-4 py-2.5">
                <span className="h-3 w-3 rounded-full bg-red-400" />
                <span className="h-3 w-3 rounded-full bg-amber-400" />
                <span className="h-3 w-3 rounded-full bg-emerald-400" />
                <span className="ml-3 flex-1 rounded bg-[color:var(--color-border)] px-3 py-1 text-xs text-[color:var(--color-text-secondary)] truncate">
                  {result.storeUrl}
                </span>
              </div>
              {/* Screenshot */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`data:image/jpeg;base64,${result.screenshotBase64}`}
                alt="Website screenshot"
                className="w-full object-cover"
                style={{ maxHeight: 280 }}
              />
              {isAI && (
                <div className="flex items-center gap-1.5 border-t border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] px-4 py-2">
                  <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                  <span className="text-xs text-[color:var(--color-text-secondary)]">
                    AI-powered visual analysis via {result.analysisSource === "anthropic" ? "Claude Haiku" : "Gemini Flash"}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ── Score card ── */}
          <div className={`rounded-2xl border p-6 shadow-sm ${gradeBg(result.grade)}`}>
            <div className="flex items-center gap-5">
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
                  {" · "}
                  <span className="tabular-nums">{result.score ?? 0}/100</span>
                </p>
              </div>
            </div>

            {/* Verdict */}
            {result.verdict && (
              <p className="mt-4 rounded-lg bg-white/60 px-4 py-3 text-sm font-medium text-[color:var(--color-text-primary)] italic">
                &ldquo;{result.verdict}&rdquo;
              </p>
            )}

            {/* Top issue callout */}
            {result.topIssue && failedCount > 0 && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <span className="mt-0.5 text-base leading-none">⚠️</span>
                <p className="text-sm text-amber-800">{result.topIssue}</p>
              </div>
            )}

            {/* Check breakdown */}
            <div className="mt-5 space-y-3">
              {checks.map((c) => (
                <div key={String(c.key)} className="flex items-start gap-3 text-sm">
                  <span className={`mt-0.5 text-base leading-none flex-shrink-0 ${c.found ? "text-emerald-500" : "text-red-400"}`}>
                    {c.found ? "✓" : "✗"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-medium ${c.found ? "text-[color:var(--color-text-primary)]" : "text-[color:var(--color-text-secondary)]"}`}>
                        {c.label}
                      </span>
                      {c.found && c.description && c.description !== "Detected" && c.description !== "None detected" && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 font-medium truncate max-w-[200px]">
                          {c.description}
                        </span>
                      )}
                    </div>
                    {!c.found && (
                      <p className="mt-0.5 text-xs text-red-500 font-medium">{c.emptyLabel}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <p className="mt-5 text-sm font-medium text-[color:var(--color-text-secondary)]">
              <span className="font-bold text-[color:var(--color-text-primary)]">{passedCount} of {checks.length}</span>{" "}
              conversion tools detected.{" "}
              {failedCount > 0 && (
                <span className="text-red-500 font-semibold">{failedCount} gap{failedCount !== 1 ? "s" : ""} = lost revenue.</span>
              )}
            </p>
          </div>

          {/* ── No popup CTA ── */}
          {!getCheckValue(result, "popup").found && (
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🚫</span>
                <div>
                  <p className="font-semibold text-[color:var(--color-text-primary)]">No popup detected</p>
                  <p className="mt-0.5 text-sm text-[color:var(--color-text-secondary)]">
                    Stores with a popup capture 3–8% of visitors as email subscribers. Without one, that traffic is gone forever.
                  </p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <a
                      href={result.storeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-[color:var(--color-border)] px-4 py-2 text-sm font-medium text-[color:var(--color-text-secondary)] hover:border-[color:var(--color-primary)] hover:text-[color:var(--color-primary)] transition-colors duration-150 text-center"
                    >
                      Try a different URL
                    </a>
                    <button
                      onClick={() => router.push("/sign-up")}
                      className="rounded-lg bg-[color:var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[color:var(--color-primary-dark)] transition-colors duration-150"
                    >
                      Build one free with Asmos →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Email gate ── */}
          {!emailSubmitted ? (
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 shadow-sm">
              <h2 className="text-lg font-bold text-[color:var(--color-text-primary)]">
                See exactly what to fix, free
              </h2>
              <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
                Enter your email and we&apos;ll show you a step-by-step plan to bring your score to an A+. No credit card. No catch.
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
                {emailError && <p className="text-xs text-red-500">{emailError}</p>}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-lg bg-[color:var(--color-primary)] px-6 py-3 text-sm font-semibold text-white hover:bg-[color:var(--color-primary-dark)] transition-colors duration-150 active:scale-[0.98] disabled:opacity-60"
                >
                  {submitting ? "One moment..." : "Show me how to fix it, free"}
                </button>
                <p className="text-center text-xs text-[color:var(--color-text-secondary)]">No spam. Unsubscribe any time.</p>
              </form>
            </div>
          ) : (
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 shadow-sm">
              <h2 className="text-base font-bold text-[color:var(--color-text-primary)] mb-4">Confirm your store details</h2>
              <div className="mb-5 flex items-center gap-4">
                <div className="h-12 w-12 rounded-md flex-shrink-0 shadow-sm border border-black/5" style={{ backgroundColor: brandColor }} />
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-text-secondary)]">Detected brand</p>
                  <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">{result.storeName}</p>
                </div>
              </div>
              <div className="flex flex-col gap-4">
                <div>
                  <label htmlFor="store-name" className="mb-1.5 block text-sm font-medium text-[color:var(--color-text-primary)]">Store name</label>
                  <input id="store-name" type="text" value={storeName} onChange={(e) => setStoreName(e.target.value)}
                    className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/20 transition-colors duration-150" />
                </div>
                <div>
                  <label htmlFor="industry" className="mb-1.5 block text-sm font-medium text-[color:var(--color-text-primary)]">Industry</label>
                  <select id="industry" value={industry} onChange={(e) => setIndustry(e.target.value)}
                    className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/20 transition-colors duration-150 bg-[color:var(--color-surface)]">
                    {INDUSTRIES.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="brand-color" className="mb-1.5 block text-sm font-medium text-[color:var(--color-text-primary)]">Brand color</label>
                  <div className="flex items-center gap-3">
                    <input id="brand-color" type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)}
                      className="h-10 w-10 cursor-pointer rounded-lg border border-[color:var(--color-border)] p-0.5" />
                    <div className="flex-1 rounded-lg border border-[color:var(--color-border)] px-3 py-2.5 text-sm text-[color:var(--color-text-secondary)] bg-[color:var(--color-surface-sunken)]">
                      {brandColor}
                    </div>
                  </div>
                </div>
              </div>
              <button onClick={handleConfirm}
                className="mt-6 w-full rounded-lg bg-[color:var(--color-primary)] px-6 py-3 text-sm font-semibold text-white hover:bg-[color:var(--color-primary-dark)] transition-colors duration-150 active:scale-[0.98]">
                Start fixing my score, free
              </button>
              <p className="mt-2 text-center text-xs text-[color:var(--color-text-secondary)]">Free to start. No credit card required.</p>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
