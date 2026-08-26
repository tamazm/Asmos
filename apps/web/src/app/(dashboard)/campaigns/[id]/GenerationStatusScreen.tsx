"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  CAMPAIGN_GENERATION_STAGES,
  getGenerationStageIndex,
  getGenerationStageInfo,
} from "@/lib/campaignGenerationStages";

const POLL_INTERVAL_MS = 3000;

export function GenerationStatusScreen({
  campaignId,
  status,
  lastError,
  generationStage,
}: {
  campaignId: string;
  status: "GENERATING" | "FAILED";
  lastError: string | null;
  generationStage?: string | null;
}) {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [stage, setStage] = useState<string | null>(generationStage ?? null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (status !== "GENERATING") return;

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/campaigns/${campaignId}`);
        if (!res.ok) return;
        const { campaign } = await res.json();
        if (campaign?.status && campaign.status !== "GENERATING") {
          if (pollRef.current) clearInterval(pollRef.current);
          router.refresh();
          return;
        }
        if (campaign?.generationStage !== undefined) {
          setStage(campaign.generationStage);
        }
      } catch {
        // Transient network hiccup - just try again on the next tick.
      }
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [status, campaignId, router]);

  const stageIndex = getGenerationStageIndex(stage);
  const failedStageInfo = getGenerationStageInfo(stage);

  async function retry() {
    setRetrying(true);
    setRetryError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retry: true }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? "Could not retry generation");
      }
      router.refresh();
    } catch (e) {
      setRetryError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setRetrying(false);
    }
  }

  if (status === "FAILED") {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-red-200 bg-red-50 px-6 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 8v5m0 3h.01M12 3l9 16H3l9-16z" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">Generation failed</p>
          {failedStageInfo && (
            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-red-500">
              Failed while: {failedStageInfo.label}
            </p>
          )}
          {lastError && (
            <p className="mt-1 max-w-md text-sm text-red-600" style={{ textWrap: "pretty" } as React.CSSProperties}>
              {lastError}
            </p>
          )}
        </div>
        {retryError && <p className="text-sm text-red-600">{retryError}</p>}
        <Button onClick={retry} className={retrying ? "opacity-60" : ""}>
          {retrying ? "Retrying…" : "Retry"}
        </Button>
      </div>
    );
  }

  const currentStage = getGenerationStageInfo(stage) ?? CAMPAIGN_GENERATION_STAGES[0];

  return (
    <div className="flex flex-col items-center gap-6 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-6 py-16 text-center">
      <div
        className="h-10 w-10 animate-spin rounded-full border-[3px] border-[color:var(--color-border)] border-t-[color:var(--color-primary)]"
        aria-hidden="true"
      />
      <div>
        <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">
          {currentStage.label}…
        </p>
        <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
          {currentStage.description}
        </p>
      </div>

      <ol className="flex flex-col gap-2.5 w-full max-w-xs text-left">
        {CAMPAIGN_GENERATION_STAGES.map((s, i) => {
          const done = stageIndex >= 0 && i < stageIndex;
          const active = i === Math.max(stageIndex, 0);
          return (
            <li key={s.code} className={["flex items-center gap-3 transition-opacity duration-300", active || done ? "opacity-100" : "opacity-40"].join(" ")}>
              <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center">
                {done ? (
                  <svg className="h-3.5 w-3.5 text-emerald-500" fill="none" viewBox="0 0 16 16" aria-hidden="true">
                    <path stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M3 8l3.5 3.5L13 4.5" />
                  </svg>
                ) : active ? (
                  <span className="h-3 w-3 rounded-full border-2 border-[color:var(--color-primary)] border-t-transparent animate-spin" aria-hidden="true" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-border)]" aria-hidden="true" />
                )}
              </span>
              <span className={["text-sm", active ? "font-medium text-[color:var(--color-text-primary)]" : "text-[color:var(--color-text-secondary)]"].join(" ")}>
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="text-xs text-[color:var(--color-text-secondary)] max-w-xs">
        This usually takes under a minute. Feel free to navigate away - we&apos;ll keep working in
        the background and this page will update automatically when it&apos;s ready.
      </p>
    </div>
  );
}
