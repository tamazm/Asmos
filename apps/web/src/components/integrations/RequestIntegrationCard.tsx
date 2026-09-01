"use client";

import { useState } from "react";
import { Confetti } from "@/components/ui/Confetti";

export function RequestIntegrationCard() {
  const [text, setText] = useState("");
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
    <div className="flex flex-col gap-4 rounded-2xl border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 shadow-sm">
      {submitted && <Confetti />}

      <div className="flex items-center gap-3">
        <div className="shrink-0">
          <svg viewBox="0 0 40 40" width="28" height="28" fill="none">
            <rect width="40" height="40" rx="8" fill="#0EA5E9" />
            <path d="M20 12v16M12 20h16" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">Request an integration</p>
          <p className="text-xs text-[color:var(--color-text-secondary)]">Don&apos;t see the tool you use? Tell us.</p>
        </div>
      </div>

      {submitted ? (
        <div className="flex flex-col items-start gap-1 rounded-xl bg-[color:var(--color-success-bg)] px-4 py-3">
          <p className="text-sm font-medium text-[color:var(--color-success)]">🎉 Thanks for the feedback!</p>
          <p className="text-xs text-[color:var(--color-text-secondary)]">
            We&apos;ll consider adding it. Want to request another?{" "}
            <button
              onClick={() => { setSubmitted(false); setText(""); }}
              className="font-medium text-[color:var(--color-primary)] hover:underline"
            >
              Send another
            </button>
          </p>
        </div>
      ) : (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. Omnisend, Attentive, Google Sheets, our internal CRM…"
            rows={3}
            maxLength={1000}
            className="w-full resize-none rounded-lg border border-[color:var(--color-border)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/20 transition-colors duration-150"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div>
            <button
              onClick={submit}
              disabled={submitting}
              className="rounded-lg border border-[color:var(--color-primary)] bg-[color:var(--color-primary-light)] px-4 py-2 text-sm font-medium text-[color:var(--color-primary)] hover:bg-[color:var(--color-primary)] hover:text-white transition-colors duration-150 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? "Sending…" : "Request integration"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
