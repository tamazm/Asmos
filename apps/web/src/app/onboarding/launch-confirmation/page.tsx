"use client";

import { Suspense } from "react";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface VariantDesign {
  headline?: string;
  body?: string;
  primaryColor?: string;
  ctaText?: string;
}

interface Variant {
  id: string;
  name: string;
  isControl: boolean;
  design: VariantDesign | null;
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  targeting?: Record<string, unknown>;
  deviceTarget?: string;
  variants: Variant[];
}

// ─── Derive readable text color for brand color ───────────────────────────────
function readableColor(hex: string): string {
  const s = (hex ?? "#165DFF").trim();
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
function MiniPopupPreview({
  design,
  storeName,
  label,
  variantIndex,
}: {
  design: VariantDesign;
  storeName: string;
  label: string;
  variantIndex: "A" | "B" | string;
}) {
  const color = design.primaryColor ?? "#165DFF";
  const textColor = readableColor(color);
  const VARIANT_COLORS = ["#3B82F6", "#8B5CF6"];
  const badgeColor = VARIANT_COLORS[["A", "B", "C", "D"].indexOf(variantIndex)] ?? "#3B82F6";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
          style={{ backgroundColor: badgeColor }}
        >
          {variantIndex}
        </span>
        <span className="text-[11px] text-[color:var(--color-text-secondary)] truncate">{label}</span>
      </div>

      {/* Double-Bezel popup preview card */}
      <div className="rounded-[1.125rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-1 shadow-sm">
        <div
          className="rounded-[0.875rem] bg-white overflow-hidden"
          style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9)" }}
        >
          {/* Brand accent bar */}
          <div className="h-[3px]" style={{ backgroundColor: color }} />
          <div className="px-4 pt-3 pb-4">
            {/* Store row */}
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-[9px] font-bold tracking-[0.06em] uppercase text-[color:var(--color-text-secondary)]">
                {storeName.toUpperCase()}
              </span>
            </div>
            {/* Headline */}
            <p className="text-[13px] font-extrabold leading-snug mb-1 tracking-tight text-[color:var(--color-text-primary)]">
              {design.headline ?? "Get 10% off your first order"}
            </p>
            {/* Body */}
            <p className="text-[10px] leading-relaxed mb-2.5 text-[color:var(--color-text-secondary)]">
              {design.body ?? `Subscribe and unlock your exclusive offer from ${storeName}.`}
            </p>
            {/* Input placeholder */}
            <div
              className="w-full rounded-[6px] px-2 py-1.5 text-[10px] mb-2 border"
              style={{ borderColor: "#e5e7eb", background: "#fafafa", color: "#9ca3af" }}
            >
              Your email address
            </div>
            {/* CTA */}
            <div
              className="w-full rounded-[6px] py-1.5 text-[10px] font-bold text-center mb-1.5"
              style={{ backgroundColor: color, color: textColor }}
            >
              {design.ctaText ?? "Claim my discount"}
            </div>
            <p className="text-center text-[8px] text-[color:var(--color-text-secondary)]">
              No spam. Unsubscribe anytime.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Trigger label helpers ─────────────────────────────────────────────────────
function triggerLabel(targeting: Record<string, unknown> | null | undefined): string {
  if (!targeting) return "Time delay (3s)";
  const t = (targeting as { trigger?: string; delaySeconds?: number; scrollPercent?: number }).trigger;
  switch (t) {
    case "exit_intent": return "Exit intent";
    case "scroll_depth":
      return `Scroll depth (${(targeting as { scrollPercent?: number }).scrollPercent ?? 50}%)`;
    case "time_delay":
      return `Time delay (${(targeting as { delaySeconds?: number }).delaySeconds ?? 3}s)`;
    default: return "Time delay (3s)";
  }
}

function audienceLabel(targeting: Record<string, unknown> | null | undefined): string {
  if (!targeting) return "All visitors";
  const audience = (targeting as { audience?: string }).audience;
  switch (audience) {
    case "new_visitors": return "New visitors only";
    case "returning_visitors": return "Returning visitors only";
    case "cart_abandoners": return "Cart abandoners";
    default: return "All visitors";
  }
}

// ─── Check icon ───────────────────────────────────────────────────────────────
function CheckIcon({ color = "#22C55E" }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="7" fill={color === "#22C55E" ? "#DCFCE7" : "#DBEAFE"} />
      <path d="M5 8l2.5 2.5L11 5.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Confetti burst (CSS only, no library) ────────────────────────────────────
function ConfettiBurst() {
  const pieces = [
    { color: "#165DFF", x: -60, y: -80, rot: -30, delay: 0 },
    { color: "#22C55E", x: 60, y: -90, rot: 20, delay: 0.05 },
    { color: "#F59E0B", x: -40, y: -110, rot: -50, delay: 0.1 },
    { color: "#EC4899", x: 80, y: -60, rot: 40, delay: 0.08 },
    { color: "#8B5CF6", x: -90, y: -50, rot: -20, delay: 0.12 },
    { color: "#F97316", x: 20, y: -120, rot: 60, delay: 0.03 },
    { color: "#06B6D4", x: -70, y: -70, rot: -45, delay: 0.15 },
    { color: "#10B981", x: 100, y: -40, rot: 15, delay: 0.06 },
    { color: "#EF4444", x: -20, y: -130, rot: -10, delay: 0.09 },
    { color: "#165DFF", x: 50, y: -100, rot: 35, delay: 0.11 },
    { color: "#F59E0B", x: -100, y: -30, rot: -60, delay: 0.04 },
    { color: "#8B5CF6", x: 30, y: -115, rot: 50, delay: 0.13 },
  ];

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden" aria-hidden="true">
      <style>{`
        @keyframes confetti-fall {
          0% { opacity: 1; transform: translate(0, 0) rotate(0deg) scale(1); }
          100% { opacity: 0; transform: var(--cf-end) scale(0.3); }
        }
      `}</style>
      {pieces.map((p, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            width: 8,
            height: 8,
            borderRadius: i % 3 === 0 ? "50%" : i % 3 === 1 ? "1px" : "2px",
            backgroundColor: p.color,
            animation: `confetti-fall 1.2s ease-out forwards`,
            animationDelay: `${p.delay}s`,
            ["--cf-end" as string]: `translate(${p.x}px, ${p.y}px) rotate(${p.rot * 3}deg) scale(0.3)`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Success state ─────────────────────────────────────────────────────────────
function SuccessState({
  campaignId,
  primaryColor,
  onDashboard,
}: {
  campaignId: string;
  primaryColor: string;
  onDashboard: () => void;
}) {
  const textColor = readableColor(primaryColor);
  void campaignId; // used for future deep link

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[color:var(--color-surface-sunken)] px-6 py-16">
      <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center animate-page-enter">
        {/* Icon with confetti */}
        <div className="relative flex items-center justify-center">
          <ConfettiBurst />
          {/* Double-Bezel icon well */}
          <div className="rounded-[1.375rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-1.5 shadow-sm">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-[0.875rem]"
              style={{
                backgroundColor: primaryColor,
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2)",
              }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M20 6L9 17l-5-5" stroke={textColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[color:var(--color-text-primary)]">
            Campaign is live
          </h1>
          <p className="mt-2 text-sm text-[color:var(--color-text-secondary)]" style={{ textWrap: "pretty" } as React.CSSProperties}>
            Your popup is now active and collecting leads. Head to your dashboard to track performance.
          </p>
        </div>

        {/* Double-Bezel card with next steps */}
        <div className="w-full rounded-[1.375rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-1.5 shadow-sm">
          <div
            className="rounded-[1rem] bg-[color:var(--color-surface)] px-5 py-4 flex flex-col gap-3"
            style={{ boxShadow: "inset 0 1px 1px rgba(255,255,255,0.95)" }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-text-secondary)]">
              What happens next
            </p>
            {[
              "Your popup appears on your store immediately",
              "Leads are captured and listed under this campaign",
              "A/B test results update in real time",
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <CheckIcon color={primaryColor === "#165DFF" ? "#22C55E" : primaryColor} />
                <span className="text-sm text-[color:var(--color-text-primary)]">{step}</span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={onDashboard}
          className="w-full rounded-lg h-11 text-sm font-semibold transition-[background-color,transform] duration-200 active:scale-[0.97]"
          style={{ backgroundColor: primaryColor, color: textColor }}
        >
          Go to dashboard
        </button>

        <p className="text-[11px] text-[color:var(--color-text-secondary)]">
          You can pause or edit this campaign at any time.
        </p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
function LaunchConfirmationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const campaignId = searchParams.get("campaign") ?? "";

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [launched, setLaunched] = useState(false);

  // Read store name from session storage
  const [storeName, setStoreName] = useState("Your Store");

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("asmos_analyze_result");
      if (raw) {
        const parsed = JSON.parse(raw) as { storeName?: string };
        if (parsed.storeName) setStoreName(parsed.storeName);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!campaignId) {
      setLoadError("No campaign ID provided.");
      setLoading(false);
      return;
    }

    async function fetchCampaign() {
      try {
        const res = await fetch(`/api/campaigns/${campaignId}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { error?: string };
          throw new Error(body.error ?? "Could not load campaign");
        }
        const data = await res.json() as { campaign: Campaign };
        setCampaign(data.campaign);
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : "Could not load campaign");
      } finally {
        setLoading(false);
      }
    }

    fetchCampaign();
  }, [campaignId]);

  async function handleLaunch() {
    if (!campaignId) return;
    setLaunching(true);
    setLaunchError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACTIVE" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Could not launch campaign");
      }
      setLaunched(true);
    } catch (e) {
      setLaunchError(e instanceof Error ? e.message : "Something went wrong");
      setLaunching(false);
    }
  }

  // ─── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[color:var(--color-surface-sunken)] px-6">
        <div
          className="h-5 w-5 rounded-full border-2 border-[color:var(--color-primary)] border-t-transparent"
          style={{ animation: "spin 0.7s linear infinite" }}
          aria-label="Loading"
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ─── Error state ───────────────────────────────────────────────────────────
  if (loadError || !campaign) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[color:var(--color-surface-sunken)] px-6 py-16">
        <div className="w-full max-w-sm text-center flex flex-col gap-4">
          <p className="text-sm text-red-600">{loadError ?? "Campaign not found."}</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2.5 text-sm font-medium text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-surface-sunken)] transition-[background-color] duration-200"
          >
            Go to dashboard
          </button>
        </div>
      </div>
    );
  }

  // ─── Success state ─────────────────────────────────────────────────────────
  const variants = campaign.variants ?? [];
  const primaryDesign = variants[0]?.design ?? {};
  const primaryColor = primaryDesign.primaryColor ?? "#165DFF";

  if (launched) {
    return (
      <SuccessState
        campaignId={campaignId}
        primaryColor={primaryColor}
        onDashboard={() => router.push("/dashboard")}
      />
    );
  }

  // Extract variant data
  const variantLabels = ["A", "B", "C", "D"];

  // ─── Pre-launch checklist items ─────────────────────────────────────────────
  const checklistItems = [
    {
      label: "Brand color",
      value: (
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded-[3px] border border-black/10 flex-shrink-0"
            style={{ backgroundColor: primaryColor }}
          />
          <span className="font-mono text-[11px] tabular-nums">{primaryColor}</span>
        </span>
      ),
    },
    {
      label: "Variant A headline",
      value: variants[0]?.design?.headline ?? "Get 10% off your first order",
    },
    ...(variants.length > 1
      ? [
          {
            label: "Variant B headline",
            value: variants[1]?.design?.headline ?? "Join the list",
          },
        ]
      : []),
    {
      label: "Trigger",
      value: triggerLabel(campaign.targeting as Record<string, unknown> | null),
    },
    {
      label: "Audience",
      value: audienceLabel(campaign.targeting as Record<string, unknown> | null),
    },
    {
      label: "Device target",
      value: campaign.deviceTarget
        ? campaign.deviceTarget.charAt(0).toUpperCase() + campaign.deviceTarget.slice(1).toLowerCase()
        : "All devices",
    },
    {
      label: "A/B split",
      value: `${variants.length} variant${variants.length !== 1 ? "s" : ""}, 50/50 traffic split`,
    },
  ];

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[color:var(--color-surface-sunken)] px-6 py-16">
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div className="w-full max-w-lg flex flex-col gap-8 animate-page-enter">

        {/* Header */}
        <div className="text-center">
          {/* Double-Bezel icon well */}
          <div className="flex justify-center mb-5">
            <div className="rounded-[1.125rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-1.5">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-[0.75rem] bg-[color:var(--color-primary-light)]"
                style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8)" }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M9 12l2 2 4-4" stroke="#165DFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M12 3a9 9 0 100 18A9 9 0 0012 3z" stroke="#165DFF" strokeWidth="2" />
                </svg>
              </div>
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[color:var(--color-text-primary)]">
            Ready to launch
          </h1>
          <p className="mt-1.5 text-sm text-[color:var(--color-text-secondary)]">
            Review your campaign before it goes live.
          </p>
        </div>

        {/* Campaign summary card */}
        <div className="rounded-[1.375rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-1.5 shadow-sm">
          <div
            className="rounded-[1rem] bg-[color:var(--color-surface)] p-6 flex flex-col gap-5"
            style={{ boxShadow: "inset 0 1px 1px rgba(255,255,255,0.95)" }}
          >
            {/* Campaign name */}
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-text-secondary)] mb-1">
                Campaign
              </p>
              <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">
                {campaign.name}
              </p>
            </div>

            {/* Variant previews */}
            {variants.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-text-secondary)] mb-3">
                  Variants
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {variants.slice(0, 4).map((variant, i) => (
                    <MiniPopupPreview
                      key={variant.id}
                      design={variant.design ?? {}}
                      storeName={storeName}
                      label={variant.name}
                      variantIndex={variantLabels[i] ?? String(i + 1)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Pre-launch checklist */}
            <div className="flex flex-col gap-2.5 pt-1 border-t border-[color:var(--color-border)]">
              <p className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-text-secondary)] mb-1">
                Pre-launch checklist
              </p>

              {checklistItems.map((item) => (
                <div key={item.label} className="flex items-start gap-2.5">
                  <CheckIcon />
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-xs text-[color:var(--color-text-secondary)]">{item.label}</span>
                    {typeof item.value === "string" ? (
                      <span className="text-sm font-medium text-[color:var(--color-text-primary)] truncate">{item.value}</span>
                    ) : (
                      <div className="text-sm font-medium text-[color:var(--color-text-primary)]">{item.value}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Error */}
        {launchError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm text-red-600">{launchError}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            onClick={() => router.push(`/onboarding/generate-popup?campaign=${campaignId}`)}
            className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-6 py-2.5 text-sm font-medium text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-surface-sunken)] transition-[background-color] duration-200 h-10"
          >
            Back
          </button>
          <button
            onClick={handleLaunch}
            disabled={launching}
            className="rounded-lg px-6 py-2.5 text-sm font-semibold text-white h-10 transition-[background-color,transform] duration-200 hover:opacity-90 active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ backgroundColor: primaryColor }}
          >
            {launching ? "Launching..." : "Go live"}
          </button>
        </div>

        <p className="text-center text-[11px] text-[color:var(--color-text-secondary)]">
          You can pause or edit this campaign at any time from your dashboard.
        </p>
      </div>
    </div>
  );
}

export default function LaunchConfirmationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[color:var(--color-surface-sunken)]">
          <div
            className="h-5 w-5 rounded-full border-2 border-[color:var(--color-primary)] border-t-transparent"
            style={{ animation: "spin 0.7s linear infinite" }}
            aria-label="Loading"
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      }
    >
      <LaunchConfirmationContent />
    </Suspense>
  );
}
