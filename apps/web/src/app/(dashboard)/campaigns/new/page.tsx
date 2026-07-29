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
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors duration-200",
                  done
                    ? "bg-[color:var(--color-primary)] text-white"
                    : active
                    ? "bg-[color:var(--color-primary)] text-white"
                    : "bg-[color:var(--color-neutral-badge)] text-[color:var(--color-text-secondary)]",
                )}
              >
                {done ? (
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M3.5 8L6.5 11L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  step.id
                )}
              </div>
              <span className={cn("hidden text-xs sm:block", active ? "font-medium text-[color:var(--color-text-primary)]" : "text-[color:var(--color-text-secondary)]")}>
                {step.label}
              </span>
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
                "flex flex-col items-start gap-3 rounded-2xl border p-5 text-left transition-all duration-150 cursor-pointer",
                active
                  ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary-light)] shadow-sm"
                  : "border-[color:var(--color-border)] bg-[color:var(--color-surface)] hover:border-[color:var(--color-primary)]/40",
              )}
              aria-pressed={active}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[color:var(--color-primary-light)]">
                {opt.icon}
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

function PopupPreview({ state }: { state: WizardState }) {
  return (
    <div className="rounded-2xl border border-[color:var(--color-border)] bg-[#f0f4ff] p-4 flex items-end justify-center min-h-[280px]">
      <div className="w-full max-w-[280px] rounded-2xl bg-white shadow-lg overflow-hidden">
        <div className="h-1.5 w-full" style={{ backgroundColor: state.design.primaryColor }} />
        <div className="p-4">
          <p className="text-sm font-bold text-[color:var(--color-text-primary)] leading-tight mb-1">{state.design.headline || "Your headline"}</p>
          <p className="text-xs text-[color:var(--color-text-secondary)] leading-relaxed mb-3">{state.design.body || "Your body text"}</p>
          {state.type !== "FORM" && (
            <div className="mb-3 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-3 text-center">
              <p className="text-xs text-[color:var(--color-text-secondary)]">
                {state.type === "WHEEL" ? "Spin wheel" : "Scratch card"} preview
              </p>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            {state.formFields.map((f) => (
              <div key={f} className="h-7 rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] px-2 flex items-center">
                <span className="text-[10px] text-[color:var(--color-text-secondary)] capitalize">{f}</span>
              </div>
            ))}
          </div>
          <button
            className="mt-2 w-full rounded-lg py-2 text-xs font-semibold text-white"
            style={{ backgroundColor: state.design.primaryColor }}
            tabIndex={-1}
          >
            {state.design.ctaText || "Submit"}
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
          <div className="flex flex-col gap-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-4">
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
                "flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-all duration-150",
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
                  "flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-all duration-150",
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
                "rounded-lg border px-4 py-2 text-sm font-medium transition-all duration-150 cursor-pointer",
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

      <div className="flex items-center gap-3 rounded-xl border border-[color:var(--color-success-bg)] bg-[color:var(--color-success-bg)] px-4 py-3">
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

      <div className="mx-auto w-full max-w-3xl rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 shadow-sm animate-page-enter">
        {stepComponents[step]}
      </div>

      {publishError && (
        <div className="mx-auto w-full max-w-3xl rounded-xl border border-red-200 bg-red-50 px-4 py-3">
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
