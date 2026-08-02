"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { campaignCreated } from "@/lib/analytics";

export function DashboardEmptyState() {
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "analyzing" | "generating" | "publishing" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if there's an analysis result in session storage (from the pre-signup flow)
    const stored = sessionStorage.getItem("asmos_analyze_result");
    if (stored) {
      try {
        const analyzeResult = JSON.parse(stored);
        if (analyzeResult && analyzeResult.storeUrl) {
          startAutoGeneration(analyzeResult);
        }
      } catch (e) {
        // invalid JSON
      }
    }
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function startAutoGeneration(analyzeResult: any) {
    setPhase("generating");
    setError(null);

    const name = `${analyzeResult.storeName ?? "My Store"} — Email Capture`;

    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          type: "FORM",
          design: { headline: "", body: "", primaryColor: "", ctaText: "" },
          formFields: [],
          targeting: { trigger: "exit_intent", delaySeconds: null },
          rewards: [],
          status: "GENERATING",
          generationContext: analyzeResult,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to initialize campaign");
      }

      const created = await res.json().catch(() => ({}));
      campaignCreated({
        campaignId: created.campaign?.id ?? "unknown",
        campaignType: "FORM",
        name,
      });

      // Clear the session storage so it doesn't trigger again
      sessionStorage.removeItem("asmos_analyze_result");
      setPhase("done");
      
      // Refresh the router to show the new campaign
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setPhase("error");
    }
  }

  if (phase === "generating" || phase === "publishing" || phase === "done") {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <div
          className="mb-6 h-10 w-10 rounded-full border-2 border-[color:var(--color-primary-light)] border-t-[color:var(--color-primary)]"
          style={{ animation: "spin 0.9s linear infinite" }}
        />
        <h2 className="text-xl font-bold text-[color:var(--color-text-primary)] mb-2">
          AI is designing your popup
        </h2>
        <p className="text-[color:var(--color-text-secondary)] text-sm max-w-sm">
          We are analyzing your store and generating high-converting variants. This process will continue in the background.
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Welcome banner */}
      <div className="rounded-[1.375rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-1.5 shadow-sm">
        <div
          className="rounded-[1rem] bg-[color:var(--color-surface)] px-6 py-6"
          style={{ boxShadow: "inset 0 1px 1px rgba(255,255,255,0.95)" }}
        >
          <div className="flex items-start gap-4">
            <div className="shrink-0 rounded-[1.125rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-1.5">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-[0.625rem] bg-[color:var(--color-primary-light)]"
                style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8)" }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M3 9l9-6 9 6v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="#165DFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M9 22V12h6v10" stroke="#165DFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-[color:var(--color-text-primary)] tracking-tight">
                Welcome to Asmos
              </p>
              <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
                Let&apos;s create your first campaign. Enter your store URL below to start auto-generation.
              </p>
              
              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
                  {error}
                </div>
              )}

              <div className="mt-6 max-w-md">
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setPhase("analyzing");
                    const form = e.target as HTMLFormElement;
                    const input = form.elements.namedItem("url") as HTMLInputElement;
                    let url = input.value.trim();
                    if (!url) return;
                    if (!url.startsWith("http")) url = "https://" + url;
                    
                    try {
                      const res = await fetch(`/api/analyze?url=${encodeURIComponent(url)}`);
                      if (!res.ok) throw new Error("Could not analyze store");
                      const result = await res.json();
                      startAutoGeneration(result);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Failed to analyze");
                      setPhase("idle");
                    }
                  }}
                  className="flex gap-2"
                >
                  <input
                    name="url"
                    type="url"
                    placeholder="yourstore.com"
                    required
                    disabled={phase === "analyzing"}
                    className="flex-1 rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)] focus:ring-2 focus:ring-[color:var(--color-primary)]/20 transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={phase === "analyzing"}
                    className="rounded-lg bg-[color:var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition-[background-color,transform] hover:bg-[color:var(--color-primary-dark)] active:scale-[0.97] disabled:opacity-50"
                  >
                    {phase === "analyzing" ? "Analyzing..." : "Generate Popup"}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
