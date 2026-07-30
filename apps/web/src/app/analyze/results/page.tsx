"use client";

import { useEffect, useState, useCallback } from "react";
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
  analysisSource?: "bedrock" | "anthropic" | "gemini" | "heuristic";
  popup?: CheckItem;
  emailCapture?: CheckItem;
  socialProof?: CheckItem;
  urgency?: CheckItem;
  exitIntent?: CheckItem;
  stickyBar?: CheckItem;
  checks?: {
    hasPopup: boolean;
    hasExitIntent: boolean;
    hasEmailCapture: boolean;
    hasSocialProof: boolean;
    hasUrgency: boolean;
    hasABTest: boolean;
  };
}

// What Asmos can actually fix — no live chat, no A/B test infra
interface CheckMeta {
  key: keyof AnalyzeResult | string;
  label: string;
  // shown when missing — written to make user feel the pain and only Asmos can fix it
  missingHeadline: string;
  missingBody: string;
  // shown when present
  foundLabel: string;
}

const CHECK_META: CheckMeta[] = [
  {
    key: "popup",
    label: "Popup campaign",
    missingHeadline: "No popup — you're gifting revenue to your competitors",
    missingBody: "Every visitor who leaves without subscribing is gone. Stores with a high-converting popup capture 4–8% of cold traffic. Without one, that email list stays empty.",
    foundLabel: "Running a popup",
  },
  {
    key: "emailCapture",
    label: "Email capture offer",
    missingHeadline: "No offer to capture emails — cold traffic disappears",
    missingBody: "A discount or lead magnet is the difference between a one-time visitor and a customer you can reach 10 times. Without it you're paying for traffic you can only use once.",
    foundLabel: "Email capture active",
  },
  {
    key: "socialProof",
    label: "Social proof",
    missingHeadline: "No reviews visible — visitors don't trust you yet",
    missingBody: "93% of shoppers read reviews before buying. If a visitor can't see that other people love your product, they'll find a store where they can.",
    foundLabel: "Reviews present",
  },
  {
    key: "urgency",
    label: "Urgency signals",
    missingHeadline: "No urgency — shoppers will 'come back later' and never do",
    missingBody: "Without a reason to buy now, people bookmark and forget. A countdown, low-stock badge, or time-limited offer can double your conversion rate on the same traffic.",
    foundLabel: "Urgency messaging detected",
  },
  {
    key: "exitIntent",
    label: "Exit-intent recovery",
    missingHeadline: "No exit recovery — 70% of your visitors walk out the door",
    missingBody: "The moment someone moves to close the tab is your last chance. An exit-intent popup with the right offer recovers 5–15% of abandoning visitors. Right now that revenue is gone.",
    foundLabel: "Exit-intent active",
  },
  {
    key: "stickyBar",
    label: "Announcement bar",
    missingHeadline: "No sticky bar — your best offer is invisible on scroll",
    missingBody: "A persistent top bar keeps your shipping offer or discount in front of visitors the entire time they're on your site. Without it, your offer disappears the moment they scroll.",
    foundLabel: "Announcement bar visible",
  },
];

function getCheck(result: AnalyzeResult, key: string): { found: boolean; description: string } {
  const val = (result as unknown as Record<string, unknown>)[key];
  if (val && typeof val === "object" && "found" in (val as object)) {
    return val as CheckItem;
  }
  // Legacy heuristic shape
  const legacyMap: Record<string, string> = {
    popup: "hasPopup",
    emailCapture: "hasEmailCapture",
    socialProof: "hasSocialProof",
    urgency: "hasUrgency",
    exitIntent: "hasExitIntent",
    stickyBar: "hasStickyBar",
  };
  if (result.checks && legacyMap[key]) {
    const found = (result.checks as Record<string, boolean>)[legacyMap[key]] ?? false;
    return { found, description: found ? "Detected" : "None detected" };
  }
  return { found: false, description: "None detected" };
}

function gradeTextColor(grade: string) {
  if (grade.startsWith("A")) return "#059669"; // emerald
  if (grade.startsWith("B")) return "#2563eb"; // blue
  if (grade.startsWith("C")) return "#d97706"; // amber
  return "#dc2626"; // red
}

function gradeBgClass(grade: string) {
  if (grade.startsWith("A")) return "bg-emerald-50 border-emerald-200";
  if (grade.startsWith("B")) return "bg-blue-50 border-blue-200";
  if (grade.startsWith("C")) return "bg-amber-50 border-amber-200";
  return "bg-red-50 border-red-200";
}

export default function AnalyzeResultsPage() {
  const router = useRouter();
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [email, setEmail] = useState("");
  const [emailState, setEmailState] = useState<"idle" | "submitting" | "sent">("idle");
  const [emailError, setEmailError] = useState("");

  useEffect(() => {
    const raw = sessionStorage.getItem("asmos_analyze_result");
    if (!raw) { router.replace("/"); return; }
    try {
      const data: AnalyzeResult = JSON.parse(raw);
      setResult(data);
      if (sessionStorage.getItem("asmos_email_captured")) setEmailState("sent");
    } catch { router.replace("/"); }
  }, [router]);

  const handleEmailSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Enter a valid email address.");
      return;
    }
    setEmailError("");
    setEmailState("submitting");

    // Save email to DB
    if (result) {
      fetch("/api/analyze/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          storeUrl: result.storeUrl,
          storeName: result.storeName,
          industry: result.industry,
          score: result.score,
          grade: result.grade,
        }),
      }).catch(() => {}); // fire and forget — don't block UX
    }

    sessionStorage.setItem("asmos_email_captured", email.toLowerCase().trim());
    await new Promise(r => setTimeout(r, 700));
    setEmailState("sent");
  }, [email, result]);

  if (!result) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-white">
        <div className="h-7 w-7 rounded-full border-2 border-blue-100 border-t-blue-600" style={{ animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const checks = CHECK_META.map(m => ({ ...m, ...getCheck(result, m.key) }));
  const passedCount = checks.filter(c => c.found).length;
  const failedCount = checks.length - passedCount;
  const isAI = result.analysisSource && result.analysisSource !== "heuristic";
  const gradeColor = gradeTextColor(result.grade);
  const noPopup = !getCheck(result, "popup").found;

  return (
    <div className="min-h-[100dvh] bg-white">
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fade-up 0.4s ease-out both; }
        .fade-up-1 { animation: fade-up 0.4s 0.05s ease-out both; }
        .fade-up-2 { animation: fade-up 0.4s 0.1s ease-out both; }
        .fade-up-3 { animation: fade-up 0.4s 0.15s ease-out both; }
        .fade-up-4 { animation: fade-up 0.4s 0.2s ease-out both; }
      `}</style>

      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-gray-100 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-xl items-center justify-between px-5 py-3.5">
          <Image src="/assets/asmos-logo-primary-lightbg.webp" alt="Asmos" width={88} height={22} priority className="h-5.5 w-auto" />
          <Link href="/sign-in" className="text-xs font-medium text-gray-400 hover:text-gray-700 transition-colors">
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-5 pb-24 pt-8 space-y-5">

        {/* ── Screenshot card ── */}
        {result.screenshotBase64 && (
          <div className="fade-up overflow-hidden rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-1.5 border-b border-gray-100 bg-gray-50 px-3.5 py-2">
              <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
              <span className="ml-2 flex-1 truncate rounded bg-gray-200/70 px-2.5 py-0.5 text-[11px] text-gray-400">
                {result.storeUrl}
              </span>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:image/jpeg;base64,${result.screenshotBase64}`}
              alt="Store screenshot"
              className="w-full object-cover object-top"
              style={{ maxHeight: 260 }}
            />
            {isAI && (
              <div className="flex items-center gap-1.5 border-t border-gray-100 bg-gray-50 px-3.5 py-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                <span className="text-[11px] text-gray-400">
                  Analyzed by AI vision · {result.analysisSource === "bedrock" ? "Claude Haiku" : result.analysisSource === "anthropic" ? "Claude Haiku" : "Gemini Flash"}
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── Score hero ── */}
        <div className={`fade-up-1 rounded-2xl border p-5 ${gradeBgClass(result.grade)}`}>
          <div className="flex items-start gap-4">
            {/* Grade */}
            <div className="flex-shrink-0 w-20 text-center">
              <div
                className="text-[56px] font-black leading-none tabular-nums"
                style={{ color: gradeColor }}
              >
                {result.grade}
              </div>
              <div className="mt-1 text-xs font-semibold" style={{ color: gradeColor }}>
                {result.score}/100
              </div>
            </div>
            {/* Store info */}
            <div className="flex-1 min-w-0 pt-1">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-0.5">
                CRO score for
              </p>
              <p className="text-lg font-bold text-gray-900 leading-tight truncate">
                {result.storeName}
              </p>
              <p className="text-sm text-gray-500 mt-0.5">{result.gradeLabel}</p>
            </div>
          </div>

          {/* Verdict */}
          {result.verdict && !result.verdict.includes("HTML signals") && (
            <p className="mt-4 text-sm font-medium text-gray-700 leading-relaxed border-t border-black/5 pt-4">
              {result.verdict}
            </p>
          )}

          {/* Pass/fail bar */}
          <div className="mt-4 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/5">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${(passedCount / checks.length) * 100}%`,
                  backgroundColor: gradeColor,
                }}
              />
            </div>
            <span className="text-xs font-semibold text-gray-500 tabular-nums flex-shrink-0">
              {passedCount}/{checks.length} tools
            </span>
          </div>
        </div>

        {/* ── Checks ── */}
        <div className="fade-up-2 space-y-2.5">
          {checks.map((c) => (
            <div
              key={c.key}
              className={`rounded-xl border px-4 py-3.5 ${
                c.found
                  ? "border-emerald-100 bg-emerald-50/50"
                  : "border-gray-100 bg-white"
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Status icon */}
                <div className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${c.found ? "bg-emerald-100" : "bg-red-50"}`}>
                  {c.found ? (
                    <svg className="h-3 w-3 text-emerald-600" fill="none" viewBox="0 0 12 12">
                      <path stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M2 6l2.5 2.5L10 3.5" />
                    </svg>
                  ) : (
                    <svg className="h-3 w-3 text-red-400" fill="none" viewBox="0 0 12 12">
                      <path stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" d="M3 3l6 6M9 3l-6 6" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-semibold ${c.found ? "text-gray-700" : "text-gray-900"}`}>
                      {c.label}
                    </span>
                    {c.found && c.description && c.description !== "Detected" && c.description !== "None detected" && c.description !== "Detected via script signals" && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 truncate max-w-[180px]">
                        {c.description}
                      </span>
                    )}
                    {c.found && (
                      <span className="text-xs text-emerald-600 font-medium">{c.foundLabel}</span>
                    )}
                  </div>
                  {!c.found && (
                    <div className="mt-1.5">
                      <p className="text-sm font-semibold text-red-600 leading-snug">{c.missingHeadline}</p>
                      <p className="mt-1 text-xs text-gray-500 leading-relaxed">{c.missingBody}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── No popup CTA block ── */}
        {noPopup && emailState !== "sent" && (
          <div className="fade-up-3 rounded-2xl border border-blue-100 bg-blue-50 px-5 py-5">
            <p className="text-sm font-bold text-blue-900 mb-1">No popup detected on {result.storeName}</p>
            <p className="text-xs text-blue-700 mb-4 leading-relaxed">
              Asmos builds high-converting popups for you in minutes — no design skills, no developers. Try a different URL or build your first popup free.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={() => router.push("/")}
                className="flex-1 rounded-lg border border-blue-200 bg-white px-4 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-50 transition-colors text-center"
              >
                Try a different URL
              </button>
              <button
                onClick={() => router.push("/sign-up")}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors text-center"
              >
                Build one free with Asmos
              </button>
            </div>
          </div>
        )}

        {/* ── Email gate / sent state ── */}
        <div className="fade-up-4">
          {emailState === "sent" ? (
            /* ── Post-email: sent confirmation + sign-up CTA ── */
            <div className="rounded-2xl border border-gray-100 bg-white px-5 py-6 shadow-sm text-center">
              <div className="mb-3 flex justify-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50">
                  <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 20 20">
                    <path stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M4 10l4 4 8-8" />
                  </svg>
                </div>
              </div>
              <p className="text-base font-bold text-gray-900">Check your inbox</p>
              <p className="mt-1.5 text-sm text-gray-500 leading-relaxed max-w-xs mx-auto">
                Your CRO report is on its way. In the meantime, fix {failedCount > 0 ? `your ${failedCount} missing tool${failedCount > 1 ? "s" : ""}` : "your store"} right now — it takes minutes.
              </p>
              <button
                onClick={() => router.push("/sign-up")}
                className="mt-5 w-full rounded-xl bg-[color:var(--color-primary)] px-6 py-3.5 text-sm font-bold text-white hover:bg-[color:var(--color-primary-dark)] transition-colors active:scale-[0.98]"
              >
                Create account to fix it
              </button>
              <p className="mt-2 text-[11px] text-gray-400">Free to start. No credit card.</p>
            </div>
          ) : (
            /* ── Email capture form ── */
            <div className="rounded-2xl border border-gray-100 bg-white px-5 py-6 shadow-sm">
              <p className="text-base font-bold text-gray-900">
                {failedCount > 0
                  ? `You're losing revenue from ${failedCount} gap${failedCount > 1 ? "s" : ""}. Fix them free.`
                  : "Your store is strong. Make it unbeatable."}
              </p>
              <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">
                {failedCount > 0
                  ? "Enter your email — we'll send you a step-by-step fix for every gap above. Asmos builds the tools for you, no code needed."
                  : "Enter your email to see where you can push your score to 100."}
              </p>
              <form onSubmit={handleEmailSubmit} className="mt-4 flex flex-col gap-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@yourstore.com"
                  autoFocus
                  disabled={emailState === "submitting"}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-colors disabled:opacity-50"
                />
                {emailError && <p className="text-xs text-red-500">{emailError}</p>}
                <button
                  type="submit"
                  disabled={emailState === "submitting"}
                  className="w-full rounded-xl bg-[color:var(--color-primary)] px-6 py-3.5 text-sm font-bold text-white hover:bg-[color:var(--color-primary-dark)] transition-colors active:scale-[0.98] disabled:opacity-60"
                >
                  {emailState === "submitting" ? "One moment..." : "Show me how to fix it, free"}
                </button>
                <p className="text-center text-[11px] text-gray-400">No spam. Unsubscribe any time.</p>
              </form>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
