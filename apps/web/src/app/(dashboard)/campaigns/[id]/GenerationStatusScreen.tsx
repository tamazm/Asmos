"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

const POLL_INTERVAL_MS = 3000;

export function GenerationStatusScreen({
  campaignId,
  status,
  lastError,
}: {
  campaignId: string;
  status: "GENERATING" | "FAILED";
  lastError: string | null;
}) {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
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
        }
      } catch {
        // Transient network hiccup — just try again on the next tick.
      }
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [status, campaignId, router]);

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

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-6 py-16 text-center">
      <div
        className="h-10 w-10 animate-spin rounded-full border-[3px] border-[color:var(--color-border)] border-t-[color:var(--color-primary)]"
        aria-hidden="true"
      />
      <div>
        <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">
          Generating your popup…
        </p>
        <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">
          This usually takes under a minute. Feel free to navigate away — we&apos;ll keep working in
          the background and this page will update automatically when it&apos;s ready.
        </p>
      </div>
    </div>
  );
}
