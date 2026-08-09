"use client";

import { useEffect, useState, useCallback, startTransition, useRef } from "react";
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
  // Popup generation engine fields
  brandTokens?: {
    palette: string[];
    type_display: string;
    type_body: string;
    imagery_style: string;
    signature_element_suggestion: string;
  };
  existingPopup?: {
    captured: boolean;
    extracted_copy: { headline: string; subhead: string; cta: string };
    extracted_structure: { trigger_guess: string; fields: string[]; layout: string };
  };
  computedStyles?: {
    colors_in_use: string[];
    font_stack: string[];
    common_border_radius: string;
  };
}

interface GeneratedPopup {
  mode: "IMPROVE_EXISTING" | "CREATE_NEW";
  baseline: {
    popup_id: string;
    diagnosis: Array<{ lever: string; change: string; reason: string }>;
    spec: {
      trigger: string;
      frequency_cap: string;
      headline: string;
      subhead: string;
      cta: string;
      fields: string[];
      design_tokens: { palette: string[]; type_display: string; type_body: string };
    };
    code: string;
  };
  tracking_events: { shown: string; dismissed: string; converted: string };
}


interface CheckMeta {
  key: keyof AnalyzeResult | string;
  label: string;
  missingHeadline: string;
  missingBody: string;
  foundLabel: string;
  impact: "high" | "medium" | "low";
}

const CHECK_META: CheckMeta[] = [
  {
    key: "popup",
    label: "Email popup",
    missingHeadline: "Visitors leave without buying — and you lose them forever",
    missingBody: "Stores with a high-converting popup recover 4–8% of visitors who leave without purchasing. Without one, every visitor who doesn't buy on the first visit is lost revenue you'll never get back.",
    foundLabel: "Active",
    impact: "high",
  },
  {
    key: "emailCapture",
    label: "Capture offer",
    missingHeadline: "No offer — visitors have no reason to buy now or come back later",
    missingBody: "A discount or freebie converts fence-sitters into buyers and gives you permission to bring them back. Without it, you pay for traffic you can only use once.",
    foundLabel: "Active",
    impact: "high",
  },
  {
    key: "exitIntent",
    label: "Exit-intent recovery",
    missingHeadline: "70% of your visitors leave without buying — nothing brings them back",
    missingBody: "Catching the exit moment with the right offer turns abandoning visitors into customers. Right now that revenue is gone for good.",
    foundLabel: "Active",
    impact: "high",
  },
  {
    key: "urgency",
    label: "Urgency signals",
    missingHeadline: "No urgency: shoppers say they'll come back and spend the money elsewhere",
    missingBody: "A countdown, low-stock notice, or time-limited offer pushes people to buy now instead of never. Same traffic, more sales.",
    foundLabel: "Present",
    impact: "medium",
  },
  {
    key: "socialProof",
    label: "Social proof",
    missingHeadline: "No reviews visible — visitors won't buy without proof others have",
    missingBody: "93% of shoppers read reviews before handing over money. If first-time visitors can't find social proof, they will buy from someone else.",
    foundLabel: "Present",
    impact: "medium",
  },
  {
    key: "stickyBar",
    label: "Announcement bar",
    missingHeadline: "Your best offer disappears the moment visitors scroll",
    missingBody: "A persistent bar keeps your shipping offer or discount visible the entire visit — the simplest, highest-ROI thing you can add.",
    foundLabel: "Present",
    impact: "low",
  },
];

function getCheck(result: AnalyzeResult, key: string): { found: boolean; description: string } {
  const val = (result as unknown as Record<string, unknown>)[key];
  if (val && typeof val === "object" && "found" in (val as object)) {
    return val as CheckItem;
  }
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

// Score ring arc
function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 44;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg width="110" height="110" viewBox="0 0 110 110" className="block">
      <circle cx="55" cy="55" r={r} fill="none" stroke="oklch(96% 0.005 258)" strokeWidth="8" />
      <circle
        cx="55" cy="55" r={r}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        strokeDashoffset={circ / 4}
        style={{ transition: "stroke-dasharray 0.9s cubic-bezier(0.16,1,0.3,1)" }}
      />
      <text x="55" y="51" textAnchor="middle" fontSize="24" fontWeight="800" fill={color} fontFamily="inherit">{score}</text>
      <text x="55" y="66" textAnchor="middle" fontSize="11" fontWeight="600" fill="oklch(60% 0.02 258)" fontFamily="inherit">/100</text>
    </svg>
  );
}

function gradeColor(grade: string): string {
  if (grade.startsWith("A")) return "oklch(48% 0.16 155)";
  if (grade.startsWith("B")) return "oklch(50% 0.20 258)";
  if (grade.startsWith("C")) return "oklch(58% 0.18 70)";
  return "oklch(52% 0.20 22)";
}

function impactDot(impact: "high" | "medium" | "low") {
  if (impact === "high") return "bg-red-400";
  if (impact === "medium") return "bg-amber-400";
  return "bg-gray-300";
}

export default function AnalyzeResultsPage() {
  const router = useRouter();
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [email, setEmail] = useState("");
  const [emailState, setEmailState] = useState<"idle" | "submitting" | "sent">("idle");
  const [emailError, setEmailError] = useState("");
  const emailInputRef = useRef<HTMLInputElement>(null);
  const [generatedPopup, setGeneratedPopup] = useState<GeneratedPopup | null>(null);
  const [popupGenerating, setPopupGenerating] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("asmos_analyze_result");
    if (!raw) { router.replace("/"); return; }
    try {
      const data: AnalyzeResult = JSON.parse(raw);
      const captured = Boolean(sessionStorage.getItem("asmos_email_captured"));
      startTransition(() => {
        setResult(data);
        if (captured) setEmailState("sent");
      });

      // Kick off popup generation in the background — don't block the page render
      const cachedPopup = sessionStorage.getItem("asmos_generated_popup");
      if (cachedPopup) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        try { setGeneratedPopup(JSON.parse(cachedPopup)); } catch { /* ignore */ }
      } else {
        setPopupGenerating(true);
        fetch("/api/analyze/generate-popup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: raw,
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((popup) => {
            if (popup?.baseline) {
              sessionStorage.setItem("asmos_generated_popup", JSON.stringify(popup));
              setGeneratedPopup(popup as GeneratedPopup);
            }
          })
          .catch(() => { /* silent — fallback renders without AI popup */ })
          .finally(() => setPopupGenerating(false));
      }
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

    if (result) {
      // Send the specific findings along with the lead, not just score/grade
      // — this is what lets the follow-up email (see lib/email.ts's
      // sendReportEmail) reference this store's actual weaknesses instead
      // of being a generic "your report is ready" notification. Capped at
      // the 3 highest-impact misses so the email stays focused.
      const impactRank: Record<string, number> = { high: 0, medium: 1, low: 2 };
      const topFindings = failedChecks
        .slice()
        .sort((a, b) => impactRank[a.impact] - impactRank[b.impact])
        .slice(0, 3)
        .map((c) => ({ label: c.label, headline: c.missingHeadline }));

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
          gradeLabel: result.gradeLabel,
          topIssue: result.topIssue,
          topFindings,
        }),
      }).catch(() => {});
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
  const failedChecks = checks.filter(c => !c.found);
  const passedChecks = checks.filter(c => c.found);
  const color = gradeColor(result.grade);
  const isAI = result.analysisSource && result.analysisSource !== "heuristic";
  const brandColor = result.brandColor && result.brandColor !== "#165DFF" ? result.brandColor : "#165DFF";

  return (
    <div className="min-h-[100dvh] bg-white">
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fi   { animation: fade-in 0.45s ease-out both; }
        .fi-1 { animation: fade-in 0.45s 0.07s ease-out both; }
        .fi-2 { animation: fade-in 0.45s 0.14s ease-out both; }
        .fi-3 { animation: fade-in 0.45s 0.21s ease-out both; }
        .fi-4 { animation: fade-in 0.45s 0.28s ease-out both; }
      `}</style>

      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-gray-100 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg items-center justify-between px-5 py-3.5">
          <Image src="/assets/asmos-logo-primary-lightbg.webp" alt="Asmos" width={88} height={22} priority className="h-5 w-auto" />
          <Link href="/sign-in" className="text-xs font-medium text-gray-400 hover:text-gray-700 transition-colors">
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-5 pt-8 pb-20 space-y-5">

        {/* ─────────────── 1. SCORE HERO ─────────────── */}
        <section className="fi">
          {/* Screenshot browser chrome */}
          {result.screenshotBase64 && (
            <div className="mb-4 overflow-hidden rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center gap-1.5 border-b border-gray-100 bg-gray-50 px-3.5 py-2">
                <span className="h-2 w-2 rounded-full bg-red-300" />
                <span className="h-2 w-2 rounded-full bg-amber-300" />
                <span className="h-2 w-2 rounded-full bg-emerald-300" />
                <span className="ml-2 flex-1 truncate rounded bg-white/80 px-2.5 py-0.5 text-[11px] text-gray-400 border border-gray-200">
                  {result.storeUrl.replace(/^https?:\/\//, "")}
                </span>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`data:image/jpeg;base64,${result.screenshotBase64}`}
                alt="Store screenshot"
                className="w-full object-cover object-top"
                style={{ maxHeight: 220 }}
              />
              {isAI && (
                <div className="flex items-center gap-1.5 border-t border-gray-100 bg-gray-50 px-3.5 py-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                  <span className="text-[10px] text-gray-400">
                    AI vision scan ·{" "}
                    {result.analysisSource === "bedrock" || result.analysisSource === "anthropic" ? "Asmos AI" : "Gemini"}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Score card */}
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-5">
              <ScoreRing score={result.score} color={color} />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">
                  CRO score
                </p>
                <p className="text-xl font-extrabold text-gray-900 leading-tight truncate">
                  {result.storeName}
                </p>
                <p className="text-sm mt-0.5 font-medium" style={{ color }}>
                  {result.grade} &middot; {result.gradeLabel}
                </p>
                {result.brandColor && result.brandColor !== "#165DFF" && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <div className="h-3.5 w-3.5 rounded-full border border-black/10" style={{ backgroundColor: result.brandColor }} />
                    <span className="text-[10px] font-mono text-gray-400">{result.brandColor}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Verdict */}
            {result.verdict && !result.verdict.includes("HTML signals") && (
              <p className="mt-4 text-sm text-gray-600 leading-relaxed border-t border-gray-50 pt-4">
                {result.verdict}
              </p>
            )}

            {/* Pass/fail summary chips */}
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              {failedChecks.length > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-400 flex-shrink-0" />
                  {failedChecks.length} gap{failedChecks.length > 1 ? "s" : ""} found
                </span>
              )}
              {passedChecks.length > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                  {passedChecks.length} tool{passedChecks.length > 1 ? "s" : ""} active
                </span>
              )}
            </div>
          </div>
        </section>

        {/* ─────────────── 2. EMAIL GATE ─────────────── */}
        <section className="fi-1">
          {emailState === "sent" ? (
            /* POST-EMAIL: confirmed, push to sign-up */
            <div className="rounded-2xl bg-gray-900 px-5 py-6 text-center">
              <div className="mb-3 flex justify-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20">
                  <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 20 20">
                    <path stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M4 10l4 4 8-8" />
                  </svg>
                </div>
              </div>
              <p className="text-base font-bold text-white">Full report is on its way</p>
              <p className="mt-1.5 text-sm text-gray-400 leading-relaxed max-w-xs mx-auto">
                Your revenue breakdown is on its way. Fix every gap with Asmos — takes 3 minutes to get your first popup live and converting.
              </p>
              <button
                onClick={() => router.push("/sign-up?from=analyze")}
                className="mt-5 w-full rounded-xl py-3.5 text-sm font-bold text-gray-900 bg-white hover:bg-gray-100 transition-colors"
              >
                Start recovering that revenue
              </button>
              <p className="mt-2 text-[11px] text-gray-600">No credit card. Free to start.</p>
            </div>
          ) : (
            /* EMAIL CAPTURE — primary CTA */
            <div className="rounded-2xl bg-gray-900 px-5 py-6">
              <p className="text-lg font-extrabold text-white leading-snug">
                {failedChecks.length > 0
                  ? `${failedChecks.length} gap${failedChecks.length > 1 ? "s" : ""} on your store are leaking revenue right now`
                  : "Your store is strong. Here's how to push revenue further."}
              </p>
              <p className="mt-1.5 text-sm text-gray-400 leading-relaxed">
                {failedChecks.length > 0
                  ? "Get the step-by-step fix for each one — and a popup built for your brand, ready to publish in minutes."
                  : "Get the full breakdown and see where you can drive more revenue."}
              </p>
              <form onSubmit={handleEmailSubmit} className="mt-5 space-y-3">
                <input
                  ref={emailInputRef}
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
                  placeholder="example@gmail.com"
                  disabled={emailState === "submitting"}
                  className="w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-gray-500 outline-none focus:border-white/30 focus:ring-2 focus:ring-white/10 transition-all disabled:opacity-50"
                />
                {emailError && <p className="text-xs text-red-400">{emailError}</p>}
                <button
                  type="submit"
                  disabled={emailState === "submitting"}
                  className="w-full rounded-xl py-3.5 text-sm font-bold text-gray-900 bg-white hover:bg-gray-100 transition-colors disabled:opacity-60 active:scale-[0.98]"
                >
                  {emailState === "submitting" ? "One moment..." : "Show me how to fix it"}
                </button>
                <p className="text-center text-[11px] text-gray-600">No spam. Unsubscribe any time.</p>
              </form>
            </div>
          )}
        </section>

        {/* ─────────────── 3. GAPS (failed checks first, high-impact first) ─────────────── */}
        {failedChecks.length > 0 && (
          <section className="fi-2">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
              What&apos;s costing you sales
            </h2>
            <div className="space-y-2">
              {failedChecks.map((c) => (
                <div key={c.key} className="rounded-xl border border-gray-100 bg-white px-4 py-4">
                  <div className="flex items-start gap-3">
                    <div className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${impactDot(c.impact)}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 leading-snug">{c.missingHeadline}</p>
                      <p className="mt-1 text-xs text-gray-500 leading-relaxed">{c.missingBody}</p>
                      <p className="mt-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{c.label}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ─────────────── 4. PASSING CHECKS ─────────────── */}
        {passedChecks.length > 0 && (
          <section className="fi-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
              What&apos;s working
            </h2>
            <div className="rounded-xl border border-gray-100 divide-y divide-gray-50">
              {passedChecks.map((c) => (
                <div key={c.key} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100">
                    <svg className="h-3 w-3 text-emerald-600" fill="none" viewBox="0 0 12 12">
                      <path stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M2 6l2.5 2.5L10 3.5" />
                    </svg>
                  </div>
                  <div className="flex-1 flex items-center justify-between gap-2 min-w-0">
                    <span className="text-sm font-medium text-gray-700">{c.label}</span>
                    <span className="text-[11px] font-semibold text-emerald-600 flex-shrink-0">{c.foundLabel}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ─────────────── 5. POPUP PREVIEW (AI-generated, blurred teaser) ─────────────── */}
        {result.screenshotBase64 && (
          <section className="fi-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
              Your Asmos popup
            </h2>
            <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white">

              {/* Popup content area */}
              <div
                className="p-4 transition-[filter] duration-700"
                style={{ filter: emailState === "sent" ? "none" : "blur(6px)", pointerEvents: "none", userSelect: "none" }}
              >
                {popupGenerating && !generatedPopup ? (
                  /* Skeleton loader while AI generates */
                  <div className="mx-auto max-w-[280px] rounded-[18px] overflow-hidden shadow-xl animate-pulse">
                    <div className="h-1 bg-gray-200" />
                    <div className="bg-white px-5 pt-4 pb-5 space-y-3">
                      <div className="h-3 w-3/4 bg-gray-100 rounded" />
                      <div className="h-6 w-full bg-gray-100 rounded" />
                      <div className="h-4 w-full bg-gray-100 rounded" />
                      <div className="h-4 w-5/6 bg-gray-100 rounded" />
                      <div className="h-9 w-full bg-gray-200 rounded-lg" />
                      <div className="h-9 w-full bg-gray-100 rounded-lg" />
                    </div>
                  </div>
                ) : generatedPopup?.baseline?.code ? (
                  /* Real AI-generated popup HTML */
                  <div
                    className="mx-auto max-w-[300px]"
                    dangerouslySetInnerHTML={{ __html: generatedPopup.baseline.code }}
                  />
                ) : (
                  /* Spec-based fallback popup (no AI code available) */
                  <SpecPopup
                    headline={generatedPopup?.baseline?.spec?.headline ?? "Get 10% off your first order"}
                    subhead={generatedPopup?.baseline?.spec?.subhead ?? "Join our list and be the first to know about new drops and exclusive deals."}
                    cta={generatedPopup?.baseline?.spec?.cta ?? "Claim my discount"}
                    storeName={result.storeName}
                    primaryColor={generatedPopup?.baseline?.spec?.design_tokens?.palette?.[0] ?? brandColor}
                  />
                )}
              </div>

              {/* AI badge — visible after unlock */}
              {emailState === "sent" && generatedPopup && (
                <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-gray-900/80 px-2.5 py-1 backdrop-blur-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                  <span className="text-[10px] font-medium text-white">AI-generated for {result.storeName}</span>
                </div>
              )}

              {/* Lock overlay — only if email not submitted */}
              {emailState !== "sent" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/70 backdrop-blur-[2px] px-6 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-900">
                    <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>
                  <p className="text-sm font-bold text-gray-900">
                    {popupGenerating ? "Generating your popup..." : "Popup ready to publish"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {popupGenerating
                      ? "AI is designing a branded popup for your store"
                      : "Enter your email above to unlock it"}
                  </p>
                </div>
              )}

              {/* Post-unlock CTA */}
              {emailState === "sent" && (
                <div className="border-t border-gray-100 px-5 py-4 text-center">
                  <button
                    onClick={() => router.push("/sign-up?from=analyze")}
                    className="w-full rounded-xl py-3 text-sm font-bold text-white transition-colors hover:opacity-90"
                    style={{ backgroundColor: brandColor }}
                  >
                    Create account and publish
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ─────────────── 6. EXPERIMENTS ASMOS WOULD RUN (derived from this store's actual findings) ─────────────── */}
        {emailState === "sent" && (
          <section className="fi-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
              Experiments Asmos would run
            </h2>
            <div className="space-y-2.5">
              {buildExperimentIdeas(failedChecks).map((exp, i) => (
                <div key={exp.control} className="rounded-xl border border-gray-100 bg-white px-4 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Experiment {String(i + 1).padStart(2, "0")} — {exp.category}</p>
                  <div className="grid grid-cols-2 gap-3 mb-2">
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase mb-0.5">Control</p>
                      <p className="text-xs text-gray-700">{exp.control}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase mb-0.5">Test</p>
                      <p className="text-xs text-gray-700">{exp.test}</p>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-500 leading-relaxed border-t border-gray-50 pt-2">
                    <span className="font-semibold text-gray-600">Hypothesis: </span>{exp.hypothesis}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-gray-400">These are hypotheses worth testing, not guaranteed outcomes.</p>
          </section>
        )}

        {/* ─────────────── 7. ASMOS TRANSITION ─────────────── */}
        <section className="fi-4 rounded-2xl border border-gray-100 bg-gray-50 px-5 py-7 text-center">
          <p className="text-lg font-extrabold text-gray-900 leading-snug mb-2">
            Analysis tells you what to test. Asmos tests it for you.
          </p>
          <p className="text-xs text-gray-500 leading-relaxed max-w-xs mx-auto mb-5">
            Asmos turns conversion opportunities into experiments, generates variants, measures performance, learns from visitor behavior, and continuously improves your conversion experience.
          </p>
          <div className="flex items-center justify-center gap-1.5 flex-wrap mb-6">
            {["Analysis", "Generate Variants", "Run Experiments", "Find Winners", "Learn", "Optimize Again"].map((s, i, arr) => (
              <span key={s} className="flex items-center gap-1.5">
                <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[10px] font-medium text-gray-500">{s}</span>
                {i < arr.length - 1 && <span className="text-gray-300 text-[10px]">→</span>}
              </span>
            ))}
          </div>
          <div className="flex flex-col gap-2.5 max-w-xs mx-auto">
            <button
              onClick={() => router.push("/sign-up?from=analyze")}
              className="w-full rounded-xl py-3.5 text-sm font-bold text-white bg-gray-900 hover:bg-gray-800 transition-colors active:scale-[0.98]"
            >
              Start Free Trial
            </button>
            <Link
              href="/contact#book-a-demo"
              className="w-full rounded-xl py-3.5 text-sm font-bold text-gray-900 bg-white border border-gray-200 hover:bg-gray-50 transition-colors text-center"
            >
              Book a Demo
            </Link>
          </div>

          {/* High-value lead CTA — shown when several conversion gaps were found */}
          {failedChecks.length >= 3 && (
            <div className="mt-6 rounded-xl bg-white border border-gray-100 px-4 py-4 text-left">
              <p className="text-xs font-bold text-gray-900 mb-1">Want us to help implement these recommendations?</p>
              <p className="text-[11px] text-gray-500 leading-relaxed mb-2.5">
                Our team can personally help you launch your first optimization with Asmos.
              </p>
              <Link href="/contact#book-a-demo" className="text-[11px] font-semibold text-gray-900 underline underline-offset-2">
                Book a Demo →
              </Link>
            </div>
          )}
        </section>

        {/* ─────────────── 8. OTHER FREE TOOLS ─────────────── */}
        <section className="fi-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Explore more free tools</h2>
          <div className="grid grid-cols-1 gap-2.5">
            <Link href="/tools/email-capture-calculator" className="rounded-xl border border-gray-100 bg-white px-4 py-3.5 flex items-center justify-between hover:border-gray-200 transition-colors">
              <div>
                <p className="text-xs font-bold text-gray-900">Email Capture Revenue Calculator</p>
                <p className="text-[11px] text-gray-500 mt-0.5">Estimate how improvements in email capture could translate into additional revenue.</p>
              </div>
              <span className="text-gray-300 text-sm">→</span>
            </Link>
            <Link href="/tools/traffic-calculator" className="rounded-xl border border-gray-100 bg-white px-4 py-3.5 flex items-center justify-between hover:border-gray-200 transition-colors">
              <div>
                <p className="text-xs font-bold text-gray-900">Traffic Calculator</p>
                <p className="text-[11px] text-gray-500 mt-0.5">Estimate and understand your ecommerce traffic opportunity.</p>
              </div>
              <span className="text-gray-300 text-sm">→</span>
            </Link>
          </div>
        </section>

        {/* ─────────────── 9. FINAL CTA ─────────────── */}
        <section className="fi-4 text-center pt-2">
          <p className="text-base font-extrabold text-gray-900 mb-1.5">Ready to stop optimizing manually?</p>
          <p className="text-xs text-gray-500 mb-5 max-w-xs mx-auto">Turn your analysis into continuously running experiments with Asmos.</p>
          <div className="flex flex-col gap-2.5 max-w-xs mx-auto">
            <button
              onClick={() => router.push("/sign-up?from=analyze")}
              className="w-full rounded-xl py-3.5 text-sm font-bold text-white bg-gray-900 hover:bg-gray-800 transition-colors active:scale-[0.98]"
            >
              Start Free Trial
            </button>
            <Link href="/contact#book-a-demo" className="text-xs font-semibold text-gray-500 hover:text-gray-800">
              Book a Demo
            </Link>
          </div>
        </section>

      </main>
    </div>
  );
}

// ─── Experiment ideas derived from this store's actual failed checks ────────
interface ExperimentIdea { category: string; control: string; test: string; hypothesis: string }

const EXPERIMENT_IDEAS_BY_CHECK: Record<string, ExperimentIdea> = {
  popup: {
    category: "Popup",
    control: "No capture popup currently live",
    test: "Introduce a branded popup with a single, clear offer",
    hypothesis: "Capturing visitors before they leave may convert some of the traffic that currently leaves without buying.",
  },
  emailCapture: {
    category: "Offer",
    control: "No incentive shown to new visitors",
    test: "Test a first-order discount or free-shipping threshold offer",
    hypothesis: "An immediate, clear incentive may increase the share of visitors willing to share their email.",
  },
  exitIntent: {
    category: "Trigger",
    control: "No exit-intent recovery",
    test: "Trigger a targeted offer when exit intent is detected",
    hypothesis: "Catching visitors at the moment they're about to leave may recover some abandoning sessions.",
  },
  urgency: {
    category: "Messaging",
    control: "No urgency or scarcity signal",
    test: "Test a time-limited or low-stock message alongside the existing offer",
    hypothesis: "Urgency cues may shift some visitors from 'I'll come back later' to purchasing now.",
  },
  socialProof: {
    category: "Trust",
    control: "No visible reviews or customer proof",
    test: "Surface a review count or rating near the offer",
    hypothesis: "Visible social proof may reduce hesitation for first-time visitors evaluating the store.",
  },
  stickyBar: {
    category: "Layout",
    control: "Offer only visible once, at the top of the page",
    test: "Add a persistent bar keeping the offer visible while scrolling",
    hypothesis: "Keeping the offer visible throughout the session may improve recall and completion.",
  },
};

const GENERIC_EXPERIMENT_IDEAS: ExperimentIdea[] = [
  { category: "CTA", control: "Generic CTA copy (e.g. \"Submit\")", test: "CTA that states the value received (e.g. \"Get 10% Off\")", hypothesis: "Making the CTA communicate the benefit may improve completion." },
  { category: "Form", control: "Single-step form requesting all fields at once", test: "Two-step flow — email first, additional fields second", hypothesis: "Reducing initial form friction may improve completion rate." },
  { category: "Timing", control: "Fixed-delay popup trigger", test: "Scroll-depth or engagement-based trigger", hypothesis: "Showing the offer based on visitor behavior, not just time, may improve relevance." },
];

function buildExperimentIdeas(failedChecks: { key: string }[]): ExperimentIdea[] {
  const fromChecks = failedChecks
    .map((c) => EXPERIMENT_IDEAS_BY_CHECK[c.key])
    .filter((idea): idea is ExperimentIdea => Boolean(idea));
  const combined = [...fromChecks, ...GENERIC_EXPERIMENT_IDEAS];
  return combined.slice(0, 3);
}

// ─── Spec-based fallback popup (when AI code is unavailable) ─────────────────
function SpecPopup({
  headline,
  subhead,
  cta,
  storeName,
  primaryColor,
}: {
  headline: string;
  subhead: string;
  cta: string;
  storeName: string;
  primaryColor: string;
}) {
  return (
    <div className="rounded-[18px] overflow-hidden shadow-xl mx-auto max-w-[280px]">
      <div className="h-1" style={{ backgroundColor: primaryColor }} />
      <div className="bg-white px-5 pt-4 pb-5">
        <div className="flex justify-end mb-2">
          <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center">
            <svg width="7" height="7" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </div>
        </div>
        <div className="flex items-center gap-1.5 mb-3">
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: primaryColor }} />
          <span className="text-[9px] font-bold tracking-[0.08em] uppercase text-gray-400">{storeName.toUpperCase()}</span>
        </div>
        <h3 className="text-[16px] font-extrabold leading-tight mb-1.5 text-gray-900">{headline}</h3>
        <p className="text-[12px] text-gray-500 leading-relaxed mb-3">{subhead}</p>
        <div className="border border-gray-200 rounded-lg px-3 py-2 text-[12px] text-gray-400 mb-2 bg-gray-50">Your email address</div>
        <div className="rounded-lg py-2.5 text-[12px] font-bold text-center text-white mb-2" style={{ backgroundColor: primaryColor }}>{cta}</div>
        <div className="flex items-center justify-center gap-3 pt-2 border-t border-gray-100">
          {["No spam", "Unsubscribe anytime"].map(l => (
            <span key={l} className="text-[9px] text-gray-400">{l}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

