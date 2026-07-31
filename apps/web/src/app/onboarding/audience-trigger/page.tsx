"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

// ─── Options ──────────────────────────────────────────────────────────────────

const AUDIENCE_OPTIONS = [
  { value: "all", label: "All visitors" },
  { value: "new", label: "New visitors only" },
  { value: "returning", label: "Returning visitors only" },
  { value: "mobile", label: "Mobile visitors" },
  { value: "desktop", label: "Desktop visitors" },
] as const;

const TRIGGER_OPTIONS = [
  { value: "3s", label: "After 3 seconds" },
  { value: "5s", label: "After 5 seconds" },
  { value: "exit", label: "On exit intent" },
  { value: "scroll50", label: "After scrolling 50%" },
] as const;

type AudienceValue = (typeof AUDIENCE_OPTIONS)[number]["value"];
type TriggerValue = (typeof TRIGGER_OPTIONS)[number]["value"];

// ─── Pill selector ────────────────────────────────────────────────────────────

function PillGroup<T extends string>({
  label,
  hint,
  options,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <p className="mb-1 text-sm font-semibold text-[color:var(--color-text-primary)]">{label}</p>
      {hint && (
        <p className="mb-2.5 text-xs text-[color:var(--color-text-secondary)]">{hint}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              aria-pressed={active}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-medium transition-[border-color,background-color,color] duration-150 cursor-pointer",
                active
                  ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary-light)] text-[color:var(--color-primary)]"
                  : "border-[color:var(--color-border)] text-[color:var(--color-text-secondary)] hover:border-[color:var(--color-primary)]/40 hover:text-[color:var(--color-text-primary)]",
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AudienceTriggerPage() {
  const router = useRouter();
  const [audience, setAudience] = useState<AudienceValue>("all");
  const [trigger, setTrigger] = useState<TriggerValue>("3s");

  function handleContinue() {
    try {
      sessionStorage.setItem(
        "asmos_audience_trigger",
        JSON.stringify({ audience, trigger }),
      );
    } catch {
      // ignore
    }
    router.push("/onboarding/connect-store");
  }

  return (
    <div className="flex flex-col gap-8 animate-page-enter">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-[color:var(--color-text-primary)]">
          Who should see the popup and when?
        </h1>
        <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
          These settings control targeting. You can adjust them later.
        </p>
      </div>

      {/* Divider section: Audience */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--color-text-secondary)]">
            Audience
          </span>
          <div className="flex-1 h-px bg-[color:var(--color-border)]" aria-hidden="true" />
        </div>
        <PillGroup
          label="Show the popup to"
          hint="Choose which visitors will see your popup."
          options={AUDIENCE_OPTIONS}
          value={audience}
          onChange={setAudience}
        />
      </div>

      {/* Divider section: Trigger */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--color-text-secondary)]">
            Trigger
          </span>
          <div className="flex-1 h-px bg-[color:var(--color-border)]" aria-hidden="true" />
        </div>
        <PillGroup
          label="When to show it"
          hint="Pick the moment visitors see your popup for the first time."
          options={TRIGGER_OPTIONS}
          value={trigger}
          onChange={setTrigger}
        />
      </div>

      {/* Summary callout */}
      <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] px-4 py-3">
        <p className="text-xs text-[color:var(--color-text-secondary)] leading-relaxed">
          Your popup will show to{" "}
          <span className="font-semibold text-[color:var(--color-text-primary)]">
            {AUDIENCE_OPTIONS.find((a) => a.value === audience)?.label.toLowerCase()}
          </span>{" "}
          and trigger{" "}
          <span className="font-semibold text-[color:var(--color-text-primary)]">
            {TRIGGER_OPTIONS.find((t) => t.value === trigger)?.label.toLowerCase()}.
          </span>{" "}
          You can change this at any time from the campaign settings.
        </p>
      </div>

      <div className="flex justify-between gap-3 pt-1">
        <Button href="/onboarding/offer-selection" variant="secondary">
          Back
        </Button>
        <Button onClick={handleContinue}>
          Continue
        </Button>
      </div>
    </div>
  );
}
