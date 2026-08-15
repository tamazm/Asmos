"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnalyzeResult {
  storeName?: string;
  industry?: string;
  brandColor?: string;
  storeUrl?: string;
  popup?: { found: boolean; description?: string };
  brandTokens?: unknown;
  existingPopup?: unknown;
  computedStyles?: unknown;
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

type Phase =
  | "scanning"     // AI call in-flight
  | "creating"     // POST /api/campaigns in-flight
  | "done"         // redirect happening
  | "error";

// ─── Step config ──────────────────────────────────────────────────────────────

const STEPS = [
  { id: "brand",    label: "Reading your brand colors and fonts" },
  { id: "design",   label: "Designing a branded popup" },
  { id: "copy",     label: "Writing personalized copy" },
  { id: "publish",  label: "Publishing to your store" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexLuminance(hex: string): number {
  const s = hex.trim();
  let r = 22, g = 93, b = 255;
  if (s[0] === "#") {
    const full = s.length === 4 ? "#" + s[1] + s[1] + s[2] + s[2] + s[3] + s[3] : s;
    r = parseInt(full.slice(1, 3), 16);
    g = parseInt(full.slice(3, 5), 16);
    b = parseInt(full.slice(5, 7), 16);
  }
  const vals = [r, g, b].map((v) => {
    const n = v / 255;
    return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * vals[0] + 0.7152 * vals[1] + 0.0722 * vals[2];
}

// ─── Mini popup preview ───────────────────────────────────────────────────────

function PopupPreview({
  headline, subhead, cta, primaryColor, storeName, code,
}: {
  headline: string; subhead: string; cta: string;
  primaryColor: string; storeName: string; code?: string;
}) {
  const btnColor = hexLuminance(primaryColor) < 0.35 ? "#ffffff" : "#0d0d10";

  if (code) {
    return (
      <div
        className="mx-auto max-w-[280px] pointer-events-none"
        dangerouslySetInnerHTML={{ __html: code }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-[260px] rounded-[16px] bg-white overflow-hidden shadow-xl">
      <div className="h-1" style={{ backgroundColor: primaryColor }} />
      <div className="px-4 pt-3 pb-4">
        <div className="flex items-center gap-1.5 mb-2">
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: primaryColor }} />
          <span className="text-[9px] font-bold tracking-[0.06em] uppercase text-gray-400">
            {storeName.toUpperCase()}
          </span>
        </div>
        <p className="text-[14px] font-extrabold leading-snug text-gray-900 mb-1.5">{headline}</p>
        <p className="text-[11px] text-gray-500 leading-relaxed mb-3">{subhead}</p>
        <div className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-[11px] text-gray-400 mb-2 bg-gray-50">
          Your email address
        </div>
        <div
          className="rounded-lg py-2 text-[11px] font-bold text-center mb-2"
          style={{ backgroundColor: primaryColor, color: btnColor }}
        >
          {cta}
        </div>
        <p className="text-center text-[9px] text-gray-400">No spam · Unsubscribe anytime</p>
      </div>
    </div>
  );
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepList({ activeIndex }: { activeIndex: number }) {
  return (
    <div className="flex flex-col gap-3 w-full max-w-xs">
      {STEPS.map((step, i) => {
        const done = i < activeIndex;
        const active = i === activeIndex;
        return (
          <div key={step.id} className={["flex items-center gap-3 transition-opacity duration-300", active || done ? "opacity-100" : "opacity-30"].join(" ")}>
            <div className="flex-shrink-0 h-5 w-5 flex items-center justify-center">
              {done ? (
                <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 16 16">
                  <path stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M3 8l3.5 3.5L13 4.5" />
                </svg>
              ) : active ? (
                <div className="h-3.5 w-3.5 rounded-full border-2 border-[color:var(--color-primary)] border-t-transparent animate-spin" />
              ) : (
                <div className="h-2 w-2 rounded-full bg-[color:var(--color-border)]" />
              )}
            </div>
            <p className={["text-sm font-medium", active ? "text-[color:var(--color-text-primary)]" : "text-[color:var(--color-text-secondary)]"].join(" ")}>
              {step.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function GeneratePopupPage() {
  const router = useRouter();
  const ranRef = useRef(false);

  const [phase, setPhase] = useState<Phase>("scanning");
  const [stepIndex, setStepIndex] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [storeName, setStoreName] = useState("your store");
  const [primaryColor, setPrimaryColor] = useState("#165DFF");
  const [preview, setPreview] = useState<{ headline: string; subhead: string; cta: string; code: string } | null>(null);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    async function run() {
      // Read sessionStorage — populated during the /analyze pre-signup scan
      let analyzeData: AnalyzeResult = {};
      let offerType = "percent_discount";
      let offerValue = "10";
      let triggerValue = "3s";
      let cachedPopup: GeneratedPopup | null = null;

      try {
        const raw = sessionStorage.getItem("asmos_analyze_result");
        if (raw) analyzeData = JSON.parse(raw) as AnalyzeResult;
      } catch { /* ignore */ }

      try {
        const osRaw = sessionStorage.getItem("asmos_offer_selection");
        if (osRaw) {
          const os = JSON.parse(osRaw) as { type: string; value: string };
          offerType = os.type ?? "percent_discount";
          offerValue = os.value ?? "10";
        }
      } catch { /* ignore */ }

      try {
        const atRaw = sessionStorage.getItem("asmos_audience_trigger");
        if (atRaw) {
          const at = JSON.parse(atRaw) as { trigger: string };
          triggerValue = at.trigger ?? "3s";
        }
      } catch { /* ignore */ }

      // Check if popup was already generated during the pre-signup scan
      try {
        const cachedRaw = sessionStorage.getItem("asmos_generated_popup");
        if (cachedRaw) cachedPopup = JSON.parse(cachedRaw) as GeneratedPopup;
      } catch { /* ignore */ }

      const name = analyzeData.storeName ?? "My Store";
      const color = analyzeData.brandColor ?? "#165DFF";
      setStoreName(name);
      setPrimaryColor(color);

      // ── Step 0: Brand scan ──
      setStepIndex(0);
      await new Promise((r) => setTimeout(r, 600));

      // ── Step 1: Design (call AI if no cached popup) ──
      setStepIndex(1);

      let popup: GeneratedPopup | null = cachedPopup;
      if (!popup && analyzeData.storeUrl) {
        try {
          const raw = sessionStorage.getItem("asmos_analyze_result");
          const res = await fetch("/api/analyze/generate-popup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: raw ?? JSON.stringify(analyzeData),
          });
          if (res.ok) {
            popup = await res.json() as GeneratedPopup;
            if (popup?.baseline) {
              sessionStorage.setItem("asmos_generated_popup", JSON.stringify(popup));
            }
          }
        } catch { /* fall through to template */ }
      }

      // ── Step 2: Copy ──
      setStepIndex(2);

      // Set preview (AI or sensible default). Colour prefers the real
      // generated design_tokens.palette over `color` (the pre-signup guess,
      // possibly just the "#165DFF" placeholder) — this used to show, and
      // then permanently save, the guess even when the AI call succeeded
      // and returned a real palette.
      const spec = popup?.baseline?.spec;
      const generatedColor = spec?.design_tokens.palette[0] ?? color;
      setPrimaryColor(generatedColor);
      setPreview({
        headline: spec?.headline ?? `Get ${offerValue || "10"}% off your first order`,
        subhead: spec?.subhead ?? `Join ${name} and get ${offerType === "free_shipping" ? "free shipping" : `${offerValue || "10"}% off`} on your first order.`,
        cta: spec?.cta ?? "Claim my discount",
        code: popup?.baseline?.code ?? "",
      });

      await new Promise((r) => setTimeout(r, 700));

      // ── Step 3: Publish — create campaign immediately ──
      setStepIndex(3);
      setPhase("creating");

      function buildTrigger(tv: string): { trigger: string; delaySeconds: number | null } {
        switch (tv) {
          case "5s": return { trigger: "time_delay", delaySeconds: 5 };
          case "exit": return { trigger: "exit_intent", delaySeconds: null };
          case "scroll50": return { trigger: "scroll_depth", delaySeconds: null };
          default: return { trigger: "time_delay", delaySeconds: 3 };
        }
      }

      const triggerPayload = buildTrigger(triggerValue);
      const specToUse = spec;

      const campaignPayload = {
        name: `${name} — Email Capture`,
        type: "FORM",
        design: {
          headline: specToUse?.headline ?? `Get ${offerValue || "10"}% off your first order`,
          body: specToUse?.subhead ?? `Subscribe to ${name} and get your welcome offer.`,
          primaryColor: generatedColor,
          ctaText: specToUse?.cta ?? "Claim my discount",
        },
        formFields: specToUse?.fields ?? ["email"],
        targeting: specToUse?.trigger
          ? { trigger: specToUse.trigger, delaySeconds: null }
          : triggerPayload,
        rewards: offerType !== "early_access" && offerType !== "giveaway"
          ? [{
              label: specToUse?.cta ?? "Welcome offer",
              type: offerType === "fixed_discount" ? "DISCOUNT_FIXED"
                : offerType === "free_shipping" ? "FREE_SHIPPING"
                : "DISCOUNT_PERCENT",
              couponCode: offerType === "free_shipping" ? null : "WELCOME10",
              weight: 100,
            }]
          : [],
        // Pass AI popup spec so it gets stored on the variant
        ...(popup?.baseline
          ? {
              popupSpec: {
                spec: popup.baseline.spec,
                code: popup.baseline.code,
                popup_id: popup.baseline.popup_id,
              },
            }
          : {}),
      };

      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(campaignPayload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Campaign creation failed (${res.status})`);
      }

      const data = await res.json() as { campaign: { id: string } };
      const campaignId = data.campaign.id;

      // Clear the cached popup so next store gets fresh generation
      sessionStorage.removeItem("asmos_generated_popup");

      setPhase("done");
      await new Promise((r) => setTimeout(r, 400));

      router.push(`/campaigns/${campaignId}`);
    }

    run().catch((e: unknown) => {
      setErrorMsg(e instanceof Error ? e.message : "Something went wrong");
      setPhase("error");
    });
  }, [router]);

  const isDone = phase === "done";

  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 min-h-[60vh]">
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div className="w-full max-w-lg flex flex-col items-center gap-10">

        {/* Header */}
        <div className="text-center">
          <h1 className="text-xl font-bold text-[color:var(--color-text-primary)]">
            {isDone
              ? "Your popup is live 🚀"
              : `Building your popup for ${storeName}`}
          </h1>
          <p className="mt-1.5 text-sm text-[color:var(--color-text-secondary)]">
            {isDone
              ? "Asmos will automatically generate A/B test variants based on real visitor data."
              : "AI is designing a branded popup using your store's colors and style."}
          </p>
        </div>

        {/* Error state */}
        {phase === "error" && (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 border border-red-100">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-red-500">
                <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-sm text-[color:var(--color-text-secondary)]">{errorMsg}</p>
            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-lg bg-[color:var(--color-primary)] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[color:var(--color-primary-dark)] transition-colors"
            >
              Go to dashboard
            </button>
          </div>
        )}

        {/* Working state: steps + popup preview */}
        {phase !== "error" && (
          <div className="w-full flex flex-col sm:flex-row items-start gap-8">

            {/* Step list */}
            <div className="flex-shrink-0">
              <StepList activeIndex={isDone ? STEPS.length : stepIndex} />
            </div>

            {/* Live popup preview */}
            <div
              className="flex-1 min-w-0 w-full"
              style={{ animation: preview ? "fadeIn 0.5s ease both" : undefined }}
            >
              {preview ? (
                <PopupPreview
                  headline={preview.headline}
                  subhead={preview.subhead}
                  cta={preview.cta}
                  primaryColor={primaryColor}
                  storeName={storeName}
                  code={preview.code}
                />
              ) : (
                <div
                  className="rounded-[16px] border-2 border-dashed w-full h-40 flex items-center justify-center"
                  style={{ borderColor: "#e5e7eb" }}
                >
                  <p className="text-[11px] text-gray-400">Generating your popup…</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Done state callout */}
        {isDone && (
          <div className="w-full rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 flex items-start gap-2">
            <svg className="mt-0.5 shrink-0 text-emerald-500" width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M3 8l3.5 3.5L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="text-xs text-emerald-800 leading-relaxed">
              Campaign is live. Asmos will autonomously create A/B test variants and shift traffic to the winner — no action needed from you.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
