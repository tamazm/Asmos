"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { type VariantStat } from "./VariantManager";

// ─── Generation script ────────────────────────────────────────────────────────

const GENERATION_STEPS = [
  { label: "Analyzing top performers", duration: 500 },
  { label: "Identifying winning patterns", duration: 400 },
  { label: "Writing headline", duration: 600 },
  { label: "Crafting offer copy", duration: 450 },
  { label: "Optimizing CTA", duration: 350 },
  { label: "Finalizing variant", duration: 300 },
];

function generateVariantCopy(seed: string): { headline: string; body: string; ctaText: string } {
  const headlines = [
    "Unlock Your Exclusive Deal Today",
    "Get 20% Off — Limited Time Only",
    "Join 10,000+ Happy Customers",
    "Your Free Gift is Waiting",
    "Don't Miss This Special Offer",
    "Save Big Before It's Gone",
  ];
  const bodies = [
    "Drop your email to claim your reward before the offer expires.",
    "Sign up now and we'll send your discount code instantly.",
    "Join our community and get exclusive access to member-only deals.",
    "Enter your details to unlock your personalized offer.",
  ];
  const ctas = ["Claim My Deal", "Get My Discount", "Yes, Send It", "Unlock Offer", "Grab It Now"];

  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = ((hash * 31) + seed.charCodeAt(i)) >>> 0;

  return {
    headline: headlines[hash % headlines.length],
    body: bodies[hash % bodies.length],
    ctaText: ctas[Math.floor(hash / 3) % ctas.length],
  };
}

// ─── Mini popup preview ───────────────────────────────────────────────────────

function MiniPreview({
  headline,
  body,
  ctaText,
  color,
}: {
  headline: string;
  body: string;
  ctaText: string;
  color: string;
}) {
  return (
    <div className="relative w-full max-w-[240px] rounded-xl border border-[color:var(--color-border)] bg-white shadow-lg shadow-black/8 overflow-hidden">
      {/* Top color stripe */}
      <div className="h-1.5 w-full" style={{ backgroundColor: color }} />

      <div className="flex flex-col gap-3 p-4">
        <div className="flex h-6 w-6 items-center justify-center rounded-full text-white text-[10px] font-bold" style={{ backgroundColor: color }}>
          A
        </div>

        <div>
          <div className="text-sm font-semibold leading-snug text-gray-900 min-h-[2.5rem]">
            {headline || <span className="text-gray-300">Headline loading...</span>}
          </div>
          <div className="mt-1.5 text-[11px] leading-relaxed text-gray-500 min-h-[2rem]">
            {body || <span className="text-gray-200">Copy loading...</span>}
          </div>
        </div>

        <div className="h-px w-full bg-gray-100" />

        <div className="flex flex-col gap-1.5">
          <div className="h-6 w-full rounded border border-gray-200 bg-gray-50" />
          <button
            className="w-full rounded-lg py-1.5 text-[11px] font-semibold text-white transition-opacity"
            style={{ backgroundColor: color }}
            tabIndex={-1}
          >
            {ctaText || "..."}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Generation progress ──────────────────────────────────────────────────────

function GenerationProgress({
  activeStep,
  completedSteps,
}: {
  activeStep: number;
  completedSteps: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {GENERATION_STEPS.map((step, i) => {
        const isActive = i === activeStep;
        const isDone = i < completedSteps;

        return (
          <div key={step.label} className="flex items-center gap-2.5">
            <div className="relative flex h-4 w-4 shrink-0 items-center justify-center">
              {isDone ? (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-emerald-500">
                  <circle cx="7" cy="7" r="7" fill="currentColor" fillOpacity={0.12} />
                  <path d="M4 7l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : isActive ? (
                <span className="h-2 w-2 rounded-full bg-[color:var(--color-primary)] animate-pulse" />
              ) : (
                <span className="h-2 w-2 rounded-full bg-[color:var(--color-border)]" />
              )}
            </div>
            <span
              className={`text-xs transition-colors duration-200 ${
                isDone
                  ? "text-emerald-600"
                  : isActive
                    ? "font-medium text-[color:var(--color-text-primary)]"
                    : "text-[color:var(--color-text-secondary)]"
              }`}
            >
              {step.label}
              {isActive && (
                <span className="ml-1 animate-pulse">...</span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── New variant card ─────────────────────────────────────────────────────────

function NewVariantCard({
  name,
  headline,
  body,
  ctaText,
  color,
  onConfirm,
  onDiscard,
  busy,
}: {
  name: string;
  headline: string;
  body: string;
  ctaText: string;
  color: string;
  onConfirm: () => void;
  onDiscard: () => void;
  busy: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[color:var(--color-primary)] bg-[color:var(--color-surface)] p-5 ring-1 ring-[color:var(--color-primary)]/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="h-8 w-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
            style={{ backgroundColor: color }}
          >
            {name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">{name}</p>
            <p className="text-xs text-[color:var(--color-text-secondary)]">Ready to add</p>
          </div>
        </div>
        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
          Generated
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3 text-xs">
        <div className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-2.5">
          <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-[color:var(--color-text-secondary)]">Headline</p>
          <p className="text-[color:var(--color-text-primary)] leading-snug">{headline}</p>
        </div>
        <div className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-2.5">
          <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-[color:var(--color-text-secondary)]">Offer</p>
          <p className="text-[color:var(--color-text-primary)] leading-snug">{body}</p>
        </div>
        <div className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-2.5">
          <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-[color:var(--color-text-secondary)]">CTA</p>
          <p className="text-[color:var(--color-text-primary)] leading-snug">{ctaText}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-[color:var(--color-border)] pt-3">
        <Button onClick={onConfirm} disabled={busy} className={busy ? "opacity-60" : ""}>
          {busy ? "Adding to bracket..." : "Add to bracket"}
        </Button>
        <Button variant="secondary" onClick={onDiscard} disabled={busy}>
          Discard
        </Button>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

type GenerationState = "idle" | "generating" | "done" | "submitting" | "success" | "error";

type GeneratedCopy = {
  headline: string;
  body: string;
  ctaText: string;
  name: string;
  color: string;
};

const VARIANT_COLORS = ["#2563EB", "#059669", "#D97706", "#DC2626", "#7C3AED"];

export function AddVariantPanel({
  campaignId,
  existingCount,
  onVariantAdded,
}: {
  campaignId: string;
  existingCount: number;
  onVariantAdded?: (variant: VariantStat) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<GenerationState>("idle");
  const [error, setError] = useState<string | null>(null);

  // Form fields — optional manual overrides
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [ctaText, setCtaText] = useState("");

  // Generation progress
  const [activeStep, setActiveStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState(0);

  // Live stream text shown during generation
  const [streamText, setStreamText] = useState("");
  const streamRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Final generated copy
  const [generated, setGenerated] = useState<GeneratedCopy | null>(null);

  const nextVariantIndex = existingCount;
  const nextVariantName = ["Variant B", "Variant C", "Variant D", "Variant E"][Math.min(nextVariantIndex - 1, 3)] ?? `Variant ${nextVariantIndex + 1}`;
  const variantColor = VARIANT_COLORS[(nextVariantIndex) % VARIANT_COLORS.length];

  // Stream text character-by-character
  function streamIn(text: string, onDone: () => void) {
    let i = 0;
    setStreamText("");
    function tick() {
      if (i <= text.length) {
        setStreamText(text.slice(0, i));
        i++;
        streamRef.current = setTimeout(tick, 22);
      } else {
        onDone();
      }
    }
    tick();
  }

  function clearStream() {
    if (streamRef.current) clearTimeout(streamRef.current);
    setStreamText("");
  }

  async function runGeneration() {
    setState("generating");
    setActiveStep(0);
    setCompletedSteps(0);
    setGenerated(null);
    clearStream();

    const seed = campaignId + Date.now().toString();
    const copy = generateVariantCopy(seed);

    // Step through the generation steps with staggered delays
    let cumulativeDelay = 0;
    const stepTimers: ReturnType<typeof setTimeout>[] = [];

    for (let i = 0; i < GENERATION_STEPS.length; i++) {
      const stepDelay = cumulativeDelay;
      const step = GENERATION_STEPS[i];
      cumulativeDelay += step.duration;

      stepTimers.push(
        setTimeout(() => {
          setActiveStep(i);
          if (i === 2) {
            // Stream headline text when writing headline step
            streamIn(`Headline: "${copy.headline}"`, () => {});
          } else if (i === 4) {
            // Stream CTA when optimizing CTA step
            streamIn(`CTA: "${copy.ctaText}"`, () => {});
          }
        }, stepDelay),
      );

      stepTimers.push(
        setTimeout(() => {
          setCompletedSteps(i + 1);
        }, stepDelay + step.duration - 80),
      );
    }

    // Finish: show generated variant
    setTimeout(() => {
      clearStream();
      const finalHeadline = headline.trim() || copy.headline;
      const finalBody = body.trim() || copy.body;
      const finalCta = ctaText.trim() || copy.ctaText;

      setGenerated({
        headline: finalHeadline,
        body: finalBody,
        ctaText: finalCta,
        name: nextVariantName,
        color: variantColor,
      });
      setState("done");
    }, cumulativeDelay + 100);

    return () => stepTimers.forEach(clearTimeout);
  }

  async function submitVariant() {
    if (!generated) return;
    setState("submitting");
    setError(null);

    try {
      const res = await fetch(`/api/campaigns/${campaignId}/variants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: generated.name,
          design: {
            headline: generated.headline,
            body: generated.body,
            ctaText: generated.ctaText,
            primaryColor: generated.color,
          },
        }),
      });

      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error((b as { error?: string }).error ?? "Could not add variant");
      }

      const data = (await res.json()) as { variant: { id: string; name: string; trafficPercent: number } };

      // Optimistic new variant stat
      const newStat: VariantStat = {
        id: data.variant.id,
        name: data.variant.name,
        isControl: false,
        isWinner: false,
        trafficPercent: data.variant.trafficPercent,
        impressions: 0,
        submissions: 0,
        conversionRate: 0,
        confidenceVsControl: null,
        headline: generated.headline,
        body: generated.body,
        primaryColor: generated.color,
        ctaText: generated.ctaText,
      };

      onVariantAdded?.(newStat);
      setState("success");

      // Reset panel after brief success display
      setTimeout(() => {
        setOpen(false);
        setState("idle");
        setHeadline("");
        setBody("");
        setCtaText("");
        setGenerated(null);
        router.refresh();
      }, 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setState("error");
    }
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    runGeneration();
  }

  function handleDiscard() {
    clearStream();
    setState("idle");
    setGenerated(null);
    setCompletedSteps(0);
    setActiveStep(0);
  }

  function handleClose() {
    if (state === "generating" || state === "submitting") return;
    handleDiscard();
    setOpen(false);
    setHeadline("");
    setBody("");
    setCtaText("");
    setError(null);
  }

  const isGenerating = state === "generating";
  const isDone = state === "done";
  const isSubmitting = state === "submitting";
  const isSuccess = state === "success";
  const isError = state === "error";
  const canClose = !isGenerating && !isSubmitting;

  // Live preview copy during generation
  const previewHeadline = isGenerating && streamText.startsWith("Headline:")
    ? streamText.replace(/^Headline: "?/, "").replace(/"$/, "")
    : generated?.headline ?? headline;
  const previewBody = generated?.body ?? body;
  const previewCta = isGenerating && streamText.startsWith("CTA:")
    ? streamText.replace(/^CTA: "?/, "").replace(/"$/, "")
    : generated?.ctaText ?? ctaText;

  return (
    <div className="flex flex-col gap-4">
      {/* Trigger button */}
      {!open && (
        <div className="flex items-center gap-3">
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2 text-sm font-medium text-[color:var(--color-text-primary)] transition-colors duration-150 hover:bg-[color:var(--color-surface-sunken)] active:scale-[0.98]"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            Add variant
          </button>
          <p className="text-xs text-[color:var(--color-text-secondary)]">
            Add challengers to the bracket — the bandit auto-routes traffic.
          </p>
        </div>
      )}

      {/* Inline panel */}
      {open && (
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] overflow-hidden">
          {/* Panel header */}
          <div className="flex items-center justify-between border-b border-[color:var(--color-border)] px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <div
                className="h-6 w-6 rounded-md flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                style={{ backgroundColor: variantColor }}
              >
                {nextVariantName.slice(0, 1)}
              </div>
              <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">
                New challenger: {nextVariantName}
              </p>
            </div>
            {canClose && (
              <button
                onClick={handleClose}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[color:var(--color-text-secondary)] hover:bg-[color:var(--color-surface-sunken)] transition-colors duration-150"
                aria-label="Close"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>

          {/* Panel body */}
          <div className="p-5">
            {/* Success state */}
            {isSuccess && (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-emerald-600 shrink-0">
                  <circle cx="8" cy="8" r="8" fill="currentColor" fillOpacity={0.15} />
                  <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p className="text-sm font-medium text-emerald-700">Variant added to bracket. Syncing...</p>
              </div>
            )}

            {/* Error state */}
            {isError && error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
                <p className="text-sm text-red-600">{error}</p>
                <button
                  onClick={() => setState("idle")}
                  className="mt-1 text-xs text-red-500 underline hover:no-underline"
                >
                  Try again
                </button>
              </div>
            )}

            {/* Idle/Form state */}
            {(state === "idle" || state === "error") && (
              <form onSubmit={handleManualSubmit} className="flex flex-col gap-4">
                <p className="text-sm text-[color:var(--color-text-secondary)]">
                  Optionally tweak the copy below, or click Generate to have the AI write it based on your top performers.
                </p>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-[color:var(--color-text-secondary)]">
                      Headline <span className="opacity-60">(optional)</span>
                    </label>
                    <input
                      value={headline}
                      onChange={(e) => setHeadline(e.target.value)}
                      placeholder="e.g. Get 20% Off Today"
                      className="rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/20 transition-colors duration-150 bg-[color:var(--color-surface)]"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-[color:var(--color-text-secondary)]">
                      Offer copy <span className="opacity-60">(optional)</span>
                    </label>
                    <input
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder="e.g. Drop your email to claim"
                      className="rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/20 transition-colors duration-150 bg-[color:var(--color-surface)]"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-[color:var(--color-text-secondary)]">
                      CTA text <span className="opacity-60">(optional)</span>
                    </label>
                    <input
                      value={ctaText}
                      onChange={(e) => setCtaText(e.target.value)}
                      placeholder="e.g. Claim My Deal"
                      className="rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/20 transition-colors duration-150 bg-[color:var(--color-surface)]"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 border-t border-[color:var(--color-border)] pt-3">
                  <Button type="submit">
                    Generate for me
                  </Button>
                  {(headline.trim() || body.trim() || ctaText.trim()) && (
                    <Button
                      variant="secondary"
                      type="button"
                      onClick={() => {
                        // Use manual values directly without AI generation animation
                        setGenerated({
                          headline: headline.trim() || "Your Exclusive Deal",
                          body: body.trim() || "Drop your email to claim your reward.",
                          ctaText: ctaText.trim() || "Claim Now",
                          name: nextVariantName,
                          color: variantColor,
                        });
                        setState("done");
                      }}
                    >
                      Use my copy
                    </Button>
                  )}
                  <Button variant="ghost" type="button" onClick={handleClose}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}

            {/* Generating state */}
            {isGenerating && (
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                {/* Left: progress + stream */}
                <div className="flex flex-1 flex-col gap-4">
                  <GenerationProgress activeStep={activeStep} completedSteps={completedSteps} />

                  {streamText && (
                    <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] px-4 py-3">
                      <p className="font-mono text-xs text-[color:var(--color-text-primary)] leading-relaxed">
                        {streamText}
                        <span className="ml-0.5 inline-block h-3 w-0.5 bg-[color:var(--color-primary)] animate-pulse align-middle" />
                      </p>
                    </div>
                  )}
                </div>

                {/* Right: live preview */}
                <div className="flex flex-col items-start gap-2">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-[color:var(--color-text-secondary)]">
                    Live preview
                  </p>
                  <MiniPreview
                    headline={previewHeadline}
                    body={previewBody}
                    ctaText={previewCta}
                    color={variantColor}
                  />
                </div>
              </div>
            )}

            {/* Done state — show generated variant card */}
            {isDone && generated && !isSuccess && (
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                {/* Variant card */}
                <div className="flex-1">
                  <NewVariantCard
                    name={generated.name}
                    headline={generated.headline}
                    body={generated.body}
                    ctaText={generated.ctaText}
                    color={generated.color}
                    onConfirm={submitVariant}
                    onDiscard={handleDiscard}
                    busy={isSubmitting}
                  />
                </div>

                {/* Preview */}
                <div className="flex flex-col items-start gap-2">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-[color:var(--color-text-secondary)]">
                    Preview
                  </p>
                  <MiniPreview
                    headline={generated.headline}
                    body={generated.body}
                    ctaText={generated.ctaText}
                    color={generated.color}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
