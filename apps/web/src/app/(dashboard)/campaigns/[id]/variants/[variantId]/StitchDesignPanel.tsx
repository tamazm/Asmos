"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

const POLL_INTERVAL_MS = 3000;

type DesignStatus = "QUEUED" | "GENERATING" | "COMPLETE" | "FAILED";

type Design = {
  id: string;
  prompt: string;
  status: DesignStatus;
  lastError: string | null;
  htmlContent?: string | null;
};

/**
 * AI Design Preview (Google Stitch) - a design *reference* only. Generates a
 * standalone HTML/Tailwind mockup from a free-text prompt for inspiration;
 * never becomes the popup actually served to shoppers (that stays
 * Variant.generatedCode, produced by the schema-driven generator above this
 * panel). See StitchDesign's model comment in schema.prisma.
 */
export function StitchDesignPanel({
  campaignId,
  variantId,
  initialDesign,
}: {
  campaignId: string;
  variantId: string;
  initialDesign: Design | null;
}) {
  const [design, setDesign] = useState<Design | null>(initialDesign);
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const basePath = `/api/campaigns/${campaignId}/variants/${variantId}/stitch-designs`;

  useEffect(() => {
    if (!design || (design.status !== "QUEUED" && design.status !== "GENERATING")) return;

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${basePath}/${design.id}`);
        if (!res.ok) return;
        const { design: updated } = await res.json();
        setDesign(updated);
      } catch {
        // Transient network hiccup - just try again on the next tick.
      }
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when the design's identity/status changes
  }, [design?.id, design?.status]);

  async function generate() {
    if (!prompt.trim()) {
      setSubmitError("Describe the design you want");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(basePath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not start generation");
      setDesign(body.design);
      setPrompt("");
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function retry() {
    if (!design) return;
    setRetrying(true);
    try {
      const res = await fetch(`${basePath}/${design.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retry: true }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not retry generation");
      setDesign(body.design);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 shadow-sm">
      <h2 className="mb-1 text-base font-semibold text-[color:var(--color-text-primary)]">
        AI Design Preview
      </h2>
      <p className="mb-4 text-sm text-[color:var(--color-text-secondary)]">
        Describe a look and get a real AI-generated mockup for inspiration. This is a reference
        design only - it doesn&apos;t change the popup shown to shoppers.
      </p>

      {(!design || design.status === "FAILED") && (
        <div className="flex flex-col gap-3">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. A clean, minimal popup offering 15% off with a soft green accent and a bold headline"
            rows={3}
            className="w-full resize-none rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm text-[color:var(--color-text-primary)] outline-none focus:border-[color:var(--color-primary)]"
          />
          {submitError && <p className="text-sm text-red-600">{submitError}</p>}
          <div className="flex items-center gap-3">
            <Button onClick={generate} disabled={submitting} className={submitting ? "opacity-60" : ""}>
              {submitting ? "Starting…" : "Generate AI Design Preview"}
            </Button>
            {design?.status === "FAILED" && (
              <Button variant="secondary" onClick={retry} disabled={retrying} className={retrying ? "opacity-60" : ""}>
                {retrying ? "Retrying…" : "Retry last prompt"}
              </Button>
            )}
          </div>
          {design?.status === "FAILED" && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {design.lastError ?? "Generation failed"}
            </div>
          )}
        </div>
      )}

      {design && (design.status === "QUEUED" || design.status === "GENERATING") && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] px-6 py-10 text-center">
          <div
            className="h-8 w-8 animate-spin rounded-full border-[3px] border-[color:var(--color-border)] border-t-[color:var(--color-primary)]"
            aria-hidden="true"
          />
          <p className="text-sm font-medium text-[color:var(--color-text-primary)]">
            Designing your mockup…
          </p>
          <p className="max-w-xs text-xs text-[color:var(--color-text-secondary)]">
            AI mockups usually take 1-3 minutes. Feel free to navigate away - this&apos;ll be here
            when you&apos;re back.
          </p>
        </div>
      )}

      {design && design.status === "COMPLETE" && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-[color:var(--color-text-secondary)]">
            Prompt: <span className="italic">{design.prompt}</span>
          </p>
          <img
            src={`/api/stitch-designs/${design.id}/image`}
            alt="AI-generated design mockup"
            className="w-full rounded-xl border border-[color:var(--color-border)]"
          />
          <details
            className="rounded-lg border border-[color:var(--color-border)]"
            onToggle={(e) => setShowSource((e.target as HTMLDetailsElement).open)}
          >
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-[color:var(--color-text-primary)]">
              View HTML source
            </summary>
            {showSource && design.htmlContent && (
              <iframe
                title="Design mockup source"
                sandbox="allow-scripts"
                srcDoc={design.htmlContent}
                className="h-96 w-full rounded-b-lg border-t border-[color:var(--color-border)]"
              />
            )}
          </details>
          <div>
            <Button variant="secondary" onClick={() => setDesign(null)}>
              Generate another design
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
