"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { campaignCreated } from "@/lib/analytics";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase =
  | "idle"         // URL input
  | "analyzing"    // /api/analyze running
  | "generating"   // /api/analyze/generate-popup running
  | "ready"        // popup ready to preview
  | "publishing"   // POST /api/campaigns
  | "done"         // redirect
  | "error";

interface AnalyzeResult {
  storeName?: string;
  industry?: string;
  brandColor?: string;
  storeUrl?: string;
  brandTokens?: unknown;
  existingPopup?: unknown;
  computedStyles?: unknown;
  score?: number;
}

interface GeneratedPopup {
  mode: string;
  baseline: {
    popup_id: string;
    spec: {
      headline: string;
      subhead: string;
      cta: string;
      trigger: string;
      fields: string[];
      frequency_cap: string;
      design_tokens: { palette: string[]; type_display: string; type_body: string };
    };
    code: string;
    diagnosis: Array<{ lever: string; change: string; reason: string }>;
  };
}

// ─── Animated steps indicator ─────────────────────────────────────────────────

const STEPS = [
  { id: "analyzing", label: "Scanning your store", icon: "🔍" },
  { id: "generating", label: "Designing your popup", icon: "✨" },
  { id: "ready", label: "Ready to publish", icon: "🚀" },
];

function StepProgress({ phase }: { phase: Phase }) {
  const stepIndex =
    phase === "analyzing" ? 0 :
    phase === "generating" ? 1 :
    phase === "ready" || phase === "publishing" || phase === "done" ? 2 : -1;

  if (stepIndex < 0) return null;

  return (
    <div className="flex flex-col gap-3 w-full max-w-md mx-auto">
      {STEPS.map((step, i) => {
        const done = stepIndex > i;
        const active = stepIndex === i;
        return (
          <div key={step.id} className="flex items-center gap-3">
            <div
              className={[
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm transition-all duration-500",
                done ? "bg-emerald-500 text-white" :
                active ? "bg-[color:var(--color-primary)] text-white" :
                "bg-[color:var(--color-surface-sunken)] text-[color:var(--color-text-secondary)]",
              ].join(" ")}
            >
              {done ? (
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8l3.5 3.5L13 4.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : active ? (
                <span className="inline-block h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
              ) : (
                <span className="text-xs font-mono">{i + 1}</span>
              )}
            </div>
            <div className="flex flex-col">
              <p className={["text-sm font-medium transition-colors", active ? "text-[color:var(--color-text-primary)]" : done ? "text-emerald-600" : "text-[color:var(--color-text-secondary)]"].join(" ")}>
                {step.label}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Popup code preview ───────────────────────────────────────────────────────

function PopupCodePreview({ code, spec, primaryColor }: { code: string; spec: GeneratedPopup["baseline"]["spec"]; primaryColor: string }) {
  if (code) {
    return (
      <div
        className="mx-auto max-w-[300px] pointer-events-none"
        dangerouslySetInnerHTML={{ __html: code }}
      />
    );
  }
  // Spec fallback
  return (
    <div className="mx-auto max-w-[280px] rounded-[18px] overflow-hidden shadow-xl">
      <div className="h-1" style={{ backgroundColor: primaryColor }} />
      <div className="bg-white px-5 pt-4 pb-5">
        <div className="flex justify-end mb-2">
          <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center">
            <svg width="7" height="7" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </div>
        </div>
        <h3 className="text-[16px] font-extrabold leading-tight mb-1.5 text-gray-900">{spec.headline}</h3>
        <p className="text-[12px] text-gray-500 leading-relaxed mb-3">{spec.subhead}</p>
        <div className="border border-gray-200 rounded-lg px-3 py-2 text-[12px] text-gray-400 mb-2 bg-gray-50">Your email address</div>
        <div className="rounded-lg py-2.5 text-[12px] font-bold text-center text-white mb-2" style={{ backgroundColor: primaryColor }}>{spec.cta}</div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function NewCampaignAutonomous() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResult | null>(null);
  const [popup, setPopup] = useState<GeneratedPopup | null>(null);
  const [showManual, setShowManual] = useState(false);

  const primaryColor = popup?.baseline?.spec?.design_tokens?.palette?.[0]
    ?? analyzeResult?.brandColor
    ?? "#165DFF";

  async function launch() {
    const raw = url.trim();
    if (!raw) return;
    let normalized = raw;
    if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
      normalized = "https://" + normalized;
    }

    setError(null);
    setPhase("analyzing");

    // Step 1: Analyze
    let result: AnalyzeResult;
    try {
      const res = await fetch(`/api/analyze?url=${encodeURIComponent(normalized)}`);
      if (!res.ok) throw new Error("Could not analyze store");
      result = await res.json();
      setAnalyzeResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Store analysis failed");
      setPhase("error");
      return;
    }

    setPhase("generating");

    // Step 2: Generate popup
    let gen: GeneratedPopup;
    try {
      const res = await fetch("/api/analyze/generate-popup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      });
      if (!res.ok) throw new Error("Popup generation failed");
      gen = await res.json();
      if (!gen?.baseline) throw new Error("No baseline returned");
      setPopup(gen);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Popup generation failed");
      setPhase("error");
      return;
    }

    // Auto-fill campaign name from store name if not set
    if (!campaignName.trim() && result.storeName) {
      setCampaignName(`${result.storeName} — Email Capture`);
    }

    setPhase("ready");
  }

  async function publish() {
    if (!popup || !analyzeResult) return;
    setPhase("publishing");
    setError(null);

    const name = campaignName.trim() || `${analyzeResult.storeName ?? "My Store"} — Email Capture`;

    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          type: "FORM",
          design: {
            headline: popup.baseline.spec.headline,
            body: popup.baseline.spec.subhead,
            primaryColor,
            ctaText: popup.baseline.spec.cta,
          },
          formFields: popup.baseline.spec.fields,
          targeting: { trigger: popup.baseline.spec.trigger, delaySeconds: null },
          rewards: [],
          // Pass the full popup spec so it gets stored on the variant
          popupSpec: {
            spec: popup.baseline.spec,
            code: popup.baseline.code,
            popup_id: popup.baseline.popup_id,
          },
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Publish failed");
      }

      const created = await res.json().catch(() => ({}));
      campaignCreated({
        campaignId: created.campaign?.id ?? "unknown",
        campaignType: "FORM",
        name,
      });

      router.push(`/campaigns/${created.campaign?.id ?? ""}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setPhase("ready"); // allow retry
    }
  }

  function reset() {
    setPhase("idle");
    setError(null);
    setPopup(null);
    setAnalyzeResult(null);
  }

  const isWorking = phase === "analyzing" || phase === "generating" || phase === "publishing";

  return (
    <div className="flex flex-col gap-8 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={() => router.push("/campaigns")}
            className="text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span className="text-sm text-[color:var(--color-text-secondary)]">Pop-ups</span>
        </div>
        <h1 className="text-2xl font-bold text-[color:var(--color-text-primary)]">Launch a popup</h1>
        <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
          Enter your store URL — Asmos scans your brand and designs a popup in seconds.
        </p>
      </div>

      {/* Main card */}
      <div className="rounded-[1.375rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-1.5 shadow-sm">
        <div className="rounded-[1rem] bg-[color:var(--color-surface)] p-6 flex flex-col gap-6">

          {/* ── IDLE / URL input phase ── */}
          {phase === "idle" && (
            <>
              <div className="flex flex-col gap-3">
                <div>
                  <label htmlFor="store-url" className="mb-1.5 block text-sm font-medium text-[color:var(--color-text-primary)]">
                    Store URL
                  </label>
                  <input
                    id="store-url"
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && url.trim() && launch()}
                    placeholder="yourstore.com"
                    autoFocus
                    className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/20 transition-colors duration-150"
                  />
                </div>
                <div>
                  <label htmlFor="campaign-name" className="mb-1.5 block text-sm font-medium text-[color:var(--color-text-primary)]">
                    Campaign name <span className="font-normal text-[color:var(--color-text-secondary)]">(optional — auto-filled from store)</span>
                  </label>
                  <input
                    id="campaign-name"
                    type="text"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder="e.g. Summer Email Capture"
                    className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/20 transition-colors duration-150"
                  />
                </div>
              </div>

              {/* What AI does */}
              <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] px-4 py-3 flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--color-text-secondary)]">What Asmos does automatically</p>
                {[
                  "Scans your homepage for brand colors, typography, and style",
                  "Detects any existing popups and improves them — or creates from scratch",
                  "Writes personalized headline, subhead and CTA for your store category",
                  "Generates a self-contained popup — live in one click",
                  "Auto-tests variants via the bandit — no manual A/B setup needed",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2">
                    <svg className="mt-0.5 shrink-0 text-emerald-500" width="12" height="12" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8l3.5 3.5L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <p className="text-xs text-[color:var(--color-text-secondary)]">{item}</p>
                  </div>
                ))}
              </div>

              <button
                onClick={launch}
                disabled={!url.trim()}
                className="w-full rounded-lg bg-[color:var(--color-primary)] py-3 text-sm font-bold text-white transition-[background-color,transform,opacity] duration-200 hover:bg-[color:var(--color-primary-dark)] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Design my popup →
              </button>

              {/* Manual escape hatch */}
              <div className="text-center">
                <button
                  onClick={() => setShowManual(true)}
                  className="text-xs text-[color:var(--color-text-secondary)] underline underline-offset-2 hover:text-[color:var(--color-text-primary)] transition-colors"
                >
                  Prefer to set it up manually?
                </button>
              </div>

              {showManual && (
                <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] px-4 py-3 text-center">
                  <p className="text-sm text-[color:var(--color-text-secondary)] mb-2">
                    The manual campaign wizard gives you full control over type, design, targeting, and rewards.
                  </p>
                  <Link
                    href="/campaigns/new/manual"
                    className="inline-flex items-center gap-1.5 text-sm text-[color:var(--color-primary)] font-medium hover:underline"
                  >
                    Open manual wizard →
                  </Link>
                </div>
              )}
            </>
          )}

          {/* ── WORKING phases ── */}
          {(phase === "analyzing" || phase === "generating") && (
            <div className="flex flex-col items-center gap-8 py-4">
              <div className="relative flex h-20 w-20 items-center justify-center">
                {/* Pulsing ring */}
                <span className="absolute inline-block h-20 w-20 rounded-full border-2 border-[color:var(--color-primary)] opacity-20 animate-ping" />
                <span className="absolute inline-block h-14 w-14 rounded-full border border-[color:var(--color-primary)]/30" />
                <svg className="text-[color:var(--color-primary)]" width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
              </div>
              <StepProgress phase={phase} />
              <p className="text-xs text-[color:var(--color-text-secondary)] text-center">
                {phase === "analyzing"
                  ? "Fetching your homepage and running vision analysis…"
                  : "Generating brand-accurate popup design with Claude…"}
              </p>
            </div>
          )}

          {/* ── READY — popup preview + publish ── */}
          {phase === "ready" && popup && analyzeResult && (
            <>
              {/* Store pill */}
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">
                  {analyzeResult.storeName ?? "Your Store"}
                </p>
                <span className="text-xs text-[color:var(--color-text-secondary)]">· AI-designed popup ready</span>
              </div>

              {/* Popup preview */}
              <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-4">
                <PopupCodePreview
                  code={popup.baseline.code}
                  spec={popup.baseline.spec}
                  primaryColor={primaryColor}
                />
              </div>

              {/* Diagnosis pills */}
              {popup.baseline.diagnosis.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {popup.baseline.diagnosis.map((d, i) => (
                    <span key={i} className="inline-flex items-center rounded-full bg-blue-50 border border-blue-100 px-2.5 py-1 text-[10px] font-medium text-blue-700">
                      {d.lever}: {d.change}
                    </span>
                  ))}
                </div>
              )}

              {/* Campaign name field */}
              <div>
                <label htmlFor="pub-campaign-name" className="mb-1.5 block text-sm font-medium text-[color:var(--color-text-primary)]">
                  Campaign name
                </label>
                <input
                  id="pub-campaign-name"
                  type="text"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="e.g. Summer Email Capture"
                  className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/20 transition-colors duration-150"
                />
              </div>

              {/* What happens next */}
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 flex items-start gap-2">
                <svg className="mt-0.5 shrink-0 text-emerald-500" width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8l3.5 3.5L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p className="text-xs text-emerald-800 leading-relaxed">
                  Publishes immediately. Asmos will autonomously create A/B test variants and optimise traffic allocation — you don&apos;t need to do anything else.
                </p>
              </div>

              {error && (
                <p className="text-sm text-red-600 rounded-lg border border-red-100 bg-red-50 px-3 py-2">{error}</p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={publish}
                  disabled={isWorking}
                  className="flex-1 rounded-lg bg-[color:var(--color-primary)] py-3 text-sm font-bold text-white transition-[background-color,transform,opacity] duration-200 hover:bg-[color:var(--color-primary-dark)] active:scale-[0.98] disabled:opacity-60"
                >
                  {isWorking ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Publishing…
                    </span>
                  ) : "Publish campaign →"}
                </button>
                <button
                  onClick={reset}
                  className="rounded-lg border border-[color:var(--color-border)] px-4 py-3 text-sm font-medium text-[color:var(--color-text-secondary)] hover:border-[color:var(--color-primary)]/40 transition-colors"
                >
                  Start over
                </button>
              </div>
            </>
          )}

          {/* ── ERROR phase ── */}
          {phase === "error" && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 border border-red-100">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-red-500">
                  <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-[color:var(--color-text-primary)]">Something went wrong</p>
                <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">{error}</p>
              </div>
              <button
                onClick={reset}
                className="rounded-lg bg-[color:var(--color-primary)] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[color:var(--color-primary-dark)] transition-colors"
              >
                Try again
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
