"use client";

import { useState } from "react";
import { Confetti } from "@/components/ui/Confetti";
import { Button } from "@/components/ui/Button";

export function RequestIntegrationCard({
  prefilledText = "",
}: {
  prefilledText?: string;
}) {
  const [text, setText] = useState(prefilledText);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!text.trim()) {
      setError("Tell us which tool you'd like to connect.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Something went wrong. Please try again.");
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 shadow-xs transition-colors">
      {submitted && <Confetti />}

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color:var(--color-primary)]/10 text-[color:var(--color-primary)]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="16" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-[color:var(--color-text-primary)]">Don&apos;t see your tool?</h4>
            <p className="text-xs text-[color:var(--color-text-secondary)]">Request an integration and our team will prioritize it.</p>
          </div>
        </div>
      </div>

      {submitted ? (
        <div className="flex flex-col items-start gap-1 rounded-xl bg-[color:var(--color-success-bg)] px-4 py-3">
          <p className="text-xs font-semibold text-[color:var(--color-success)]">🎉 Thank you for the request!</p>
          <p className="text-xs text-[color:var(--color-text-secondary)]">
            Our engineering team reviews integration requests weekly.{" "}
            <button
              type="button"
              onClick={() => {
                setSubmitted(false);
                setText("");
              }}
              className="font-medium text-[color:var(--color-primary)] hover:underline cursor-pointer"
            >
              Request another
            </button>
          </p>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !submitting) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="e.g. Attentive, Salesforce, Segment, ActiveCampaign..."
            className="flex-1 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] px-3.5 py-2 text-xs text-[color:var(--color-text-primary)] outline-none focus:border-[color:var(--color-primary)] focus:bg-[color:var(--color-surface)] transition-colors placeholder:text-[color:var(--color-text-secondary)]/60"
          />
          <Button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="h-8.5 px-4 text-xs shrink-0"
          >
            {submitting ? "Sending…" : "Submit Request"}
          </Button>
          {error && <span className="text-xs text-red-500">{error}</span>}
        </div>
      )}
    </div>
  );
}
