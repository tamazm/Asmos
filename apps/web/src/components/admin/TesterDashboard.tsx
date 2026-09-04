"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatEstimatedCost } from "@/lib/testing/genTiming";
import type { Device, Intent } from "@/lib/testing/trafficSim";
import type {
  TrafficSimResult,
  DiversityResult,
  RenderedPopup,
  TimedGenerationStatus,
} from "@/lib/testing/testingActions";

type CampaignOption = { id: string; name: string; variants: { id: string; name: string }[] };
type Tab = "traffic" | "diversity" | "timing";

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

const TABS: { id: Tab; label: string; blurb: string }[] = [
  { id: "traffic", label: "Traffic", blurb: "Fire realistic fake traffic at a campaign's live popups and watch the bandit + knockout react." },
  { id: "diversity", label: "Diversity", blurb: "Do generated popups stay different or repeat? Structural check is free; the AI slider renders real popups." },
  { id: "timing", label: "Generation timing", blurb: "Time a real, fresh generation end-to-end and see the popup it produced." },
];

export function TesterDashboard() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("traffic");
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [campaignId, setCampaignId] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Traffic
  const [volume, setVolume] = useState(3000);
  const [baseCvrPct, setBaseCvrPct] = useState(4);
  const [winnerLiftPct, setWinnerLiftPct] = useState(60);
  const [fastDismissPct, setFastDismissPct] = useState(20);
  const [waves, setWaves] = useState(6);
  const [deviceProfile, setDeviceProfile] = useState("Mobile-heavy");
  const [intentProfile, setIntentProfile] = useState("Mixed");
  const [trafficResult, setTrafficResult] = useState<TrafficSimResult | null>(null);

  // Diversity
  const [diversityN, setDiversityN] = useState(100);
  const [aiSampleCount, setAiSampleCount] = useState(0);
  const [diversityResult, setDiversityResult] = useState<DiversityResult | null>(null);

  // Timing
  const [timedCampaignId, setTimedCampaignId] = useState<string | null>(null);
  const [timedStatus, setTimedStatus] = useState<string | null>(null);
  const [timing, setTiming] = useState<TimedGenerationStatus | null>(null);

  useEffect(() => {
    fetch("/api/campaigns")
      .then((r) => r.json())
      .then((data: { campaigns?: CampaignOption[] }) => {
        const list = data.campaigns ?? [];
        setCampaigns(list);
        if (list.length > 0) setCampaignId(list[0].id);
      })
      .catch(() => setError("Failed to load campaigns"))
      .finally(() => setLoadingCampaigns(false));
  }, []);

  async function post<T>(payload: Record<string, unknown>): Promise<T> {
    const res = await fetch("/api/testing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Request failed");
    return data as T;
  }

  async function runTraffic() {
    setBusy("traffic");
    setError(null);
    setNotice(null);
    setTrafficResult(null);
    try {
      const data = await post<{ simulation: TrafficSimResult }>({
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
      });
      setTrafficResult(data.simulation);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  async function clearSim() {
    setBusy("clear");
    setError(null);
    try {
      const data = await post<{ removed: number }>({ action: "clear_sim_data", campaignId });
      setNotice(`Removed ${data.removed.toLocaleString()} simulated events.`);
      setTrafficResult(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  async function runDiversity() {
    setBusy("diversity");
    setError(null);
    setNotice(null);
    setDiversityResult(null);
    try {
      const data = await post<{ diversity: DiversityResult }>({
        action: "analyze_diversity",
        campaignId: campaignId || undefined,
        diversity: { n: diversityN, aiSampleCount },
      });
      setDiversityResult(data.diversity);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  async function runTimedGeneration() {
    if (!campaignId) return;
    setBusy("timedgen");
    setError(null);
    setNotice(null);
    setTiming(null);
    setTimedCampaignId(null);
    setTimedStatus("Starting…");
    try {
      const start = await post<{ campaignId: string }>({ action: "run_timed_generation", campaignId });
      const testId = start.campaignId;
      setTimedCampaignId(testId);
      const startedAt = Date.now();
      while (Date.now() - startedAt < 180_000) {
        await new Promise((r) => setTimeout(r, 2000));
        const s = await post<TimedGenerationStatus>({ action: "timed_generation_status", campaignId: testId });
        setTimedStatus(s.trace ? "Done" : `${s.status}${s.generationStage ? ` · ${s.generationStage}` : ""}…`);
        if (s.trace || s.status === "FAILED") {
          setTiming(s);
          if (s.status === "FAILED") setError(`Generation failed: ${s.lastError ?? "unknown"}`);
          break;
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  async function deleteTest() {
    if (!timedCampaignId) return;
    setBusy("deltest");
    try {
      await post({ action: "delete_test_campaign", campaignId: timedCampaignId });
      setNotice("Test campaign deleted.");
      setTimedCampaignId(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  const activeBlurb = TABS.find((t) => t.id === tab)?.blurb;

  return (
    <div className="flex flex-col gap-5">
      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              tab === t.id
                ? "bg-[color:var(--color-primary)] text-white"
                : "border border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {activeBlurb && <p className="text-sm text-[color:var(--color-text-secondary)]">{activeBlurb}</p>}

      {/* Campaign selector */}
      <Card>
        <div className="flex flex-col gap-1.5">
          <Label>{tab === "timing" ? "Campaign to clone (generation template)" : tab === "diversity" ? "Brand context (optional)" : "Campaign"}</Label>
          {loadingCampaigns ? (
            <p className="text-sm text-[color:var(--color-text-secondary)]">Loading campaigns…</p>
          ) : campaigns.length === 0 ? (
            <p className="text-sm text-[color:var(--color-text-secondary)]">No campaigns on this account yet.</p>
          ) : (
            <select
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              className="w-full max-w-md rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-sm outline-none focus:border-[color:var(--color-primary)]"
            >
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </div>
      </Card>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>
      )}
      {notice && (
        <div className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] px-4 py-2.5 text-sm text-[color:var(--color-text-primary)]">{notice}</div>
      )}

      {tab === "traffic" && (
        <TrafficSection
          volume={volume} setVolume={setVolume}
          baseCvrPct={baseCvrPct} setBaseCvrPct={setBaseCvrPct}
          winnerLiftPct={winnerLiftPct} setWinnerLiftPct={setWinnerLiftPct}
          fastDismissPct={fastDismissPct} setFastDismissPct={setFastDismissPct}
          waves={waves} setWaves={setWaves}
          deviceProfile={deviceProfile} setDeviceProfile={setDeviceProfile}
          intentProfile={intentProfile} setIntentProfile={setIntentProfile}
          busy={busy} campaignId={campaignId}
          onRun={runTraffic} onClear={clearSim} result={trafficResult}
        />
      )}

      {tab === "diversity" && (
        <DiversitySection
          diversityN={diversityN} setDiversityN={setDiversityN}
          aiSampleCount={aiSampleCount} setAiSampleCount={setAiSampleCount}
          busy={busy} onRun={runDiversity} result={diversityResult}
        />
      )}

      {tab === "timing" && (
        <TimingSection
          busy={busy} campaignId={campaignId} timedStatus={timedStatus}
          timedCampaignId={timedCampaignId} timing={timing}
          onRun={runTimedGeneration} onDelete={deleteTest}
        />
      )}
    </div>
  );
}

// ─── Traffic ─────────────────────────────────────────────────────────────────

function TrafficSection(p: {
  volume: number; setVolume: (v: number) => void;
  baseCvrPct: number; setBaseCvrPct: (v: number) => void;
  winnerLiftPct: number; setWinnerLiftPct: (v: number) => void;
  fastDismissPct: number; setFastDismissPct: (v: number) => void;
  waves: number; setWaves: (v: number) => void;
  deviceProfile: string; setDeviceProfile: (v: string) => void;
  intentProfile: string; setIntentProfile: (v: string) => void;
  busy: string | null; campaignId: string;
  onRun: () => void; onClear: () => void; result: TrafficSimResult | null;
}) {
  return (
    <>
      <Card>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Slider label={`Volume: ${p.volume.toLocaleString()} impressions`} min={100} max={50000} step={100} value={p.volume} onChange={p.setVolume} />
          <Slider label={`Base conversion: ${p.baseCvrPct}%`} min={1} max={30} step={1} value={p.baseCvrPct} onChange={p.setBaseCvrPct} />
          <Slider label={`Winner lift: +${p.winnerLiftPct}%`} min={0} max={200} step={5} value={p.winnerLiftPct} onChange={p.setWinnerLiftPct} />
          <Slider label={`Fast-dismiss: ${p.fastDismissPct}%`} min={0} max={80} step={5} value={p.fastDismissPct} onChange={p.setFastDismissPct} />
          <Slider label={`Waves: ${p.waves}`} min={1} max={20} step={1} value={p.waves} onChange={p.setWaves} />
          <div className="grid grid-cols-2 gap-3">
            <Picker label="Device mix" value={p.deviceProfile} options={Object.keys(DEVICE_PROFILES)} onChange={p.setDeviceProfile} />
            <Picker label="Intent mix" value={p.intentProfile} options={Object.keys(INTENT_PROFILES)} onChange={p.setIntentProfile} />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <PrimaryButton disabled={p.busy !== null || !p.campaignId} onClick={p.onRun}>
            {p.busy === "traffic" ? "Running…" : "Test under traffic"}
          </PrimaryButton>
          <GhostButton disabled={p.busy !== null || !p.campaignId} onClick={p.onClear}>
            {p.busy === "clear" ? "Clearing…" : "Clear simulated data"}
          </GhostButton>
        </div>
      </Card>

      {p.result && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatTile label="Impressions" value={p.result.totalImpressions.toLocaleString()} />
            <StatTile label="Conversions" value={p.result.totalSubmissions.toLocaleString()} />
            <StatTile label="Overall CVR" value={pct(p.result.totalImpressions ? p.result.totalSubmissions / p.result.totalImpressions : 0)} />
            <StatTile label="Sample ratio" value={p.result.srm.mismatch ? "Mismatch ⚠" : "Healthy"} tone={p.result.srm.mismatch ? "warn" : "ok"} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {p.result.variants.map((v) => (
              <VariantCard key={v.id} variant={v} waves={p.result!.waves} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

function VariantCard({
  variant,
  waves,
}: {
  variant: TrafficSimResult["variants"][number];
  waves: TrafficSimResult["waves"];
}) {
  const series = waves.map((w) => w.allocation.find((a) => a.id === variant.id)?.trafficPercent ?? 0);
  return (
    <div className="overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-sm">
      <PopupFrame code={variant.generatedCode} height={300} />
      <div className="border-t border-[color:var(--color-border)] p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold text-[color:var(--color-text-primary)]">{variant.name}</span>
          {variant.isWinner && (
            <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">true winner</span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <MiniStat label="Impr." value={variant.impressions.toLocaleString()} />
          <MiniStat label="CVR" value={pct(variant.cvr)} />
          <MiniStat label="Traffic" value={`${variant.trafficPercent}%`} />
        </div>
        <div className="mt-3">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[color:var(--color-text-secondary)]">Allocation across waves</p>
          <div className="flex items-end gap-1" style={{ height: 32 }}>
            {series.map((v, i) => (
              <div key={i} className="flex-1 rounded-sm bg-[color:var(--color-primary)]" style={{ height: `${Math.max(4, v)}%`, opacity: 0.35 + 0.65 * (i / Math.max(1, series.length - 1)) }} title={`Wave ${i + 1}: ${v}%`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Diversity ───────────────────────────────────────────────────────────────

const AI_MAX_CALLS = 12;

function DiversitySection(p: {
  diversityN: number; setDiversityN: (v: number) => void;
  aiSampleCount: number; setAiSampleCount: (v: number) => void;
  busy: string | null; onRun: () => void; result: DiversityResult | null;
}) {
  return (
    <>
      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <Slider label={`Structural variants (free): ${p.diversityN}`} min={10} max={300} step={10} value={p.diversityN} onChange={p.setDiversityN} />
          <div>
            <Slider label={`Real AI popups: ${p.aiSampleCount} call${p.aiSampleCount === 1 ? "" : "s"}`} min={0} max={AI_MAX_CALLS} step={1} value={p.aiSampleCount} onChange={p.setAiSampleCount} />
            <p className="mt-1 text-xs text-[color:var(--color-text-secondary)]">
              {p.aiSampleCount === 0
                ? "Structural only — no AI calls, no cost."
                : <>Renders <b>{p.aiSampleCount * 2}</b> real popups · rough (over)estimated cost <b className="text-[color:var(--color-text-primary)]">{formatEstimatedCost(p.aiSampleCount)}</b></>}
            </p>
          </div>
        </div>
        <div className="mt-4">
          <PrimaryButton disabled={p.busy !== null} onClick={p.onRun}>
            {p.busy === "diversity" ? "Analyzing…" : "Analyze diversity"}
          </PrimaryButton>
        </div>
      </Card>

      {p.result && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatTile label="Unique structures" value={pct(p.result.structural.uniqueRate)} tone={p.result.structural.uniqueRate > 0.9 ? "ok" : "warn"} />
            <StatTile label="Mean neighbour dist." value={p.result.structural.meanNearestNeighbor.toFixed(2)} />
            <StatTile label="Too-similar pairs" value={pct(p.result.structural.tooClosePairRate)} tone={p.result.structural.tooClosePairRate < 0.05 ? "ok" : "warn"} />
            <StatTile label="Exact clones" value={String(p.result.structural.exactCollisions)} tone={p.result.structural.exactCollisions === 0 ? "ok" : "warn"} />
          </div>

          <Card>
            <h3 className="mb-3 text-sm font-semibold text-[color:var(--color-text-primary)]">How evenly each design knob is covered</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(p.result.knobs).map(([knob, cov]) => (
                <div key={knob}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-[color:var(--color-text-primary)]">{knob}</span>
                    <span className="text-[color:var(--color-text-secondary)]">top: {cov.topValue} ({pct(cov.topShare)})</span>
                  </div>
                  <ProgressBar value={cov.coverage} tone={cov.coverage >= 0.66 ? "ok" : "warn"} />
                </div>
              ))}
            </div>
          </Card>

          {p.result.copy && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatTile label="Exact headline dupes" value={String(p.result.copy.exactHeadlineDupes)} tone={p.result.copy.exactHeadlineDupes === 0 ? "ok" : "warn"} />
              <StatTile label="Max headline overlap" value={pct(p.result.copy.maxHeadlineSimilarity)} tone={p.result.copy.maxHeadlineSimilarity < 0.5 ? "ok" : "warn"} />
              <StatTile label="Subhead restates" value={pct(p.result.copy.subheadRestateRate)} tone={p.result.copy.subheadRestateRate < 0.2 ? "ok" : "warn"} />
              <StatTile label="Banned openers" value={pct(p.result.copy.bannedOpenerRate)} tone={p.result.copy.bannedOpenerRate < 0.1 ? "ok" : "warn"} />
            </div>
          )}

          {p.result.popups.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-semibold text-[color:var(--color-text-primary)]">
                The actual generated popups — look for repetition
              </h3>
              <PopupGrid popups={p.result.popups} />
            </div>
          )}
        </>
      )}
    </>
  );
}

// ─── Timing ──────────────────────────────────────────────────────────────────

function TimingSection(p: {
  busy: string | null; campaignId: string; timedStatus: string | null;
  timedCampaignId: string | null; timing: TimedGenerationStatus | null;
  onRun: () => void; onDelete: () => void;
}) {
  const trace = p.timing?.trace ?? null;
  const stages: { label: string; ms: number | null }[] = trace
    ? [
        { label: "Queue wait", ms: trace.queueMs },
        { label: "Initialize", ms: trace.initializeMs },
        { label: "AI thinking", ms: trace.aiThinkingMs },
        { label: "Saving", ms: trace.savingMs },
      ]
    : [];
  const maxMs = Math.max(1, ...stages.map((s) => s.ms ?? 0));

  return (
    <>
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <PrimaryButton disabled={p.busy !== null || !p.campaignId} onClick={p.onRun}>
            {p.busy === "timedgen" ? "Generating & timing…" : "Time a fresh generation"}
          </PrimaryButton>
          {p.timedCampaignId && p.busy !== "timedgen" && (
            <GhostButton disabled={p.busy !== null} onClick={p.onDelete}>
              {p.busy === "deltest" ? "Deleting…" : "Delete this test campaign"}
            </GhostButton>
          )}
          {p.busy === "timedgen" && p.timedStatus && (
            <span className="text-sm text-[color:var(--color-text-secondary)]">{p.timedStatus}</span>
          )}
        </div>
      </Card>

      {trace && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="text-sm font-semibold text-[color:var(--color-text-primary)]">Where the time went</h3>
              <span className="text-lg font-bold text-[color:var(--color-text-primary)]">{secs(trace.totalMs)} total</span>
            </div>
            <div className="flex flex-col gap-2.5">
              {stages.map((s) => (
                <div key={s.label}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-[color:var(--color-text-secondary)]">{s.label}</span>
                    <span className="font-mono font-medium text-[color:var(--color-text-primary)]">{secs(s.ms)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[color:var(--color-surface-sunken)]">
                    <div className="h-full rounded-full bg-[color:var(--color-primary)]" style={{ width: `${((s.ms ?? 0) / maxMs) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {p.timing && p.timing.popups.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-sm">
              <PopupFrame code={p.timing.popups[0].generatedCode} height={340} />
              <div className="border-t border-[color:var(--color-border)] p-3 text-sm font-medium text-[color:var(--color-text-primary)]">
                {p.timing.popups[0].headline || "Generated popup"}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ─── Shared bits ─────────────────────────────────────────────────────────────

function PopupFrame({ code, height = 320 }: { code: string; height?: number }) {
  if (!code) {
    return (
      <div className="grid place-items-center bg-[color:var(--color-surface-sunken)] text-xs text-[color:var(--color-text-secondary)]" style={{ height }}>
        No preview available
      </div>
    );
  }
  return (
    <iframe
      srcDoc={code}
      title="Popup preview"
      sandbox="allow-scripts allow-same-origin"
      scrolling="no"
      className="pointer-events-none w-full border-0 bg-white"
      style={{ height }}
    />
  );
}

function PopupGrid({ popups }: { popups: RenderedPopup[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {popups.map((pop, i) => (
        <div key={i} className="overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-sm">
          <PopupFrame code={pop.generatedCode} height={280} />
          <div className="border-t border-[color:var(--color-border)] p-2.5">
            <p className="truncate text-xs font-semibold text-[color:var(--color-text-primary)]">{pop.headline || "—"}</p>
            <p className="truncate text-[11px] text-[color:var(--color-text-secondary)]">{pop.subhead}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 shadow-sm sm:p-5">{children}</div>;
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-medium text-[color:var(--color-text-secondary)]">{children}</span>;
}

function StatTile({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  const color = tone === "ok" ? "text-emerald-600" : tone === "warn" ? "text-amber-600" : "text-[color:var(--color-text-primary)]";
  return (
    <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
      <span className="text-xs font-medium text-[color:var(--color-text-secondary)]">{label}</span>
      <span className={`mt-1 block text-2xl font-bold ${color}`}>{value}</span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[color:var(--color-surface-sunken)] py-1.5">
      <div className="text-sm font-bold text-[color:var(--color-text-primary)]">{value}</div>
      <div className="text-[10px] text-[color:var(--color-text-secondary)]">{label}</div>
    </div>
  );
}

function ProgressBar({ value, tone }: { value: number; tone?: "ok" | "warn" }) {
  const bg = tone === "warn" ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="h-2 overflow-hidden rounded-full bg-[color:var(--color-surface-sunken)]">
      <div className={`h-full rounded-full ${bg}`} style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }} />
    </div>
  );
}

function Slider({ label, min, max, step, value, onChange }: { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-[color:var(--color-text-secondary)]">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="accent-[color:var(--color-primary)]" />
    </label>
  );
}

function Picker({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-[color:var(--color-text-secondary)]">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-2 py-1.5 text-xs outline-none focus:border-[color:var(--color-primary)]">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

function PrimaryButton({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className="rounded-lg bg-[color:var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50">
      {children}
    </button>
  );
}

function GhostButton({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2 text-sm font-semibold text-[color:var(--color-text-primary)] transition-colors hover:bg-[color:var(--color-surface-sunken)] disabled:opacity-50">
      {children}
    </button>
  );
}

function pct(v: number): string {
  return `${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%`;
}
function secs(ms: number | null): string {
  return typeof ms === "number" ? `${(ms / 1000).toFixed(1)}s` : "—";
}
