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
}

interface GenerationStep {
  id: string;
  label: string;
  status: "pending" | "active" | "done" | "error";
}

interface PopupVariant {
  headline: string;
  body: string;
  cta: string;
  label: string;
  style: "minimal" | "bold" | "social-proof";
}

// ─── Preview phases (what's visible in the live preview area) ─────────────────
type PreviewPhase = "empty" | "brand" | "headline" | "design" | "done";

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_STEPS: GenerationStep[] = [
  { id: "brand", label: "Analyzing your brand", status: "pending" },
  { id: "headlines", label: "Writing headline variants", status: "pending" },
  { id: "design", label: "Building popup design", status: "pending" },
  { id: "ab", label: "Setting up A/B test", status: "pending" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Derive two-three meaningfully different variants from onboarding context */
function deriveVariants(
  storeName: string,
  industry: string,
  offerType: string,
  offerValue: string,
  existingPopup: AnalyzeResult["popup"],
): [PopupVariant, PopupVariant] {
  const name = storeName || "My Store";

  const isLuxury = /luxury|premium|fine|artisan|couture|bespoke|jewel/i.test(industry);
  const isHealth = /health|wellness|beauty|skin|fitness|organic|supplement/i.test(industry);
  const isFashion = /fashion|apparel|cloth|wear|dress|shoe|accessory/i.test(industry);
  const isFood = /food|beverage|coffee|tea|snack|grocery|gourmet/i.test(industry);

  // Base offer helpers
  function discountLabel(): string {
    if (offerType === "percent_discount") return `${offerValue || "10"}% off`;
    if (offerType === "fixed_discount") return `$${offerValue || "5"} off`;
    if (offerType === "free_shipping") return "free shipping";
    if (offerType === "free_gift") return "a free gift";
    if (offerType === "early_access") return "early access";
    if (offerType === "giveaway") return "a chance to win";
    return "10% off";
  }

  function ctaForOffer(angle: "claim" | "unlock" | "enter" | "get"): string {
    switch (offerType) {
      case "free_shipping":
        return angle === "get" ? "Get free shipping" : angle === "unlock" ? "Unlock free shipping" : "Apply free shipping";
      case "giveaway":
        return angle === "enter" ? "Enter to win" : "Join the giveaway";
      case "early_access":
        return angle === "unlock" ? "Request early access" : "Get early access";
      case "free_gift":
        return angle === "get" ? "Claim my free gift" : "Get my gift";
      default:
        return angle === "unlock"
          ? `Unlock ${offerValue || "10"}% off`
          : angle === "claim"
          ? `Claim ${discountLabel()}`
          : `Get ${discountLabel()}`;
    }
  }

  // ── Existing popup: control vs. Asmos challenger ──
  if (existingPopup?.found && existingPopup.description) {
    const controlVariant: PopupVariant = {
      label: "Control (current popup)",
      style: "minimal",
      headline:
        offerType === "percent_discount"
          ? `Get ${offerValue || "10"}% off your first order`
          : offerType === "free_shipping"
          ? "Get free shipping on your order"
          : `Your exclusive welcome offer from ${name}`,
      body: existingPopup.description.slice(0, 90) || `Join ${name} and claim your welcome offer.`,
      cta: ctaForOffer("claim"),
    };
    const challengerVariant: PopupVariant = {
      label: "Asmos challenger",
      style: "bold",
      headline:
        isLuxury
          ? `The ${name} inner circle`
          : offerType === "percent_discount"
          ? `${name}'s best-kept secret`
          : offerType === "free_shipping"
          ? `Free shipping, zero minimums`
          : `A personal welcome from ${name}`,
      body: `Thousands of customers already save with ${name}. Join them today and get ${discountLabel()} instantly.`,
      cta: ctaForOffer("unlock"),
    };
    return [controlVariant, challengerVariant];
  }

  // ── Cold-start: two meaningfully different angles ──

  // Giveaway
  if (offerType === "giveaway") {
    return [
      {
        label: "Entry angle",
        style: "minimal",
        headline: `Enter to win ${name}'s giveaway`,
        body: `Drop your email for a chance to win an exclusive ${name} prize. Winner announced this month.`,
        cta: ctaForOffer("enter"),
      },
      {
        label: "Community angle",
        style: "social-proof",
        headline: `Win big with ${name}`,
        body: `Join thousands of customers in our biggest giveaway yet. One email, one chance to win.`,
        cta: "I want to win",
      },
    ];
  }

  // Free shipping
  if (offerType === "free_shipping") {
    return [
      {
        label: "Direct offer",
        style: "minimal",
        headline: "Free shipping on your first order",
        body: `Shop ${name} today with complimentary shipping. No minimum order required.`,
        cta: ctaForOffer("get"),
      },
      {
        label: "Urgency angle",
        style: "bold",
        headline: "Free shipping, limited time",
        body: `New to ${name}? Your free shipping offer expires soon. Don't miss this.`,
        cta: ctaForOffer("unlock"),
      },
    ];
  }

  // Early access
  if (offerType === "early_access") {
    return [
      {
        label: "Exclusive angle",
        style: "minimal",
        headline: `Be first to shop ${name}`,
        body: `Join our waitlist and receive exclusive early access before we open to everyone.`,
        cta: ctaForOffer("get"),
      },
      {
        label: "Social proof angle",
        style: "social-proof",
        headline: `Join the ${name} waitlist`,
        body: `Hundreds of customers are already signed up. Get early access + a special launch-day offer.`,
        cta: ctaForOffer("unlock"),
      },
    ];
  }

  // Luxury store
  if (isLuxury) {
    return [
      {
        label: "Exclusive access",
        style: "minimal",
        headline: "Join the inner circle",
        body: `${name} members receive early access to new collections and exclusive offers. Invite-only.`,
        cta: "Request access",
      },
      {
        label: "Discount angle",
        style: "bold",
        headline: `A personal offer from ${name}`,
        body: `Receive ${discountLabel()} on your first purchase. A welcome from our team, exclusively for you.`,
        cta: ctaForOffer("claim"),
      },
    ];
  }

  // Health / wellness
  if (isHealth) {
    return [
      {
        label: "Results-led",
        style: "minimal",
        headline: `Start your ${name} routine`,
        body: `Join our subscribers and receive ${discountLabel()} on your first order, plus expert tips weekly.`,
        cta: "Start my routine",
      },
      {
        label: "Social proof",
        style: "social-proof",
        headline: `Join 10,000+ ${name} customers`,
        body: `Real results, real people. Get ${discountLabel()} and access our private wellness community.`,
        cta: "Join the community",
      },
    ];
  }

  // Fashion / apparel
  if (isFashion) {
    return [
      {
        label: "First-look offer",
        style: "minimal",
        headline: `Your first order, ${discountLabel()} off`,
        body: `Welcome to ${name}. Enter your email for ${discountLabel()} on anything in the new collection.`,
        cta: ctaForOffer("get"),
      },
      {
        label: "Scarcity angle",
        style: "bold",
        headline: `Don't pay full price at ${name}`,
        body: `New arrivals sell fast. Lock in your ${discountLabel()} before this offer expires.`,
        cta: ctaForOffer("unlock"),
      },
    ];
  }

  // Food / beverage
  if (isFood) {
    return [
      {
        label: "Taste first",
        style: "minimal",
        headline: `Your first ${name} order, ${discountLabel()} off`,
        body: `Welcome. Subscribe and get ${discountLabel()} on your first order of any ${name} product.`,
        cta: ctaForOffer("get"),
      },
      {
        label: "Community angle",
        style: "social-proof",
        headline: `Thousands love ${name}`,
        body: `Join our community and receive ${discountLabel()} as a welcome gift. Delivered to your door.`,
        cta: "Join and save",
      },
    ];
  }

  // Default: discount / scarcity pair
  return [
    {
      label: "Welcome offer",
      style: "minimal",
      headline: `Get ${discountLabel()} on your first order`,
      body: `Subscribe to ${name} and receive a welcome discount. Use it on anything in the store.`,
      cta: ctaForOffer("claim"),
    },
    {
      label: "Urgency angle",
      style: "bold",
      headline: "Don't pay full price",
      body: `New to ${name}? Your first-order discount expires in 24 hours. Grab it before it's gone.`,
      cta: ctaForOffer("unlock"),
    },
  ];
}

// ─── MiniPopupCard ────────────────────────────────────────────────────────────

function MiniPopupCard({
  variant,
  brandColor,
  storeName,
  visible,
  typewriterHeadline,
  showBody,
}: {
  variant: PopupVariant;
  brandColor: string;
  storeName: string;
  visible: boolean;
  typewriterHeadline?: string;
  showBody: boolean;
}) {
  const textColor = btnTextColor(brandColor);
  const displayHeadline = typewriterHeadline ?? variant.headline;

  return (
    <div
      className="rounded-[16px] bg-white overflow-hidden w-full transition-all duration-500"
      style={{
        boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.06)",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(12px)",
      }}
    >
      {/* Accent bar */}
      <div className="h-1" style={{ backgroundColor: brandColor }} />
      <div className="px-5 pt-3 pb-4">
        {/* Brand row */}
        <div className="flex items-center gap-1.5 mb-2.5">
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: brandColor }} />
          <span className="text-[9px] font-bold tracking-[0.06em] uppercase" style={{ color: "#9ca3af" }}>
            {storeName.toUpperCase()}
          </span>
        </div>
        {/* Headline with cursor during typewriter */}
        <p className="text-[15px] font-extrabold leading-snug mb-1.5 tracking-tight" style={{ color: "#0d0d10", minHeight: "1.4em" }}>
          {displayHeadline}
          {typewriterHeadline !== undefined && typewriterHeadline.length < variant.headline.length && (
            <span
              className="inline-block w-[2px] h-[1em] ml-[1px] align-middle"
              style={{ backgroundColor: brandColor, animation: "cursorBlink 0.6s step-end infinite" }}
            />
          )}
        </p>
        {/* Body — only shown after design step */}
        {showBody && (
          <p className="text-[11px] leading-relaxed mb-3" style={{ color: "#6b7280" }}>
            {variant.body}
          </p>
        )}
        {showBody && (
          <>
            <div
              className="w-full border rounded-[8px] px-2.5 py-2 text-[11px] mb-2"
              style={{ borderColor: "#e5e7eb", background: "#fafafa", color: "#9ca3af" }}
            >
              Your email address
            </div>
            <div
              className="w-full rounded-[8px] py-2 text-[11px] font-bold text-center mb-2"
              style={{ backgroundColor: brandColor, color: textColor }}
            >
              {variant.cta}
            </div>
            <p className="text-center text-[9px]" style={{ color: "#9ca3af" }}>
              No spam. Unsubscribe anytime.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ─── StepList ─────────────────────────────────────────────────────────────────

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
          <p
            className={[
              "text-sm font-medium",
              step.status === "active"
                ? "text-[color:var(--color-text-primary)]"
                : "text-[color:var(--color-text-secondary)]",
            ].join(" ")}
          >
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
  const [steps, setSteps] = useState<GenerationStep[]>(BASE_STEPS.map((s) => ({ ...s })));
  const [phase, setPhase] = useState<"loading" | "done" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [storeName, setStoreName] = useState("your store");
  const [brandColor, setBrandColor] = useState("#165DFF");
  const [variantA, setVariantA] = useState<PopupVariant | null>(null);
  const [variantB, setVariantB] = useState<PopupVariant | null>(null);
  const [campaignId, setCampaignId] = useState<string>("");
  const [campaignError, setCampaignError] = useState<string>("");
  const [launching, setLaunching] = useState(false);

  // Live preview state
  const [previewPhase, setPreviewPhase] = useState<PreviewPhase>("empty");
  const [typewriterText, setTypewriterText] = useState<string>("");
  const [showVariantB, setShowVariantB] = useState(false);

  const ranRef = useRef(false);
  const typewriterRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function setStepStatus(id: string, status: GenerationStep["status"]) {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
  }

  // Typewriter effect for a headline string
  function typeHeadline(headline: string): Promise<void> {
    return new Promise((resolve) => {
      let idx = 0;
      setTypewriterText("");
      // Clear any existing interval
      if (typewriterRef.current) clearInterval(typewriterRef.current);
      typewriterRef.current = setInterval(() => {
        idx++;
        setTypewriterText(headline.slice(0, idx));
        if (idx >= headline.length) {
          if (typewriterRef.current) clearInterval(typewriterRef.current);
          typewriterRef.current = null;
          resolve();
        }
      }, 38); // ~38ms per char => ~1s for 26 chars
    });
  }

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    async function run() {
      // ── Read sessionStorage context ──
      let analyzeData: AnalyzeResult = {};
      let offerType = "percent_discount";
      let offerValue = "10";
      let triggerValue = "3s";

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
        const atRaw = sessionStorage.getItem("asmos_audience_trigger");
        if (atRaw) {
          const at = JSON.parse(atRaw) as { audience: string; trigger: string };
          triggerValue = at.trigger ?? "3s";
        }
      } catch { /* ignore */ }

      const name = analyzeData.storeName ?? "My Store";
      const color = analyzeData.brandColor ?? "#165DFF";
      const industry = analyzeData.industry ?? "Ecommerce";
      const existingPopup = analyzeData.popup;

      setStoreName(name);
      setBrandColor(color);

      // Derive variants early so typewriter can start
      const [varA, varB] = deriveVariants(name, industry, offerType, offerValue, existingPopup);

      // ── Step 1: Brand analysis (800ms) ──
      setStepStatus("brand", "active");
      setPreviewPhase("brand");
      await delay(800);
      setStepStatus("brand", "done");

      // ── Step 2: Headline writing (typewriter during this step) ──
      setStepStatus("headlines", "active");
      setPreviewPhase("headline");

      // Start typewriter; step advances after it completes or after max 1200ms
      const typePromise = typeHeadline(varA.headline);
      const minWait = delay(1200);
      await Promise.all([typePromise, minWait]);

      // Commit variant data (headline now fully typed)
      setVariantA(varA);
      setVariantB(varB);
      setStepStatus("headlines", "done");

      // ── Step 3: Design build (900ms) ──
      setStepStatus("design", "active");
      await delay(900);
      setPreviewPhase("design");
      setStepStatus("design", "done");

      // ── Step 4: A/B setup (600ms) ──
      setStepStatus("ab", "active");
      await delay(600);
      setShowVariantB(true);
      setPreviewPhase("done");
      setStepStatus("ab", "done");

      setPhase("done");
    }

    run();

    return () => {
      if (typewriterRef.current) clearInterval(typewriterRef.current);
    };
  }, []);

  // ── Campaign creation (on button click) ──
  async function handleLaunch() {
    if (launching || !variantA || !variantB) return;
    setLaunching(true);
    setCampaignError("");

    try {
      // Read trigger from sessionStorage at click time
      let triggerValue = "3s";
      let offerType = "percent_discount";
      let offerValue = "10";
      try {
        const atRaw = sessionStorage.getItem("asmos_audience_trigger");
        if (atRaw) {
          const at = JSON.parse(atRaw) as { audience: string; trigger: string };
          triggerValue = at.trigger ?? "3s";
        }
        const osRaw = sessionStorage.getItem("asmos_offer_selection");
        if (osRaw) {
          const os = JSON.parse(osRaw) as { type: string; value: string };
          offerType = os.type ?? "percent_discount";
          offerValue = os.value ?? "10";
        }
      } catch { /* ignore */ }

      type TriggerPayload =
        | { trigger: "time_delay"; delaySeconds: number }
        | { trigger: "exit_intent"; delaySeconds: null }
        | { trigger: "scroll_depth"; delaySeconds: null; scrollPercent?: number };

      function buildTrigger(tv: string): TriggerPayload {
        switch (tv) {
          case "5s": return { trigger: "time_delay", delaySeconds: 5 };
          case "exit": return { trigger: "exit_intent", delaySeconds: null };
          case "scroll50": return { trigger: "scroll_depth", delaySeconds: null, scrollPercent: 50 };
          default: return { trigger: "time_delay", delaySeconds: 3 };
        }
      }

      function rewardType(ot: string): "DISCOUNT_PERCENT" | "DISCOUNT_FIXED" | "FREE_SHIPPING" | "COUPON" {
        if (ot === "fixed_discount") return "DISCOUNT_FIXED";
        if (ot === "free_shipping") return "FREE_SHIPPING";
        return "DISCOUNT_PERCENT";
      }

      const triggerPayload = buildTrigger(triggerValue);
      const campaignPayload = {
        name: `${storeName} Welcome Series`,
        type: "FORM" as const,
        design: {
          headline: variantA.headline,
          body: variantA.body,
          primaryColor: brandColor,
          ctaText: variantA.cta,
        },
        formFields: ["email"],
        targeting: triggerPayload,
        rewards: [
          {
            label: variantA.cta,
            type: rewardType(offerType),
            couponCode: offerType === "free_shipping" ? null : "WELCOME10",
            weight: 100,
          },
        ],
        status: "ACTIVE",
      };

      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(campaignPayload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Request failed: ${res.status}`);
      }

      const data = await res.json() as { campaign: { id: string } };
      const cId = data.campaign.id;
      setCampaignId(cId);

      // Add variant B (non-fatal)
      await fetch(`/api/campaigns/${cId}/variants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: variantB.label,
          design: {
            headline: variantB.headline,
            body: variantB.body,
            primaryColor: brandColor,
            ctaText: variantB.cta,
          },
          formFields: ["email"],
          targeting: triggerPayload,
          rewards: [
            {
              label: variantB.cta,
              type: rewardType(offerType),
              couponCode: offerType === "free_shipping" ? null : "WELCOME10",
              weight: 100,
            },
          ],
        }),
      }).catch(() => { /* non-fatal */ });

      router.push(`/campaigns/${cId}`);
    } catch (e) {
      setCampaignError(e instanceof Error ? e.message : "Something went wrong");
      setLaunching(false);
    }
  }

  // ── Derive what to show in the live preview during loading ──
  const previewVisible = previewPhase !== "empty";
  const showBodyInPreview = previewPhase === "design" || previewPhase === "done" || phase === "done";
  const headlineForPreview =
    previewPhase === "headline" ? typewriterText
    : previewPhase === "brand" ? ""
    : (variantA?.headline ?? "");

  const liveVariantA: PopupVariant = variantA ?? {
    label: "Variant A",
    style: "minimal",
    headline: headlineForPreview,
    body: "",
    cta: "Subscribe",
  };

  const progressPct = (steps.filter((s) => s.status === "done").length / steps.length) * 100;

  return (
    <div className="flex flex-col items-center justify-center px-6 py-16">
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes cursorBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(16px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      <div className="w-full max-w-lg flex flex-col items-center gap-8 animate-page-enter">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-xl font-bold text-[color:var(--color-text-primary)]">
            {phase === "done"
              ? "Your popups are ready"
              : `Building your popup for ${storeName}`}
          </h1>
          <p className="mt-1.5 text-sm text-[color:var(--color-text-secondary)]">
            {phase === "done"
              ? "Two A/B variants generated. Launch the campaign or go back to make changes."
              : "Using your brand and industry to generate high-converting variants."}
          </p>
        </div>

        {/* ── Loading layout: steps left, live preview right ── */}
        {phase === "loading" && (
          <div className="w-full flex flex-col sm:flex-row items-start gap-8">
            {/* Steps */}
            <div className="flex-shrink-0">
              <StepList steps={steps} />
            </div>

            {/* Live preview */}
            <div className="flex-1 min-w-0 w-full max-w-[220px] sm:max-w-none mx-auto">
              {previewVisible ? (
                <MiniPopupCard
                  variant={liveVariantA}
                  brandColor={brandColor}
                  storeName={storeName}
                  visible={previewVisible}
                  typewriterHeadline={previewPhase === "headline" ? typewriterText : undefined}
                  showBody={showBodyInPreview}
                />
              ) : (
                <div
                  className="rounded-[16px] border-2 border-dashed w-full h-40 flex items-center justify-center"
                  style={{ borderColor: "#e5e7eb" }}
                >
                  <p className="text-[11px]" style={{ color: "#9ca3af" }}>Preview will appear here</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Progress bar during loading */}
        {phase === "loading" && (
          <div className="w-full max-w-xs">
            <div className="h-0.5 w-full overflow-hidden rounded-full bg-[color:var(--color-surface)]">
              <div
                className="h-full rounded-full bg-[color:var(--color-primary)] transition-[width] duration-500 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {/* ── Error state ── */}
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

        {/* ── Done: two side-by-side variant cards ── */}
        {phase === "done" && variantA && variantB && (
          <div className="w-full flex flex-col gap-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Variant A */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                    style={{ backgroundColor: brandColor, color: btnTextColor(brandColor) }}
                  >
                    A
                  </span>
                  <span className="text-[11px] text-[color:var(--color-text-secondary)]">{variantA.label}</span>
                </div>
                <MiniPopupCard
                  variant={variantA}
                  brandColor={brandColor}
                  storeName={storeName}
                  visible
                  showBody
                />
              </div>

              {/* Variant B — slides in after A/B step */}
              <div
                className="flex flex-col gap-2"
                style={{
                  animation: showVariantB ? "slideInRight 0.45s cubic-bezier(0.22,1,0.36,1) both" : "none",
                  opacity: showVariantB ? 1 : 0,
                }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                    style={{ backgroundColor: "#6b7280", color: "#ffffff" }}
                  >
                    B
                  </span>
                  <span className="text-[11px] text-[color:var(--color-text-secondary)]">{variantB.label}</span>
                </div>
                <MiniPopupCard
                  variant={variantB}
                  brandColor={brandColor}
                  storeName={storeName}
                  visible={showVariantB}
                  showBody
                />
              </div>
            </div>

            {/* Campaign error */}
            {campaignError && (
              <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
                <p className="text-sm text-amber-700">{campaignError}</p>
                <p className="text-xs text-amber-600 mt-1">Campaign creation failed. You can still launch from the dashboard after connecting your store.</p>
              </div>
            )}

            {/* Launch CTA */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={handleLaunch}
                disabled={launching}
                className="rounded-xl px-6 py-3 text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{
                  backgroundColor: brandColor,
                  color: btnTextColor(brandColor),
                }}
              >
                {launching && (
                  <span
                    className="inline-block h-4 w-4 rounded-full border-2 border-current border-t-transparent flex-shrink-0"
                    style={{ animation: "spin 0.7s linear infinite" }}
                  />
                )}
                {launching ? "Creating campaign..." : "Launch this campaign"}
              </button>
              <button
                onClick={() => router.back()}
                className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-6 py-3 text-sm font-medium text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-surface-sunken)] transition-colors"
              >
                Back
              </button>
            </div>

            <p className="text-center text-[11px] text-[color:var(--color-text-secondary)]">
              Asmos will split traffic 50/50 between Variant A and B and optimize automatically.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
