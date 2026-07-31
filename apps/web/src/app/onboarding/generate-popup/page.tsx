"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface AnalyzeResult {
  storeName?: string;
  industry?: string;
  brandColor?: string;
  storeUrl?: string;
  popup?: { found: boolean; description?: string };
}

interface GenerationStep {
  id: string;
  label: string;
  status: "pending" | "active" | "done" | "error";
}

const BASE_STEPS: GenerationStep[] = [
  { id: "brand", label: "Analyzing your brand", status: "pending" },
  { id: "headlines", label: "Writing headline variants", status: "pending" },
  { id: "design", label: "Building popup design", status: "pending" },
  { id: "ab", label: "Setting up A/B test", status: "pending" },
];

// ─── Inline helper: derive text color for brand color ─────────────────────────
function btnTextColor(hex: string): string {
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
  const lum = 0.2126 * vals[0] + 0.7152 * vals[1] + 0.0722 * vals[2];
  return lum < 0.35 ? "#ffffff" : "#0d0d10";
}

// ─── Mini popup preview ───────────────────────────────────────────────────────
function MiniPopup({
  headline,
  body,
  cta,
  color,
  storeName,
}: {
  headline: string;
  body: string;
  cta: string;
  color: string;
  storeName: string;
}) {
  const textColor = btnTextColor(color);
  return (
    <div
      className="rounded-[16px] bg-white overflow-hidden w-full"
      style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.06)" }}
    >
      {/* Accent bar */}
      <div className="h-1" style={{ backgroundColor: color }} />
      <div className="px-5 pt-3 pb-4">
        {/* Brand row */}
        <div className="flex items-center gap-1.5 mb-2.5">
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-[9px] font-bold tracking-[0.06em] uppercase" style={{ color: "#9ca3af" }}>
            {storeName.toUpperCase()}
          </span>
        </div>
        {/* Headline */}
        <p className="text-[15px] font-extrabold leading-snug mb-1.5 tracking-tight" style={{ color: "#0d0d10" }}>
          {headline}
        </p>
        {/* Body */}
        <p className="text-[11px] leading-relaxed mb-3" style={{ color: "#6b7280" }}>
          {body}
        </p>
        {/* Input */}
        <div
          className="w-full border rounded-[8px] px-2.5 py-2 text-[11px] mb-2"
          style={{ borderColor: "#e5e7eb", background: "#fafafa", color: "#9ca3af" }}
        >
          Your email address
        </div>
        {/* CTA */}
        <div
          className="w-full rounded-[8px] py-2 text-[11px] font-bold text-center mb-2"
          style={{ backgroundColor: color, color: textColor }}
        >
          {cta}
        </div>
        {/* Trust */}
        <p className="text-center text-[9px]" style={{ color: "#9ca3af" }}>
          No spam. Unsubscribe anytime.
        </p>
      </div>
    </div>
  );
}

// ─── Step indicator ───────────────────────────────────────────────────────────
function StepList({ steps }: { steps: GenerationStep[] }) {
  return (
    <div className="space-y-3 w-full max-w-xs">
      {steps.map((step) => (
        <div
          key={step.id}
          className={[
            "flex items-center gap-3 transition-opacity duration-300",
            step.status === "pending" ? "opacity-25" : "opacity-100",
          ].join(" ")}
        >
          <div className="flex-shrink-0 h-5 w-5 flex items-center justify-center">
            {step.status === "done" ? (
              <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 16 16">
                <path stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M3 8l3.5 3.5L13 4.5" />
              </svg>
            ) : step.status === "active" ? (
              <div
                className="h-3.5 w-3.5 rounded-full border-2 border-[color:var(--color-primary)] border-t-transparent"
                style={{ animation: "spin 0.7s linear infinite" }}
              />
            ) : step.status === "error" ? (
              <svg className="h-4 w-4 text-red-400" fill="none" viewBox="0 0 16 16">
                <path stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" d="M3 3l10 10M13 3L3 13" />
              </svg>
            ) : (
              <div className="h-2 w-2 rounded-full bg-[color:var(--color-border)]" />
            )}
          </div>
          <p className={[
            "text-sm font-medium",
            step.status === "active"
              ? "text-[color:var(--color-text-primary)]"
              : "text-[color:var(--color-text-secondary)]",
          ].join(" ")}>
            {step.label}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GeneratePopupPage() {
  const router = useRouter();
  const [steps, setSteps] = useState<GenerationStep[]>(BASE_STEPS.map(s => ({ ...s })));
  const [phase, setPhase] = useState<"loading" | "done" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [storeName, setStoreName] = useState("your store");
  const [brandColor, setBrandColor] = useState("#165DFF");
  const [variantA, setVariantA] = useState<{ headline: string; body: string; cta: string; label: string } | null>(null);
  const [variantB, setVariantB] = useState<{ headline: string; body: string; cta: string; label: string } | null>(null);
  const [campaignId, setCampaignId] = useState<string>("");
  const ranRef = useRef(false);

  function setStepStatus(id: string, status: GenerationStep["status"]) {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, status } : s));
  }

  function delay(ms: number) {
    return new Promise(r => setTimeout(r, ms));
  }

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    async function run() {
      let analyzeData: AnalyzeResult = {};
      try {
        const raw = sessionStorage.getItem("asmos_analyze_result");
        if (raw) analyzeData = JSON.parse(raw) as AnalyzeResult;
      } catch { /* ignore */ }

      const name = analyzeData.storeName ?? "My Store";
      const color = analyzeData.brandColor ?? "#165DFF";
      const industry = analyzeData.industry ?? "Ecommerce / Retail";
      const existingPopup = analyzeData.popup;

      // Read new onboarding sessionStorage keys
      let conversionGoal = "email_capture";
      let offerType = "percent_discount";
      let offerValue = "10";
      let audienceValue = "all";
      let triggerValue = "3s";

      try {
        const cgRaw = sessionStorage.getItem("asmos_conversion_goal");
        if (cgRaw) conversionGoal = cgRaw;

        const osRaw = sessionStorage.getItem("asmos_offer_selection");
        if (osRaw) {
          const os = JSON.parse(osRaw) as { type: string; value: string };
          offerType = os.type ?? "percent_discount";
          offerValue = os.value ?? "10";
        }

        const atRaw = sessionStorage.getItem("asmos_audience_trigger");
        if (atRaw) {
          const at = JSON.parse(atRaw) as { audience: string; trigger: string };
          audienceValue = at.audience ?? "all";
          triggerValue = at.trigger ?? "3s";
        }
      } catch { /* ignore */ }

      // Map trigger pill value -> API payload
      type TriggerPayload =
        | { trigger: "time_delay"; delaySeconds: number }
        | { trigger: "exit_intent" }
        | { trigger: "scroll_depth"; scrollPercent: number };

      function buildTriggerPayload(tv: string): TriggerPayload {
        switch (tv) {
          case "5s": return { trigger: "time_delay", delaySeconds: 5 };
          case "exit": return { trigger: "exit_intent" };
          case "scroll50": return { trigger: "scroll_depth", scrollPercent: 50 };
          default: return { trigger: "time_delay", delaySeconds: 3 };
        }
      }

      // Build headline from offer
      function buildHeadline(ot: string, ov: string, sn: string): string {
        switch (ot) {
          case "free_shipping": return "Get free shipping on your order";
          case "giveaway": return `Enter to win ${sn}'s giveaway`;
          case "percent_discount": return `Get ${ov || "10"}% off your first order`;
          case "fixed_discount": return `Get $${ov || "5"} off your first order`;
          case "free_gift": return `Free gift with your first order at ${sn}`;
          case "early_access": return `Get early access to ${sn}`;
          default: return `Get 10% off your first order`;
        }
      }

      setStoreName(name);
      setBrandColor(color);

      // ── Step 1: Analyzing brand ──
      setStepStatus("brand", "active");
      await delay(900);
      setStepStatus("brand", "done");

      // ── Step 2: Writing headlines ──
      setStepStatus("headlines", "active");
      await delay(800);

      // Generate variants based on popup.found + new onboarding data
      let varA: { headline: string; body: string; cta: string; label: string };
      let varB: { headline: string; body: string; cta: string; label: string };

      const baseHeadline = buildHeadline(offerType, offerValue, name);
      const _ = conversionGoal; // used for future personalization
      void _;

      if (existingPopup?.found && existingPopup.description) {
        // Copy-existing mode: Variant A mirrors existing, Variant B is improved
        varA = {
          label: "Your current popup (control)",
          headline: baseHeadline,
          body: existingPopup.description.slice(0, 100) || `Join ${name} and claim your exclusive first-order discount.`,
          cta: offerType === "free_shipping" ? "Get free shipping" : offerType === "giveaway" ? "Enter now" : "Claim my discount",
        };
        varB = {
          label: "Asmos variant",
          headline: offerType === "percent_discount"
            ? `${name}'s best-kept secret: ${offerValue || "10"}% off`
            : offerType === "free_shipping"
            ? `Free shipping: no minimum order`
            : baseHeadline,
          body: `Thousands of customers already save with ${name}. Join them: your discount waits inside.`,
          cta: offerType === "free_shipping" ? "Unlock free shipping" : `Unlock my ${offerValue || "10"}% off`,
        };
      } else {
        // Cold-start: two meaningfully different variants
        const isLuxury = /luxury|premium|fine|artisan|couture|bespoke/i.test(industry);
        const isHealth = /health|wellness|beauty|skin|fitness|organic/i.test(industry);

        if (offerType === "free_shipping") {
          varA = {
            label: "Direct offer",
            headline: "Get free shipping on your order",
            body: `Shop ${name} today with complimentary shipping. No minimum required.`,
            cta: "Get free shipping",
          };
          varB = {
            label: "Scarcity angle",
            headline: `Free shipping, limited time`,
            body: `New to ${name}? Your free shipping offer expires soon. Don't miss it.`,
            cta: "Lock in free shipping",
          };
        } else if (offerType === "giveaway") {
          varA = {
            label: "Entry angle",
            headline: `Enter to win ${name}'s giveaway`,
            body: `Join our community giveaway and get a chance to win an exclusive ${name} prize.`,
            cta: "Enter the giveaway",
          };
          varB = {
            label: "Community angle",
            headline: `Win big with ${name}`,
            body: `Our biggest giveaway yet. Drop your email to enter. Winner announced this month.`,
            cta: "I want to win",
          };
        } else if (isLuxury) {
          varA = {
            label: "Exclusive access angle",
            headline: `Join the inner circle`,
            body: `${name} members receive early access to new collections and exclusive offers. Invite-only: enter now.`,
            cta: "Request access",
          };
          varB = {
            label: "Discount angle",
            headline: baseHeadline,
            body: `Subscribe to ${name} and receive a personal discount on your first purchase. Limited time.`,
            cta: "Reveal my offer",
          };
        } else if (isHealth) {
          varA = {
            label: "Results-led angle",
            headline: baseHeadline,
            body: `Join ${name} subscribers and get your exclusive offer, plus expert tips delivered weekly.`,
            cta: "Start my routine",
          };
          varB = {
            label: "Community angle",
            headline: `Join 10,000+ ${name} customers`,
            body: `Real results, real people. Get your offer and access our private wellness community.`,
            cta: "Join the community",
          };
        } else {
          varA = {
            label: "Discount angle",
            headline: baseHeadline,
            body: `Subscribe to ${name} and receive a welcome discount. Use it on anything in the store.`,
            cta: offerType === "percent_discount" ? `Claim my ${offerValue || "10"}% off` : "Claim my offer",
          };
          varB = {
            label: "Scarcity angle",
            headline: `Don't pay full price`,
            body: `New to ${name}? Your first order discount expires in 24 hours. Grab it now.`,
            cta: "Lock in my discount",
          };
        }
      }

      setVariantA(varA);
      setVariantB(varB);
      setStepStatus("headlines", "done");

      // ── Step 3: Building design ──
      setStepStatus("design", "active");
      await delay(700);
      setStepStatus("design", "done");

      // ── Step 4: Create campaign via API ──
      setStepStatus("ab", "active");
      try {
        const accountRes = await fetch("/api/account");
        if (!accountRes.ok) throw new Error("Could not load account");
        const accountData = await accountRes.json() as { websites?: Array<{ id: string }> };
        const websiteId = accountData?.websites?.[0]?.id;

        if (!websiteId) {
          // No store connected yet -- skip campaign creation gracefully
          setStepStatus("ab", "done");
          setPhase("done");
          return;
        }

        const triggerPayload = buildTriggerPayload(triggerValue);

        const campaignPayload = {
          name: `${name} Welcome Popup`,
          type: "FORM",
          design: {
            headline: varA.headline,
            body: varA.body,
            primaryColor: color,
            ctaText: varA.cta,
          },
          formFields: ["email"],
          targeting: triggerPayload,
          rewards: [{ label: "10% off your first order", type: "DISCOUNT_PERCENT", couponCode: "WELCOME10", weight: 100 }],
          websiteId,
          goal: conversionGoal,
          offer: offerType,
          offerValue,
          audienceTrigger: audienceValue,
        };

        const campaignRes = await fetch("/api/campaigns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(campaignPayload),
        });

        if (!campaignRes.ok) {
          const body = await campaignRes.json().catch(() => ({})) as { error?: string };
          throw new Error(body.error ?? "Could not create campaign");
        }

        const { campaign } = await campaignRes.json() as { campaign: { id: string } };
        const cId = campaign.id;
        setCampaignId(cId);

        // Add variant B
        await fetch(`/api/campaigns/${cId}/variants`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: varB.label,
            design: { headline: varB.headline, body: varB.body, primaryColor: color, ctaText: varB.cta },
            formFields: ["email"],
            targeting: triggerPayload,
            rewards: [{ label: "10% off your first order", type: "DISCOUNT_PERCENT", couponCode: "WELCOME10", weight: 100 }],
          }),
        }).catch(() => { /* non-fatal */ });

        setStepStatus("ab", "done");
        setPhase("done");
      } catch (e) {
        setStepStatus("ab", "error");
        setErrorMsg(e instanceof Error ? e.message : "Something went wrong");
        setPhase("error");
      }
    }

    run();
  }, [router]);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[color:var(--color-surface-sunken)] px-6 py-16">
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div className="w-full max-w-md flex flex-col items-center gap-8 animate-page-enter">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-xl font-bold text-[color:var(--color-text-primary)]">
            {phase === "done"
              ? `Your popups are ready`
              : `Building your popup for ${storeName}`}
          </h1>
          <p className="mt-1.5 text-sm text-[color:var(--color-text-secondary)]">
            {phase === "done"
              ? "Two A/B variants generated. Pick one to launch or run them both."
              : "Using your brand color and industry to generate high-converting variants."}
          </p>
        </div>

        {/* Steps */}
        {phase === "loading" && <StepList steps={steps} />}

        {/* Error */}
        {phase === "error" && (
          <div className="w-full max-w-xs flex flex-col items-center gap-4 text-center">
            <StepList steps={steps} />
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 w-full">
              <p className="text-sm text-red-600">{errorMsg}</p>
            </div>
            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2.5 text-sm font-medium text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-surface-sunken)] transition-colors"
            >
              Go to dashboard
            </button>
          </div>
        )}

        {/* Done: show both variants */}
        {phase === "done" && variantA && variantB && (
          <div className="w-full flex flex-col gap-6">
            {/* Variant pair */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[{ v: variantA, idx: "A" }, { v: variantB, idx: "B" }].map(({ v, idx }) => (
                <div key={idx} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
                      style={{ backgroundColor: brandColor }}
                    >
                      {idx}
                    </span>
                    <span className="text-[11px] text-[color:var(--color-text-secondary)]">{v.label}</span>
                  </div>
                  <MiniPopup
                    headline={v.headline}
                    body={v.body}
                    cta={v.cta}
                    color={brandColor}
                    storeName={storeName}
                  />
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => {
                  if (campaignId) {
                    router.push(`/onboarding/launch-confirmation?campaign=${campaignId}`);
                  } else {
                    router.push("/dashboard");
                  }
                }}
                className="rounded-xl px-6 py-3 text-sm font-bold text-white transition-colors hover:opacity-90"
                style={{ backgroundColor: brandColor }}
              >
                {campaignId ? "View and launch campaign" : "Go to dashboard"}
              </button>
              <button
                onClick={() => router.push("/onboarding/connect-store")}
                className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-6 py-3 text-sm font-medium text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-surface-sunken)] transition-colors"
              >
                Back
              </button>
            </div>

            <p className="text-center text-[11px] text-[color:var(--color-text-secondary)]">
              {campaignId
                ? "Both variants are set up. Asmos will split traffic 50/50 and optimize automatically."
                : "Campaign will be created after store connection. Connect your store from the dashboard to go live."}
            </p>
          </div>
        )}

        {/* Progress bar during loading */}
        {phase === "loading" && (
          <div className="w-full max-w-xs">
            <div className="h-0.5 w-full overflow-hidden rounded-full bg-[color:var(--color-surface)]">
              <div
                className="h-full rounded-full bg-[color:var(--color-primary)] transition-[width] duration-500 ease-out"
                style={{
                  width: `${(steps.filter(s => s.status === "done").length / steps.length) * 100}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
