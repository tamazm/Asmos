"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type CampaignOption = {
  id: string;
  name: string;
  variants: { id: string; name: string }[];
};

// Superadmin-only floating dev panel for testing the bandit/knockout system
// without waiting for real traffic. Only ever mounted when the server has
// already confirmed the current user is a superadmin (see layout.tsx) —
// this component does no auth checking of its own, the API route does.
export function TesterToolkit() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [fetchedCampaigns, setFetchedCampaigns] = useState(false);
  const [campaignId, setCampaignId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [mockCount, setMockCount] = useState(500);
  const [busy, setBusy] = useState<"inject" | "knockout" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load once the panel is first opened, not on mount — this floats on
  // every dashboard page, no reason to fetch campaigns before it's used.
  // Every setState call here lives inside the fetch's own callbacks rather
  // than synchronously in the effect body itself.
  useEffect(() => {
    if (!open || fetchedCampaigns) return;
    fetch("/api/campaigns")
      .then((r) => r.json())
      .then((data: { campaigns?: CampaignOption[] }) => {
        const list = data.campaigns ?? [];
        setCampaigns(list);
        if (list.length > 0) {
          setCampaignId(list[0].id);
          setVariantId(list[0].variants[0]?.id ?? "");
        }
      })
      .catch(() => setError("Failed to load campaigns"))
      .finally(() => setFetchedCampaigns(true));
  }, [open, fetchedCampaigns]);

  const loadingCampaigns = open && !fetchedCampaigns;

  const selectedCampaign = campaigns.find((c) => c.id === campaignId);

  function handleCampaignChange(id: string) {
    setCampaignId(id);
    const campaign = campaigns.find((c) => c.id === id);
    setVariantId(campaign?.variants[0]?.id ?? "");
  }

  async function call(action: "inject" | "trigger_knockout") {
    if (!variantId) {
      setError("Pick a campaign with at least one variant first");
      return;
    }
    setBusy(action === "inject" ? "inject" : "knockout");
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/testing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, variantId, mockCount }),
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
          Campaign
        </label>
        {loadingCampaigns ? (
          <p className="text-xs text-[color:var(--color-text-secondary)]">Loading campaigns…</p>
        ) : campaigns.length === 0 ? (
          <p className="text-xs text-[color:var(--color-text-secondary)]">No campaigns on this account yet.</p>
        ) : (
          <select
            value={campaignId}
            onChange={(e) => handleCampaignChange(e.target.value)}
            className="rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)] bg-[color:var(--color-surface)]"
          >
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {selectedCampaign && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[color:var(--color-text-secondary)]">
            Variant
          </label>
          {selectedCampaign.variants.length === 0 ? (
            <p className="text-xs text-[color:var(--color-text-secondary)]">This campaign has no variants yet.</p>
          ) : (
            <select
              value={variantId}
              onChange={(e) => setVariantId(e.target.value)}
              className="rounded-lg border border-[color:var(--color-border)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)] bg-[color:var(--color-surface)]"
            >
              {selectedCampaign.variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

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
          disabled={busy !== null || !variantId}
          className="rounded-lg bg-[color:var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy === "inject" ? "Injecting…" : "Inject mock data"}
        </button>
        <button
          type="button"
          onClick={() => call("trigger_knockout")}
          disabled={busy !== null || !variantId}
          className="rounded-lg border border-[color:var(--color-border)] px-4 py-2 text-sm font-semibold text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-surface-sunken)] disabled:opacity-60"
        >
          {busy === "knockout" ? "Triggering…" : "Fast forward / Trigger knockout"}
        </button>
      </div>
    </div>
  );
}
