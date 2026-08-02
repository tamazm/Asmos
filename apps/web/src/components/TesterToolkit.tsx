"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Superadmin-only floating dev panel for testing the bandit/knockout system
// without waiting for real traffic. Only ever mounted when the server has
// already confirmed the current user is a superadmin (see layout.tsx) —
// this component does no auth checking of its own, the API route does.
export function TesterToolkit() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [variantId, setVariantId] = useState("");
  const [mockCount, setMockCount] = useState(500);
  const [busy, setBusy] = useState<"inject" | "knockout" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(action: "inject" | "trigger_knockout") {
    if (!variantId.trim()) {
      setError("Enter a Variant ID first");
      return;
    }
    setBusy(action === "inject" ? "inject" : "knockout");
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/testing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, variantId: variantId.trim(), mockCount }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setMessage(
        action === "inject"
          ? `Injected ${data.injectedImpressions} impressions / ${data.injectedSubmissions} conversions.`
          : "Knockout evaluation triggered — check the Knockout Bracket tab in a few seconds.",
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-[color:var(--color-text-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-lg hover:opacity-90"
      >
        🧪 Tester
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 shadow-2xl">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">
          🧪 Tester Toolkit
        </p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <p className="text-xs text-[color:var(--color-text-secondary)]">
        Superadmin only. Skips the real wait for impressions to accumulate.
      </p>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-[color:var(--color-text-secondary)]">
          Variant ID
        </label>
        <input
          value={variantId}
          onChange={(e) => setVariantId(e.target.value)}
          placeholder="cmxxxxxxxxxxxxx"
          className="rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)]"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-[color:var(--color-text-secondary)]">
          Mock count (impressions)
        </label>
        <input
          type="number"
          min={1}
          max={10000}
          value={mockCount}
          onChange={(e) => setMockCount(Number(e.target.value))}
          className="rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)]"
        />
        <p className="text-[11px] text-[color:var(--color-text-secondary)]">
          Injects this many impressions plus ~20% conversions, favoring this variant.
        </p>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {message && <p className="text-xs text-[color:var(--color-primary)]">{message}</p>}

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => call("inject")}
          disabled={busy !== null}
          className="rounded-lg bg-[color:var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy === "inject" ? "Injecting…" : "Inject mock data"}
        </button>
        <button
          type="button"
          onClick={() => call("trigger_knockout")}
          disabled={busy !== null}
          className="rounded-lg border border-[color:var(--color-border)] px-4 py-2 text-sm font-semibold text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-surface-sunken)] disabled:opacity-60"
        >
          {busy === "knockout" ? "Triggering…" : "Fast forward / Trigger knockout"}
        </button>
      </div>
    </div>
  );
}
