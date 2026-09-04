"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatEstimatedCost } from "@/lib/testing/genTiming";
import type { Device, Intent } from "@/lib/testing/trafficSim";

type CampaignOption = {
  id: string;
  name: string;
  variants: { id: string; name: string }[];
};

type Tab = "inject" | "traffic" | "diversity" | "timing";

// Device / intent mixes are flavor (they nudge conversion + land in event
// details), so the UI offers a few named profiles instead of raw sliders.
const DEVICE_PROFILES: Record<string, Record<Device, number>> = {
  "Mobile-heavy": { mobile: 70, desktop: 25, tablet: 5 },
  Balanced: { mobile: 50, desktop: 45, tablet: 5 },
  "Desktop-heavy": { mobile: 30, desktop: 65, tablet: 5 },
};
const INTENT_PROFILES: Record<string, Record<Intent, number>> = {
  "Mostly browsing": { browsing: 75, high_intent: 15, exit: 10 },
  Mixed: { browsing: 55, high_intent: 30, exit: 15 },
  "High intent": { browsing: 35, high_intent: 50, exit: 15 },
};

// Superadmin-only floating dev panel. Only ever mounted when the server has
// already confirmed the current user is a superadmin (see layout.tsx) - this
// component does no auth checking of its own, the API route does.
export function TesterToolkit() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("traffic");
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [fetchedCampaigns, setFetchedCampaigns] = useState(false);
  const [campaignId, setCampaignId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);

  // Inject (legacy)
  const [mockCount, setMockCount] = useState(500);

  // Traffic sim
  const [volume, setVolume] = useState(2000);
  const [baseCvrPct, setBaseCvrPct] = useState(4);
  const [winnerLiftPct, setWinnerLiftPct] = useState(50);
  const [fastDismissPct, setFastDismissPct] = useState(20);
  const [waves, setWaves] = useState(5);
  const [deviceProfile, setDeviceProfile] = useState("Mobile-heavy");
  const [intentProfile, setIntentProfile] = useState("Mixed");

  // Diversity
  const [diversityN, setDiversityN] = useState(100);
  const [aiSampleCount, setAiSampleCount] = useState(0);

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

  async function call(label: string, payload: Record<string, unknown>) {
    setBusy(label);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/testing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setResult(data);
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

  const tabs: { id: Tab; label: string }[] = [
    { id: "traffic", label: "Traffic" },
    { id: "diversity", label: "Diversity" },
    { id: "timing", label: "Timing" },
    { id: "inject", label: "Inject" },
  ];

  return (
    <div className="fixed bottom-4 right-4 z-50 flex max-h-[80vh] w-96 flex-col gap-3 overflow-y-auto rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 shadow-2xl">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">🧪 Tester Toolkit</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <div className="flex gap-1 rounded-lg bg-[color:var(--color-surface-sunken)] p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              setResult(null);
              setError(null);
            }}
            className={`flex-1 rounded-md px-2 py-1 text-xs font-medium ${
              tab === t.id
                ? "bg-[color:var(--color-surface)] text-[color:var(--color-text-primary)] shadow-sm"
                : "text-[color:var(--color-text-secondary)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Campaign selector — shared by every tab except diversity's synthetic mode */}
      {tab !== "timing" && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[color:var(--color-text-secondary)]">Campaign</label>
          {loadingCampaigns ? (
            <p className="text-xs text-[color:var(--color-text-secondary)]">Loading campaigns…</p>
          ) : campaigns.length === 0 ? (
            <p className="text-xs text-[color:var(--color-text-secondary)]">No campaigns on this account yet.</p>
          ) : (
            <select
              value={campaignId}
              onChange={(e) => handleCampaignChange(e.target.value)}
              className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)]"
            >
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* ── TRAFFIC ── */}
      {tab === "traffic" && (
        <div className="flex flex-col gap-2.5">
          <Slider label={`Volume: ${volume.toLocaleString()} impressions`} min={100} max={50000} step={100} value={volume} onChange={setVolume} />
          <Slider label={`Base conversion: ${baseCvrPct}%`} min={1} max={30} step={1} value={baseCvrPct} onChange={setBaseCvrPct} />
          <Slider label={`Winner lift: +${winnerLiftPct}%`} min={0} max={200} step={5} value={winnerLiftPct} onChange={setWinnerLiftPct} />
          <Slider label={`Fast-dismiss: ${fastDismissPct}%`} min={0} max={80} step={5} value={fastDismissPct} onChange={setFastDismissPct} />
          <Slider label={`Waves (re-allocation checkpoints): ${waves}`} min={1} max={20} step={1} value={waves} onChange={setWaves} />

          <div className="grid grid-cols-2 gap-2">
            <Picker label="Device mix" value={deviceProfile} options={Object.keys(DEVICE_PROFILES)} onChange={setDeviceProfile} />
            <Picker label="Intent mix" value={intentProfile} options={Object.keys(INTENT_PROFILES)} onChange={setIntentProfile} />
          </div>

          <button
            type="button"
            disabled={busy !== null || !campaignId}
            onClick={() =>
              call("traffic", {
                action: "simulate_traffic",
                campaignId,
                sim: {
                  volume,
                  baseCvr: baseCvrPct / 100,
                  winnerLiftPct,
                  fastDismissRate: fastDismissPct / 100,
                  waves,
                  deviceMix: DEVICE_PROFILES[deviceProfile],
                  intentMix: INTENT_PROFILES[intentProfile],
                },
              })
            }
            className="rounded-lg bg-[color:var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy === "traffic" ? "Running…" : "Test under traffic"}
          </button>
          <button
            type="button"
            disabled={busy !== null || !campaignId}
            onClick={() => call("clear", { action: "clear_sim_data", campaignId })}
            className="rounded-lg border border-[color:var(--color-border)] px-4 py-2 text-xs font-semibold text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-surface-sunken)] disabled:opacity-60"
          >
            {busy === "clear" ? "Clearing…" : "Clear simulated data"}
          </button>
        </div>
      )}

      {/* ── DIVERSITY ── */}
      {tab === "diversity" && (
        <div className="flex flex-col gap-2.5">
          <Slider label={`Structural variants (free): ${diversityN}`} min={10} max={300} step={10} value={diversityN} onChange={setDiversityN} />
          <div>
            <Slider
              label={`Real AI copy samples: ${aiSampleCount}`}
              min={0}
              max={30}
              step={1}
              value={aiSampleCount}
              onChange={setAiSampleCount}
            />
            <p className="mt-1 text-[11px] text-[color:var(--color-text-secondary)]">
              {aiSampleCount === 0 ? (
                "Structural only — no AI calls, no cost."
              ) : (
                <>
                  Rough (over)estimated cost:{" "}
                  <span className="font-semibold text-[color:var(--color-text-primary)]">
                    {formatEstimatedCost(aiSampleCount)}
                  </span>{" "}
                  · {aiSampleCount} generation call{aiSampleCount === 1 ? "" : "s"} (≈2 popups each)
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() =>
              call("diversity", {
                action: "analyze_diversity",
                campaignId: campaignId || undefined,
                diversity: { n: diversityN, aiSampleCount },
              })
            }
            className="rounded-lg bg-[color:var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy === "diversity" ? "Analyzing…" : "Analyze diversity"}
          </button>
        </div>
      )}

      {/* ── TIMING ── */}
      {tab === "timing" && (
        <div className="flex flex-col gap-2.5">
          <p className="text-xs text-[color:var(--color-text-secondary)]">
            Per-stage timing across recent generations (queue wait, initialize, AI thinking, saving).
          </p>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => call("timing", { action: "gen_timing" })}
            className="rounded-lg bg-[color:var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy === "timing" ? "Loading…" : "Load generation timing"}
          </button>
        </div>
      )}

      {/* ── INJECT (legacy) ── */}
      {tab === "inject" && selectedCampaign && (
        <div className="flex flex-col gap-2.5">
          {selectedCampaign.variants.length === 0 ? (
            <p className="text-xs text-[color:var(--color-text-secondary)]">This campaign has no variants yet.</p>
          ) : (
            <select
              value={variantId}
              onChange={(e) => setVariantId(e.target.value)}
              className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)]"
            >
              {selectedCampaign.variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          )}
          <Slider label={`Mock impressions: ${mockCount}`} min={1} max={10000} step={1} value={mockCount} onChange={setMockCount} />
          <button
            type="button"
            disabled={busy !== null || !variantId}
            onClick={() => call("inject", { action: "inject", variantId, mockCount })}
            className="rounded-lg bg-[color:var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy === "inject" ? "Injecting…" : "Inject mock data (flat 20%)"}
          </button>
          <button
            type="button"
            disabled={busy !== null || !variantId}
            onClick={() => call("knockout", { action: "trigger_knockout", variantId })}
            className="rounded-lg border border-[color:var(--color-border)] px-4 py-2 text-sm font-semibold text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-surface-sunken)] disabled:opacity-60"
          >
            {busy === "knockout" ? "Triggering…" : "Trigger knockout"}
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
      {result != null && (
        <pre className="max-h-64 overflow-auto rounded-lg bg-[color:var(--color-surface-sunken)] p-2 text-[10px] leading-tight text-[color:var(--color-text-primary)]">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-[color:var(--color-text-secondary)]">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-[color:var(--color-primary)]"
      />
    </label>
  );
}

function Picker({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-[color:var(--color-text-secondary)]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-2 py-1.5 text-xs outline-none focus:border-[color:var(--color-primary)]"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
