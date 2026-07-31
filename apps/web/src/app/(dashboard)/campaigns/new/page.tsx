"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { campaignCreated } from "@/lib/analytics";

// ─── Types ────────────────────────────────────────────────────────────────────

type CampaignType = "WHEEL" | "SCRATCH_CARD" | "FORM";
type TriggerType = "exit_intent" | "time_delay" | "scroll_depth";
type DeviceTarget = "all" | "mobile" | "desktop";

interface WizardState {
  type: CampaignType;
  name: string;
  design: {
    headline: string;
    body: string;
    primaryColor: string;
    ctaText: string;
  };
  formFields: string[];
  targeting: {
    trigger: TriggerType;
    delaySeconds: number;
    urlPattern: string;
    device: DeviceTarget;
  };
  reward: {
    label: string;
    type: "COUPON" | "DISCOUNT_PERCENT" | "DISCOUNT_FIXED" | "FREE_SHIPPING";
    couponCode: string;
  };
}

const defaultState: WizardState = {
  type: "FORM",
  name: "",
  design: {
    headline: "Get 10% off your first order",
    body: "Join our list and we'll send you a discount code right away.",
    primaryColor: "#165DFF",
    ctaText: "Get my discount",
  },
  formFields: ["email"],
  targeting: {
    trigger: "time_delay",
    delaySeconds: 5,
    urlPattern: "",
    device: "all",
  },
  reward: {
    label: "10% Off",
    type: "DISCOUNT_PERCENT",
    couponCode: "",
  },
};

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: "Type" },
  { id: 2, label: "Design" },
  { id: 3, label: "Form" },
  { id: 4, label: "Targeting" },
  { id: 5, label: "Publish" },
];

function StepBar({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-0">
      {STEPS.map((step, i) => {
        const done = current > step.id;
        const active = current === step.id;
        return (
          <li key={step.id} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              {/* Double-Bezel step indicator */}
              <div
                className={cn(
                  "rounded-[0.625rem] p-0.5 transition-colors duration-300",
                  done || active
                    ? "bg-[color:var(--color-primary)]/15"
                    : "bg-[color:var(--color-surface-sunken)]",
                )}
              >
                <div
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-[0.5rem] text-xs font-semibold transition-colors duration-300",
                    done || active
                      ? "bg-[color:var(--color-primary)] text-white"
                      : "bg-[color:var(--color-neutral-badge)] text-[color:var(--color-text-secondary)]",
                  )}
                  style={done || active ? { boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2)" } : {}}
                >
                  {done ? (
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M3.5 8L6.5 11L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    step.id
                  )}
                </div>
              </div>
              <span className={cn("hidden text-xs sm:block", active ? "font-medium text-[color:var(--color-text-primary)]" : "text-[color:var(--color-text-secondary)]")}>{
                step.label
              }</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn("mx-2 h-0.5 w-8 rounded-full transition-colors duration-300", done ? "bg-[color:var(--color-primary)]" : "bg-[color:var(--color-border)]")} aria-hidden="true" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ─── Step 1: Type selection ───────────────────────────────────────────────────

const CAMPAIGN_TYPES = [
  {
    value: "FORM" as CampaignType,
    label: "Lead form",
    description: "A clean popup with a form to capture emails and other fields.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
        <rect x="4" y="8" width="24" height="16" rx="3" stroke="#165DFF" strokeWidth="1.8" />
        <line x1="9" y1="14" x2="23" y2="14" stroke="#165DFF" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="9" y1="18" x2="17" y2="18" stroke="#165DFF" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    value: "WHEEL" as CampaignType,
    label: "Spin to win",
    description: "Gamified spin wheel with configurable reward prizes.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="12" stroke="#165DFF" strokeWidth="1.8" />
        <line x1="16" y1="4" x2="16" y2="28" stroke="#165DFF" strokeWidth="1.5" />
        <line x1="4" y1="16" x2="28" y2="16" stroke="#165DFF" strokeWidth="1.5" />
        <line x1="7.5" y1="7.5" x2="24.5" y2="24.5" stroke="#165DFF" strokeWidth="1.5" />
        <line x1="24.5" y1="7.5" x2="7.5" y2="24.5" stroke="#165DFF" strokeWidth="1.5" />
        <circle cx="16" cy="16" r="3" fill="#165DFF" />
      </svg>
    ),
  },
  {
    value: "SCRATCH_CARD" as CampaignType,
    label: "Scratch card",
    description: "Users scratch to reveal a reward. High engagement.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
        <rect x="4" y="8" width="24" height="16" rx="3" stroke="#165DFF" strokeWidth="1.8" />
        <path d="M10 20 Q14 14 18 20 Q22 26 26 18" stroke="#165DFF" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      </svg>
    ),
  },
] as const;

function Step1TypeSelect({ state, update }: { state: WizardState; update: (s: Partial<WizardState>) => void }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)]">Choose a campaign type</h2>
        <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">You can run A/B variants of any type after publishing.</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {CAMPAIGN_TYPES.map((opt) => {
          const active = state.type === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => update({ type: opt.value })}
              className={cn(
                "flex flex-col items-start gap-3 rounded-2xl border p-5 text-left transition-[border-color,background-color,box-shadow] duration-200 cursor-pointer",
                active
                  ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary-light)] shadow-sm"
                  : "border-[color:var(--color-border)] bg-[color:var(--color-surface)] hover:border-[color:var(--color-primary)]/40 hover:shadow-sm",
              )}
              aria-pressed={active}
            >
              {/* Double-Bezel icon well */}
              <div className={cn(
                "rounded-[0.875rem] p-1 transition-colors duration-200",
                active ? "bg-[color:var(--color-primary)]/10" : "bg-[color:var(--color-surface-sunken)]",
              )}>
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-[0.625rem] bg-[color:var(--color-primary-light)]"
                  style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8)" }}
                >
                  {opt.icon}
                </div>
              </div>
              <div>
                <p className={cn("font-semibold", active ? "text-[color:var(--color-primary)]" : "text-[color:var(--color-text-primary)]")}>{opt.label}</p>
                <p className="mt-0.5 text-xs text-[color:var(--color-text-secondary)] leading-relaxed">{opt.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      <div>
        <label htmlFor="campaign-name" className="mb-1.5 block text-sm font-medium text-[color:var(--color-text-primary)]">
          Campaign name
        </label>
        <input
          id="campaign-name"
          type="text"
          value={state.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="e.g. Summer Sale Email Capture"
          className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/20 transition-colors duration-150"
        />
      </div>
    </div>
  );
}

// ─── Step 2: Design editor + live preview ─────────────────────────────────────

/** Full-fidelity popup preview that mirrors asmos-widget.js v2 design */
function PopupPreview({ state }: { state: WizardState }) {
  const primary = state.design.primaryColor || "#165DFF";
  const storeName = "Your Store";

  // Determine text color for button (white on dark, dark on light)
  function hexLuminance(hex: string) {
    const s = hex.trim();
    let r = 22, g = 93, b = 255;
    if (s[0] === "#") {
      const full = s.length === 4
        ? "#" + s[1] + s[1] + s[2] + s[2] + s[3] + s[3]
        : s;
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
  const btnTextColor = hexLuminance(primary) < 0.35 ? "#ffffff" : "#0d0d10";
  const focusRingColor = primary + "2e"; // 18% opacity approx

  const inputIds = state.formFields;

  return (
    <div className="rounded-2xl border border-[color:var(--color-border)] bg-[#e8edf5] p-5 flex items-end justify-center">
      {/* Mimics the widget card in desktop mode */}
      <div
        className="w-full max-w-[360px] rounded-[20px] bg-white overflow-hidden relative"
        style={{
          boxShadow: "0 24px 80px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif",
        }}
      >
        {/* Accent bar */}
        <div className="h-1" style={{ backgroundColor: primary }} />

        <div className="px-6 pt-4 pb-5">
          {/* Close button */}
          <div className="flex justify-end mb-2">
            <div className="w-6 h-6 rounded-full bg-[#f3f4f6] flex items-center justify-center">
              <svg width="8" height="8" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                <path d="M1 1l8 8M9 1L1 9" stroke="#6b7280" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </div>
          </div>

          {/* Brand row */}
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: primary }} />
            <span
              className="text-[10px] font-bold tracking-[0.06em] uppercase"
              style={{ color: "#9ca3af" }}
            >
              {storeName.toUpperCase()}
            </span>
          </div>

          {/* Headline */}
          <h3
            className="text-[18px] font-extrabold leading-snug mb-1.5 tracking-tight"
            style={{ color: "#0d0d10" }}
          >
            {state.design.headline || "Your headline here"}
          </h3>

          {/* Body */}
          <p className="text-[13px] leading-relaxed mb-4" style={{ color: "#6b7280" }}>
            {state.design.body || "Your body copy goes here."}
          </p>

          {/* Wheel/scratch preview block */}
          {state.type !== "FORM" && (
            <div
              className="rounded-xl border p-3 mb-4 text-center"
              style={{ background: "#f9fafb", borderColor: "#e5e7eb" }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: "#9ca3af" }}>
                You could win
              </p>
              <ul className="space-y-1">
                {[state.reward.label || "Special reward"].map((label, i) => (
                  <li key={i} className="flex items-center gap-1.5 text-[12px] justify-center" style={{ color: "#374151" }}>
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: primary }} />
                    {label}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Form inputs */}
          <div className="flex flex-col gap-2 mb-3">
            {inputIds.map((f) => (
              <div
                key={f}
                className="w-full border rounded-[10px] px-3 py-2.5 text-[13px]"
                style={{
                  borderColor: "#e5e7eb",
                  background: "#fafafa",
                  color: "#9ca3af",
                }}
              >
                {f === "email" ? "Your email address"
                  : f === "phone" ? "Phone number"
                  : f === "name" ? "Your name"
                  : f.charAt(0).toUpperCase() + f.slice(1)}
              </div>
            ))}
          </div>

          {/* CTA button */}
          <button
            type="button"
            tabIndex={-1}
            className="w-full rounded-[10px] py-3 text-[13px] font-bold tracking-[0.01em] mb-3 transition-transform"
            style={{
              backgroundColor: primary,
              color: btnTextColor,
              border: "none",
              boxShadow: `0 0 0 0px ${focusRingColor}`,
            }}
          >
            {state.design.ctaText || "Get my offer"}
          </button>

          {/* Trust row */}
          <div
            className="flex items-center justify-center gap-4 pt-3 flex-wrap"
            style={{ borderTop: "1px solid #f3f4f6" }}
          >
            {[
              { icon: (
                <svg viewBox="0 0 16 16" fill="none" width="10" height="10">
                  <path d="M8 1.5 10 5.5 14.5 6.2 11.25 9.3 12 13.8 8 11.7 4 13.8 4.75 9.3 1.5 6.2 6 5.5 8 1.5z" stroke="#9ca3af" strokeWidth="1.2" strokeLinejoin="round" />
                </svg>
              ), label: "No spam" },
              { icon: (
                <svg viewBox="0 0 16 16" fill="none" width="10" height="10">
                  <rect x="2" y="6" width="12" height="9" rx="2" stroke="#9ca3af" strokeWidth="1.2" />
                  <path d="M5 6V4.5a3 3 0 016 0V6" stroke="#9ca3af" strokeWidth="1.2" />
                </svg>
              ), label: "Unsubscribe anytime" },
              { icon: (
                <svg viewBox="0 0 16 16" fill="none" width="10" height="10">
                  <circle cx="8" cy="8" r="6" stroke="#9ca3af" strokeWidth="1.2" />
                  <path d="M5.5 8.5 7 10 10.5 6" stroke="#9ca3af" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ), label: "Instant reward" },
            ].map(({ icon, label }) => (
              <span key={label} className="flex items-center gap-1 text-[10px] whitespace-nowrap" style={{ color: "#9ca3af" }}>
                {icon}{label}
              </span>
            ))}
          </div>

          {/* Dismiss link */}
          <button
            type="button"
            tabIndex={-1}
            className="block w-full text-center text-[11px] mt-3 underline underline-offset-2"
            style={{ color: "#9ca3af", background: "none", border: "none", cursor: "pointer" }}
          >
            No thanks, I&apos;ll pay full price
          </button>
        </div>
      </div>
    </div>
  );
}

const PRESET_COLORS = ["#165DFF", "#10B981", "#F97316", "#EC4899", "#8B5CF6", "#EAB308", "#0D0D10"];

function Step2Design({ state, update }: { state: WizardState; update: (s: Partial<WizardState>) => void }) {
  function updateDesign(d: Partial<WizardState["design"]>) {
    update({ design: { ...state.design, ...d } });
  }
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_260px]">
      <div className="flex flex-col gap-5">
        <div>
          <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)]">Design your popup</h2>
          <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">Customize the copy and look. Preview updates live.</p>
        </div>

        {[
          { id: "headline", label: "Headline", placeholder: "Get 10% off your first order" },
          { id: "body", label: "Body text", placeholder: "Join our list for exclusive offers." },
          { id: "ctaText", label: "Button text", placeholder: "Get my discount" },
        ].map((field) => (
          <div key={field.id}>
            <label htmlFor={`design-${field.id}`} className="mb-1.5 block text-sm font-medium text-[color:var(--color-text-primary)]">{field.label}</label>
            <input
              id={`design-${field.id}`}
              type="text"
              value={state.design[field.id as keyof WizardState["design"]]}
              onChange={(e) => updateDesign({ [field.id]: e.target.value })}
              placeholder={field.placeholder}
              className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/20 transition-colors duration-150"
            />
          </div>
        ))}

        <div>
          <p className="mb-2 text-sm font-medium text-[color:var(--color-text-primary)]">Accent color</p>
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => updateDesign({ primaryColor: c })}
                className={cn("h-8 w-8 rounded-lg border-2 cursor-pointer transition-transform duration-100", state.design.primaryColor === c ? "border-[color:var(--color-text-primary)] scale-110" : "border-transparent hover:scale-105")}
                style={{ backgroundColor: c }}
                aria-label={`Color ${c}`}
              />
            ))}
            <input
              type="color"
              value={state.design.primaryColor}
              onChange={(e) => updateDesign({ primaryColor: e.target.value })}
              className="h-8 w-8 cursor-pointer rounded-lg border border-[color:var(--color-border)] p-0.5"
              aria-label="Custom color"
            />
          </div>
        </div>

        {(state.type === "WHEEL" || state.type === "SCRATCH_CARD") && (
          <div className="flex flex-col gap-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-4">
            <p className="text-sm font-medium text-[color:var(--color-text-primary)]">Reward</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-[color:var(--color-text-secondary)]">Reward label</label>
                <input
                  type="text"
                  value={state.reward.label}
                  onChange={(e) => update({ reward: { ...state.reward, label: e.target.value } })}
                  placeholder="e.g. 10% Off"
                  className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/20 transition-colors duration-150"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[color:var(--color-text-secondary)]">Coupon code (optional)</label>
                <input
                  type="text"
                  value={state.reward.couponCode}
                  onChange={(e) => update({ reward: { ...state.reward, couponCode: e.target.value } })}
                  placeholder="e.g. SUMMER10"
                  className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm font-mono outline-none focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/20 transition-colors duration-150"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="lg:sticky lg:top-6 self-start">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[color:var(--color-text-secondary)]">Preview</p>
        <PopupPreview state={state} />
      </div>
    </div>
  );
}

// ─── Step 3: Form fields ──────────────────────────────────────────────────────

const AVAILABLE_FIELDS = ["email", "name", "phone", "company"];

function Step3FormFields({ state, update }: { state: WizardState; update: (s: Partial<WizardState>) => void }) {
  function toggleField(f: string) {
    const current = state.formFields;
    if (current.includes(f)) {
      if (current.length === 1) return; // keep at least one
      update({ formFields: current.filter((x) => x !== f) });
    } else {
      update({ formFields: [...current, f] });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)]">Form fields</h2>
        <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">Choose what information to collect. Email is required.</p>
      </div>
      <div className="flex flex-col gap-2">
        {AVAILABLE_FIELDS.map((f) => {
          const checked = state.formFields.includes(f);
          const required = f === "email";
          return (
            <label
              key={f}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition-colors duration-150",
                checked ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary-light)]" : "border-[color:var(--color-border)] hover:border-[color:var(--color-primary)]/40",
              )}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={required}
                onChange={() => !required && toggleField(f)}
                className="accent-[color:var(--color-primary)] h-4 w-4 rounded"
              />
              <div>
                <p className="text-sm font-medium capitalize text-[color:var(--color-text-primary)]">{f}</p>
                {required && <p className="text-xs text-[color:var(--color-text-secondary)]">Required</p>}
              </div>
            </label>
          );
        })}
      </div>
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[color:var(--color-text-secondary)]">Preview</p>
        <PopupPreview state={state} />
      </div>
    </div>
  );
}

// ─── Step 4: Targeting + triggers ─────────────────────────────────────────────

const TRIGGERS = [
  { value: "time_delay" as TriggerType, label: "Time delay", description: "Show after X seconds on the page" },
  { value: "exit_intent" as TriggerType, label: "Exit intent", description: "Show when the user moves to leave" },
  { value: "scroll_depth" as TriggerType, label: "Scroll depth", description: "Show after scrolling 50% down" },
];

const DEVICES: { value: DeviceTarget; label: string }[] = [
  { value: "all", label: "All devices" },
  { value: "mobile", label: "Mobile only" },
  { value: "desktop", label: "Desktop only" },
];

function Step4Targeting({ state, update }: { state: WizardState; update: (s: Partial<WizardState>) => void }) {
  function updateTarget(t: Partial<WizardState["targeting"]>) {
    update({ targeting: { ...state.targeting, ...t } });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)]">Targeting and triggers</h2>
        <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">Control when and where the popup appears.</p>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-[color:var(--color-text-primary)]">Trigger</p>
        <div className="flex flex-col gap-2">
          {TRIGGERS.map((t) => {
            const active = state.targeting.trigger === t.value;
            return (
              <label
                key={t.value}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition-colors duration-150",
                  active ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary-light)]" : "border-[color:var(--color-border)] hover:border-[color:var(--color-primary)]/40",
                )}
              >
                <input
                  type="radio"
                  name="trigger"
                  checked={active}
                  onChange={() => updateTarget({ trigger: t.value })}
                  className="accent-[color:var(--color-primary)] h-4 w-4"
                />
                <div>
                  <p className="text-sm font-medium text-[color:var(--color-text-primary)]">{t.label}</p>
                  <p className="text-xs text-[color:var(--color-text-secondary)]">{t.description}</p>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {state.targeting.trigger === "time_delay" && (
        <div>
          <label htmlFor="delay-seconds" className="mb-1.5 block text-sm font-medium text-[color:var(--color-text-primary)]">
            Delay (seconds)
          </label>
          <input
            id="delay-seconds"
            type="number"
            min={0}
            max={60}
            value={state.targeting.delaySeconds}
            onChange={(e) => updateTarget({ delaySeconds: parseInt(e.target.value) || 0 })}
            className="w-32 rounded-lg border border-[color:var(--color-border)] px-3 py-2.5 text-sm tabular-nums outline-none focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/20 transition-colors duration-150"
          />
        </div>
      )}

      <div>
        <p className="mb-2 text-sm font-medium text-[color:var(--color-text-primary)]">Devices</p>
        <div className="flex flex-wrap gap-2">
          {DEVICES.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => updateTarget({ device: d.value })}
              className={cn(
                "rounded-lg border px-4 py-2 text-sm font-medium transition-colors duration-150 cursor-pointer",
                state.targeting.device === d.value
                  ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary-light)] text-[color:var(--color-primary)]"
                  : "border-[color:var(--color-border)] text-[color:var(--color-text-secondary)] hover:border-[color:var(--color-primary)]/40",
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="url-pattern" className="mb-1.5 block text-sm font-medium text-[color:var(--color-text-primary)]">
          URL rules <span className="font-normal text-[color:var(--color-text-secondary)]">(optional)</span>
        </label>
        <input
          id="url-pattern"
          type="text"
          value={state.targeting.urlPattern}
          onChange={(e) => updateTarget({ urlPattern: e.target.value })}
          placeholder="e.g. /products/ or yourstore.com/sale"
          className="w-full rounded-lg border border-[color:var(--color-border)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/20 transition-colors duration-150"
        />
        <p className="mt-1 text-xs text-[color:var(--color-text-secondary)]">Leave blank to show on all pages.</p>
      </div>
    </div>
  );
}

// ─── Step 5: Review + publish ─────────────────────────────────────────────────

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-[color:var(--color-border)] last:border-0">
      <span className="text-sm text-[color:var(--color-text-secondary)] shrink-0 w-28">{label}</span>
      <span className="text-sm text-[color:var(--color-text-primary)] font-medium text-right">{value}</span>
    </div>
  );
}

function Step5Review({ state }: { state: WizardState }) {
  const triggerLabels: Record<TriggerType, string> = {
    exit_intent: "Exit intent",
    time_delay: `${state.targeting.delaySeconds}s delay`,
    scroll_depth: "50% scroll",
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-[color:var(--color-text-primary)]">Review and publish</h2>
        <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">Confirm your campaign settings before going live.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[color:var(--color-text-secondary)]">Campaign</p>
          <ReviewRow label="Name" value={state.name || "Untitled"} />
          <ReviewRow label="Type" value={{ FORM: "Lead form", WHEEL: "Spin to win", SCRATCH_CARD: "Scratch card" }[state.type]} />
          <ReviewRow label="Fields" value={state.formFields.join(", ")} />
        </div>
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[color:var(--color-text-secondary)]">Targeting</p>
          <ReviewRow label="Trigger" value={triggerLabels[state.targeting.trigger]} />
          <ReviewRow label="Devices" value={{ all: "All devices", mobile: "Mobile only", desktop: "Desktop only" }[state.targeting.device]} />
          <ReviewRow label="URL rules" value={state.targeting.urlPattern || "All pages"} />
        </div>
      </div>

      <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[color:var(--color-text-secondary)]">Copy preview</p>
        <ReviewRow label="Headline" value={state.design.headline} />
        <ReviewRow label="Body" value={state.design.body} />
        <ReviewRow label="CTA" value={state.design.ctaText} />
      </div>

      <div className="flex items-center gap-3 rounded-2xl border border-[color:var(--color-success-bg)] bg-[color:var(--color-success-bg)] px-4 py-3">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3 8l3.5 3.5L13 4.5" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="text-sm text-[color:var(--color-success)]">Ready to publish. The campaign will go live immediately.</p>
      </div>
    </div>
  );
}

// ─── Wizard shell ─────────────────────────────────────────────────────────────

export default function NewCampaignPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [state, setState] = useState<WizardState>({ ...defaultState });
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  function update(partial: Partial<WizardState>) {
    setState((s) => ({ ...s, ...partial }));
  }

  function canAdvance() {
    if (step === 1) return !!state.name.trim();
    return true;
  }

  async function publish() {
    setPublishing(true);
    setPublishError(null);
    try {
      const payload = {
        name: state.name,
        type: state.type,
        design: state.design,
        formFields: state.formFields,
        targeting: state.targeting,
        rewards: state.type !== "FORM"
          ? [{ label: state.reward.label, type: state.reward.type, couponCode: state.reward.couponCode || null, weight: 1 }]
          : [],
      };

      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Publish failed");
      }

      const created = await res.json().catch(() => ({}));
      campaignCreated({
        campaignId: created.id ?? "unknown",
        campaignType: state.type,
        name: state.name,
      });

      router.push("/campaigns");
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setPublishing(false);
    }
  }

  const stepComponents: Record<number, React.ReactNode> = {
    1: <Step1TypeSelect state={state} update={update} />,
    2: <Step2Design state={state} update={update} />,
    3: <Step3FormFields state={state} update={update} />,
    4: <Step4Targeting state={state} update={update} />,
    5: <Step5Review state={state} />,
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="New campaign"
        backHref="/campaigns"
        backLabel="Back to campaigns"
      />

      <div className="flex justify-center">
        <StepBar current={step} />
      </div>

      {/* Double-Bezel wizard container */}
      <div className="mx-auto w-full max-w-3xl">
        <div className="rounded-[1.375rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-1.5 shadow-sm">
          <div
            className="rounded-[1rem] bg-[color:var(--color-surface)] p-6 animate-page-enter"
            style={{ boxShadow: "inset 0 1px 1px rgba(255,255,255,0.95)" }}
          >
            {stepComponents[step]}
          </div>
        </div>
      </div>

      {publishError && (
        <div className="mx-auto w-full max-w-3xl rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-600">{publishError}</p>
        </div>
      )}

      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
        <Button
          variant="secondary"
          onClick={() => (step > 1 ? setStep(step - 1) : router.push("/campaigns"))}
        >
          {step === 1 ? "Cancel" : "Back"}
        </Button>
        {step < STEPS.length ? (
          <Button
            onClick={() => setStep(step + 1)}
            className={!canAdvance() ? "opacity-50 pointer-events-none" : ""}
          >
            Continue
          </Button>
        ) : (
          <Button
            onClick={publish}
            className={publishing ? "opacity-60 pointer-events-none" : ""}
          >
            {publishing ? "Publishing..." : "Publish campaign"}
          </Button>
        )}
      </div>
    </div>
  );
}
