"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatEstimatedCost } from "@/lib/testing/genTiming";
import type { Device, Intent } from "@/lib/testing/trafficSim";
import type {
  TrafficSimResult,
  DiversityResult,
  DiversityRunDTO,
  RenderedPopup,
  TimedGenerationStatus,
  TimingRunDTO,
  KnockoutSimState,
  LiveKnockoutStepResult,
} from "@/lib/testing/testingActions";

const TIMING_PAGE_SIZE = 10;
const DIVERSITY_PAGE_SIZE = 10;

type CampaignOption = { id: string; name: string; variants: { id: string; name: string }[] };
type Tab = "traffic" | "knockout" | "diversity" | "timing";
type DiversityGoal = "BOTH" | "EMAIL" | "DISCOUNT" | "MIXED";

const GOAL_OPTIONS: { id: DiversityGoal; label: string; hint: string }[] = [
  { id: "BOTH", label: "Capture & offer", hint: "Collect an email and reveal a discount" },
  { id: "EMAIL", label: "Email only", hint: "Collect an email, no coupon" },
  { id: "DISCOUNT", label: "Discount only", hint: "Reveal a coupon, no email field" },
  { id: "MIXED", label: "All three mixed", hint: "Cycle through all three goals" },
];

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
  { id: "traffic", label: "Traffic", blurb: "Fire realistic fake traffic at a campaign's live popups and watch the bandit react." },
  { id: "knockout", label: "Knockout tournament", blurb: "Fast-forward the tournament bracket: simulate traffic waves, posterior win probabilities, strikes, eliminations, and round progressions in real time." },
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
  const [diversityGoal, setDiversityGoal] = useState<DiversityGoal>("BOTH");
  const [diversityResult, setDiversityResult] = useState<DiversityResult | null>(null);
  const [diversityRuns, setDiversityRuns] = useState<DiversityRunDTO[]>([]);
  const [diversityRunsTotal, setDiversityRunsTotal] = useState(0);
  const [diversityRunsPage, setDiversityRunsPage] = useState(0);
  const [diversityRunsLoading, setDiversityRunsLoading] = useState(false);

  // Timing
  const [timedStatus, setTimedStatus] = useState<string | null>(null);
  const [timing, setTiming] = useState<TimedGenerationStatus | null>(null);
  const [runs, setRuns] = useState<TimingRunDTO[]>([]);
  const [runsTotal, setRunsTotal] = useState(0);
  const [runsPage, setRunsPage] = useState(0);
  const [runsLoading, setRunsLoading] = useState(false);

  // Knockout Simulator
  const [knockoutMode, setKnockoutMode] = useState<"sandbox" | "live">("sandbox");
  const [knockoutVariantsCount, setKnockoutVariantsCount] = useState(4);
  const [knockoutBaseCvr, setKnockoutBaseCvr] = useState(4);
  const [knockoutWinnerLift, setKnockoutWinnerLift] = useState(60);
  const [knockoutStepVolume, setKnockoutStepVolume] = useState(1500);
  const [knockoutMaxRounds, setKnockoutMaxRounds] = useState(3);
  const [knockoutState, setKnockoutState] = useState<KnockoutSimState | null>(null);
  const [liveStepResult, setLiveStepResult] = useState<LiveKnockoutStepResult | null>(null);
  const knockoutLoadedRef = useRef(false);

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

  // Load history the first time a tab is opened
  // (triggered from the tab button's onClick, not an effect).
  const runsLoadedRef = useRef(false);
  const diversityRunsLoadedRef = useRef(false);
  function openTab(next: Tab) {
    setTab(next);
    if (next === "timing" && !runsLoadedRef.current) {
      runsLoadedRef.current = true;
      loadRuns(0);
    }
    if (next === "diversity" && !diversityRunsLoadedRef.current) {
      diversityRunsLoadedRef.current = true;
      loadDiversityRuns(0);
    }
    if (next === "knockout" && !knockoutLoadedRef.current) {
      knockoutLoadedRef.current = true;
      initKnockoutSandbox();
    }
  }

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

  async function initKnockoutSandbox(
    count = knockoutVariantsCount,
    cvr = knockoutBaseCvr,
    lift = knockoutWinnerLift,
    maxR = knockoutMaxRounds,
  ) {
    setBusy("initknockout");
    setError(null);
    try {
      const data = await post<{ ok: boolean; state: KnockoutSimState }>({
        action: "init_knockout_sandbox",
        knockoutConfig: {
          startingVariants: count,
          baseCvr: cvr / 100,
          winnerLiftPct: lift,
          maxRounds: maxR,
          impressionsPerStep: knockoutStepVolume,
        },
      });
      setKnockoutState(data.state);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to initialize sandbox");
    } finally {
      setBusy(null);
    }
  }

  async function stepKnockoutSandbox() {
    if (!knockoutState) return;
    setBusy("stepknockout");
    setError(null);
    try {
      const data = await post<{ ok: boolean; state: KnockoutSimState }>({
        action: "step_knockout_sandbox",
        knockoutState,
        knockoutConfig: {
          baseCvr: knockoutBaseCvr / 100,
          winnerLiftPct: knockoutWinnerLift,
          impressionsPerStep: knockoutStepVolume,
          maxRounds: knockoutMaxRounds,
        },
      });
      setKnockoutState(data.state);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to step knockout");
    } finally {
      setBusy(null);
    }
  }

  async function ffKnockoutRound() {
    if (!knockoutState) return;
    setBusy("ffround");
    setError(null);
    try {
      const data = await post<{ ok: boolean; state: KnockoutSimState }>({
        action: "ff_knockout_round",
        knockoutState,
        knockoutConfig: {
          baseCvr: knockoutBaseCvr / 100,
          winnerLiftPct: knockoutWinnerLift,
          impressionsPerStep: knockoutStepVolume,
          maxRounds: knockoutMaxRounds,
        },
      });
      setKnockoutState(data.state);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fast-forward round");
    } finally {
      setBusy(null);
    }
  }

  async function ffKnockoutTournament() {
    if (!knockoutState) return;
    setBusy("fftournament");
    setError(null);
    try {
      const data = await post<{ ok: boolean; state: KnockoutSimState }>({
        action: "ff_knockout_tournament",
        knockoutState,
        knockoutConfig: {
          baseCvr: knockoutBaseCvr / 100,
          winnerLiftPct: knockoutWinnerLift,
          impressionsPerStep: knockoutStepVolume,
          maxRounds: knockoutMaxRounds,
        },
      });
      setKnockoutState(data.state);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fast-forward tournament");
    } finally {
      setBusy(null);
    }
  }

  async function stepLiveKnockout() {
    if (!campaignId) return;
    setBusy("steplive");
    setError(null);
    try {
      const data = await post<{ ok: boolean; step: LiveKnockoutStepResult }>({
        action: "step_live_knockout",
        campaignId,
        knockoutConfig: {
          baseCvr: knockoutBaseCvr / 100,
          winnerLiftPct: knockoutWinnerLift,
          impressionsPerStep: knockoutStepVolume,
        },
      });
      setLiveStepResult(data.step);
      setNotice(data.step.message);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to step live knockout");
    } finally {
      setBusy(null);
    }
  }

  async function resetLiveKnockout() {
    if (!campaignId) return;
    setBusy("resetlive");
    setError(null);
    try {
      const data = await post<{ ok: boolean; removedEvents: number; resetVariants: number }>({
        action: "reset_live_knockout",
        campaignId,
      });
      setLiveStepResult(null);
      setNotice(`Reset complete: removed ${data.removedEvents.toLocaleString()} simulated events and restored ${data.resetVariants} variants.`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reset live knockout");
    } finally {
      setBusy(null);
    }
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
      const data = await post<{ diversity: DiversityResult; run?: DiversityRunDTO }>({
        action: "analyze_diversity",
        // No campaignId: Diversity generates standalone tester popups with no
        // brand context, so it never reads or mutates a real campaign.
        diversity: { n: diversityN, aiSampleCount, goal: diversityGoal },
      });
      setDiversityResult(data.diversity);
      await loadDiversityRuns(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  async function loadDiversityRuns(page = diversityRunsPage) {
    setDiversityRunsLoading(true);
    try {
      const data = await post<{ runs: DiversityRunDTO[]; total: number; page: number }>({
        action: "list_diversity_runs",
        page,
        pageSize: DIVERSITY_PAGE_SIZE,
      });
      setDiversityRuns(data.runs);
      setDiversityRunsTotal(data.total);
      setDiversityRunsPage(data.page);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load diversity history");
    } finally {
      setDiversityRunsLoading(false);
    }
  }

  async function deleteDiversityRun(id: string) {
    setBusy("deldiversityrun");
    try {
      await post({ action: "delete_diversity_run", runId: id });
      const remaining = diversityRunsTotal - 1;
      const lastPage = Math.max(0, Math.ceil(remaining / DIVERSITY_PAGE_SIZE) - 1);
      await loadDiversityRuns(Math.min(diversityRunsPage, lastPage));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  async function clearDiversityRuns() {
    setBusy("cleardiversityruns");
    try {
      const data = await post<{ removed: number }>({ action: "clear_diversity_runs" });
      setNotice(`Cleared ${data.removed} logged diversity run${data.removed === 1 ? "" : "s"}.`);
      await loadDiversityRuns(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  async function loadRuns(page = runsPage) {
    setRunsLoading(true);
    try {
      const data = await post<{ runs: TimingRunDTO[]; total: number; page: number }>({
        action: "list_timing_runs",
        page,
        pageSize: TIMING_PAGE_SIZE,
      });
      setRuns(data.runs);
      setRunsTotal(data.total);
      setRunsPage(data.page);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load history");
    } finally {
      setRunsLoading(false);
    }
  }

  async function runTimedGeneration() {
    if (!campaignId) return;
    setBusy("timedgen");
    setError(null);
    setNotice(null);
    setTiming(null);
    setTimedStatus("Starting…");
    try {
      const start = await post<{ campaignId: string }>({ action: "run_timed_generation", campaignId });
      const testId = start.campaignId;
      const startedAt = Date.now();
      let finished = false;
      while (Date.now() - startedAt < 180_000) {
        await new Promise((r) => setTimeout(r, 2000));
        const s = await post<TimedGenerationStatus>({ action: "timed_generation_status", campaignId: testId });
        setTimedStatus(s.trace ? "Logging result…" : `${s.status}${s.generationStage ? ` · ${s.generationStage}` : ""}…`);
        if (s.trace || s.status === "FAILED") {
          setTiming(s);
          if (s.status === "FAILED") setError(`Generation failed: ${s.lastError ?? "unknown"}`);
          finished = true;
          break;
        }
      }
      if (!finished) {
        setError("Timed out waiting for generation (180s).");
      }
      // Log the run to durable history and delete the throwaway campaign.
      const fin = await post<{ done: boolean }>({ action: "finalize_timed_generation", campaignId: testId });
      if (fin.done) {
        setTimedStatus("Done · logged & cleaned up");
        await loadRuns(0);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  async function deleteRun(id: string) {
    setBusy("delrun");
    try {
      await post({ action: "delete_timing_run", runId: id });
      // Reload the current page, stepping back if it just emptied.
      const remaining = runsTotal - 1;
      const lastPage = Math.max(0, Math.ceil(remaining / TIMING_PAGE_SIZE) - 1);
      await loadRuns(Math.min(runsPage, lastPage));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  async function clearRuns() {
    setBusy("clearruns");
    try {
      const data = await post<{ removed: number }>({ action: "clear_timing_runs" });
      setNotice(`Cleared ${data.removed} logged run${data.removed === 1 ? "" : "s"}.`);
      await loadRuns(0);
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
            onClick={() => openTab(t.id)}
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

      {/* Campaign selector — not shown for Diversity, or Sandbox Knockout */}
      {tab !== "diversity" && (tab !== "knockout" || knockoutMode === "live") && (
        <Card>
          <div className="flex flex-col gap-1.5">
            <Label>{tab === "timing" ? "Campaign to clone (generation template)" : "Campaign"}</Label>
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
      )}

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

      {tab === "knockout" && (
        <KnockoutSection
          mode={knockoutMode}
          setMode={setKnockoutMode}
          variantsCount={knockoutVariantsCount}
          setVariantsCount={setKnockoutVariantsCount}
          baseCvr={knockoutBaseCvr}
          setBaseCvr={setKnockoutBaseCvr}
          winnerLift={knockoutWinnerLift}
          setWinnerLift={setKnockoutWinnerLift}
          stepVolume={knockoutStepVolume}
          setStepVolume={setKnockoutStepVolume}
          maxRounds={knockoutMaxRounds}
          setMaxRounds={setKnockoutMaxRounds}
          busy={busy}
          campaignId={campaignId}
          state={knockoutState}
          liveStepResult={liveStepResult}
          onInitSandbox={() => initKnockoutSandbox()}
          onStepSandbox={stepKnockoutSandbox}
          onFfRound={ffKnockoutRound}
          onFfTournament={ffKnockoutTournament}
          onStepLive={stepLiveKnockout}
          onResetLive={resetLiveKnockout}
        />
      )}

      {tab === "diversity" && (
        <DiversitySection
          diversityN={diversityN} setDiversityN={setDiversityN}
          aiSampleCount={aiSampleCount} setAiSampleCount={setAiSampleCount}
          diversityGoal={diversityGoal} setDiversityGoal={setDiversityGoal}
          busy={busy} onRun={runDiversity} result={diversityResult}
          runs={diversityRuns} runsTotal={diversityRunsTotal}
          runsPage={diversityRunsPage} runsLoading={diversityRunsLoading}
          pageSize={DIVERSITY_PAGE_SIZE}
          onLoadRuns={loadDiversityRuns} onDeleteRun={deleteDiversityRun}
          onClearRuns={clearDiversityRuns}
        />
      )}

      {tab === "timing" && (
        <TimingSection
          busy={busy} campaignId={campaignId} timedStatus={timedStatus}
          timing={timing} onRun={runTimedGeneration}
          runs={runs} runsTotal={runsTotal} runsPage={runsPage} runsLoading={runsLoading}
          pageSize={TIMING_PAGE_SIZE}
          onLoadRuns={loadRuns} onDeleteRun={deleteRun} onClearRuns={clearRuns}
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
      <PopupFrame code={variant.generatedCode} />
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

// ─── Knockout Tournament Section ─────────────────────────────────────────────

function KnockoutSection(p: {
  mode: "sandbox" | "live";
  setMode: (m: "sandbox" | "live") => void;
  variantsCount: number;
  setVariantsCount: (n: number) => void;
  baseCvr: number;
  setBaseCvr: (n: number) => void;
  winnerLift: number;
  setWinnerLift: (n: number) => void;
  stepVolume: number;
  setStepVolume: (n: number) => void;
  maxRounds: number;
  setMaxRounds: (n: number) => void;
  busy: string | null;
  campaignId: string;
  state: KnockoutSimState | null;
  liveStepResult: LiveKnockoutStepResult | null;
  onInitSandbox: () => void;
  onStepSandbox: () => void;
  onFfRound: () => void;
  onFfTournament: () => void;
  onStepLive: () => void;
  onResetLive: () => void;
}) {
  const isSandbox = p.mode === "sandbox";
  const state = p.state;

  return (
    <div className="flex flex-col gap-6">
      {/* Mode Switcher */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => p.setMode("sandbox")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
            isSandbox
              ? "bg-[color:var(--color-primary)] text-white shadow-sm"
              : "border border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]"
          }`}
        >
          <span>🧪 Sandbox Tournament</span>
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold">Fast-Forward & Safe</span>
        </button>
        <button
          type="button"
          onClick={() => p.setMode("live")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
            !isSandbox
              ? "bg-[color:var(--color-primary)] text-white shadow-sm"
              : "border border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]"
          }`}
        >
          <span>🎯 Live Campaign Mode</span>
          <span className="rounded-full bg-amber-500/20 text-amber-600 px-2 py-0.5 text-[10px] font-bold">Database</span>
        </button>
      </div>

      {/* Configuration Card */}
      <Card>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--color-border)] pb-3">
            <div>
              <h3 className="text-sm font-semibold text-[color:var(--color-text-primary)]">
                {isSandbox ? "Tournament Simulation Parameters" : "Live Campaign Knockout Parameters"}
              </h3>
              <p className="text-xs text-[color:var(--color-text-secondary)]">
                {isSandbox
                  ? "Simulate multi-round tournament progression, Thompson posteriors, strikes, and eliminations in memory."
                  : "Step through knockout rounds on an actual database campaign with real-time posterior evaluation and full rewind."}
              </p>
            </div>
            {isSandbox && (
              <GhostButton
                disabled={p.busy !== null}
                onClick={p.onInitSandbox}
              >
                {p.busy === "initknockout" ? "Resetting…" : "Reset / New Bracket ↺"}
              </GhostButton>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {isSandbox && (
              <Slider
                label={`Contenders: ${p.variantsCount} variants`}
                min={3}
                max={8}
                step={1}
                value={p.variantsCount}
                onChange={p.setVariantsCount}
              />
            )}
            <Slider
              label={`Base CVR: ${p.baseCvr}%`}
              min={1}
              max={15}
              step={1}
              value={p.baseCvr}
              onChange={p.setBaseCvr}
            />
            <Slider
              label={`Winner Lift: +${p.winnerLift}%`}
              min={20}
              max={200}
              step={10}
              value={p.winnerLift}
              onChange={p.setWinnerLift}
            />
            <Slider
              label={`Batch volume: ${p.stepVolume.toLocaleString()} impr.`}
              min={500}
              max={5000}
              step={250}
              value={p.stepVolume}
              onChange={p.setStepVolume}
            />
            {isSandbox && (
              <Slider
                label={`Max tournament rounds: ${p.maxRounds}`}
                min={2}
                max={5}
                step={1}
                value={p.maxRounds}
                onChange={p.setMaxRounds}
              />
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            {isSandbox ? (
              <>
                <PrimaryButton
                  disabled={p.busy !== null || !state || state.isFinished}
                  onClick={p.onStepSandbox}
                >
                  {p.busy === "stepknockout" ? (
                    <span className="flex items-center gap-1.5"><Spinner /> Stepping…</span>
                  ) : (
                    "Step Next Evaluation ⚡"
                  )}
                </PrimaryButton>

                <button
                  type="button"
                  disabled={p.busy !== null || !state || state.isFinished}
                  onClick={p.onFfRound}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {p.busy === "ffround" ? (
                    <span className="flex items-center gap-1.5"><Spinner /> Fast-Forwarding…</span>
                  ) : (
                    "Fast-Forward Round ⏩"
                  )}
                </button>

                <button
                  type="button"
                  disabled={p.busy !== null || !state || state.isFinished}
                  onClick={p.onFfTournament}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {p.busy === "fftournament" ? (
                    <span className="flex items-center gap-1.5"><Spinner /> Simulating Tournament…</span>
                  ) : (
                    "Fast-Forward Tournament 🚀"
                  )}
                </button>
              </>
            ) : (
              <>
                <PrimaryButton
                  disabled={p.busy !== null || !p.campaignId}
                  onClick={p.onStepLive}
                >
                  {p.busy === "steplive" ? (
                    <span className="flex items-center gap-1.5"><Spinner /> Evaluating Live…</span>
                  ) : (
                    "Step Next Live Evaluation ⚡"
                  )}
                </PrimaryButton>

                <ConfirmButton
                  label="Reset / Rewind Live Campaign ↺"
                  confirmLabel="Confirm Rewind (Wipes Sim Events & Restores Variants)"
                  tone="danger"
                  busy={p.busy === "resetlive"}
                  disabled={p.busy !== null || !p.campaignId}
                  onConfirm={p.onResetLive}
                />
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Status Summary & Tree View for Sandbox */}
      {isSandbox && state && (
        <>
          {/* Status banner */}
          <div
            className={`flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4 shadow-sm ${
              state.isFinished
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : state.rounds[state.currentRound - 1]?.isComplete
                  ? "border-blue-200 bg-blue-50 text-blue-900"
                  : "border-amber-200 bg-amber-50 text-amber-900"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">
                {state.isFinished ? "🎉" : state.rounds[state.currentRound - 1]?.isComplete ? "🏆" : "⚔️"}
              </span>
              <div>
                <p className="text-sm font-bold">
                  {state.isFinished
                    ? "Tournament Complete — Grand Champion Crowned!"
                    : state.rounds[state.currentRound - 1]?.isComplete
                      ? `Round ${state.currentRound} Complete! Ready to advance.`
                      : `Round ${state.currentRound} Tournament in Progress`}
                </p>
                <p className="text-xs opacity-80">
                  {state.isFinished
                    ? `Champion won after ${state.maxRounds} rounds of intense sequential testing.`
                    : "Variants receive strikes when P(best) drops below 2.00%. 2 consecutive strikes eliminate an underperformer."}
                </p>
              </div>
            </div>

            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-wider opacity-75">Simulated Traffic</p>
              <p className="text-sm font-bold tabular-nums">
                {state.totalImpressions.toLocaleString()} impr. · {state.totalSubmissions.toLocaleString()} conv.
              </p>
            </div>
          </div>

          {/* Visual Tournament Bracket */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[color:var(--color-text-primary)]">
                Knockout Bracket Tree ({state.rounds.length} Round{state.rounds.length === 1 ? "" : "s"})
              </h3>
              <span className="text-xs text-[color:var(--color-text-secondary)]">
                Elimination Threshold: <b>&lt; 2.00% P(best)</b> · Strikes needed: <b>2</b>
              </span>
            </div>

            <div className="flex gap-6 overflow-x-auto pb-4">
              {state.rounds.map((round) => (
                <KnockoutRoundColumn
                  key={round.roundNumber}
                  round={round}
                  isCurrentRound={round.roundNumber === state.currentRound}
                />
              ))}
            </div>
          </div>

          {/* Audit Timeline / Event Log */}
          <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between border-b border-[color:var(--color-border)] pb-2">
              <h4 className="text-sm font-semibold text-[color:var(--color-text-primary)]">
                Tournament Audit Log ({state.logs.length} events)
              </h4>
              <span className="text-xs text-[color:var(--color-text-secondary)]">Chronological progression</span>
            </div>

            <div className="max-h-64 flex flex-col gap-2 overflow-y-auto pr-1">
              {state.logs.map((log) => (
                <div
                  key={log.id}
                  className={`flex items-start gap-2.5 rounded-lg p-2 text-xs ${
                    log.type === "elimination"
                      ? "bg-red-50 text-red-900 border border-red-200"
                      : log.type === "strike"
                        ? "bg-amber-50 text-amber-900 border border-amber-200"
                        : log.type === "winner"
                          ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
                          : log.type === "advance"
                            ? "bg-purple-50 text-purple-900 border border-purple-200"
                            : "bg-[color:var(--color-surface-sunken)] text-[color:var(--color-text-secondary)]"
                  }`}
                >
                  <span className="font-mono text-[10px] opacity-75 shrink-0">
                    [R{log.round}]
                  </span>
                  <p className="flex-1 font-medium">{log.message}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Live Campaign Mode Status & Variants */}
      {!isSandbox && (
        <div className="flex flex-col gap-4">
          {p.liveStepResult ? (
            <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-[color:var(--color-text-primary)]">
                    Round {p.liveStepResult.round} Live Variants
                  </h4>
                  <p className="text-xs text-[color:var(--color-text-secondary)]">
                    {p.liveStepResult.message}
                  </p>
                </div>
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                  Action: {p.liveStepResult.actionTaken}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {p.liveStepResult.variants.map((v) => (
                  <div
                    key={v.id}
                    className={`rounded-xl border p-4 ${
                      v.status === "ELIMINATED"
                        ? "border-red-200 bg-red-50/50 opacity-60"
                        : "border-[color:var(--color-border)] bg-[color:var(--color-surface)]"
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="truncate text-sm font-bold text-[color:var(--color-text-primary)]">
                        {v.name}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          v.status === "ELIMINATED"
                            ? "bg-red-100 text-red-700"
                            : v.eliminationStrikes > 0
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {v.status === "ELIMINATED"
                          ? "ELIMINATED"
                          : v.eliminationStrikes > 0
                            ? `Strike ${v.eliminationStrikes}/2`
                            : "ACTIVE"}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded bg-[color:var(--color-surface-sunken)] p-1.5">
                        <p className="font-bold text-[color:var(--color-text-primary)]">{v.conversionRate}%</p>
                        <p className="text-[10px] text-[color:var(--color-text-secondary)]">CVR</p>
                      </div>
                      <div className="rounded bg-[color:var(--color-surface-sunken)] p-1.5">
                        <p className="font-bold text-[color:var(--color-text-primary)]">{v.impressions.toLocaleString()}</p>
                        <p className="text-[10px] text-[color:var(--color-text-secondary)]">Impr.</p>
                      </div>
                      <div className="rounded bg-[color:var(--color-surface-sunken)] p-1.5">
                        <p className="font-bold text-[color:var(--color-text-primary)]">{v.trafficPercent}%</p>
                        <p className="text-[10px] text-[color:var(--color-text-secondary)]">Traffic</p>
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="text-[color:var(--color-text-secondary)]">P(best)</span>
                        <span className={`font-bold ${v.pBest < 0.02 ? "text-red-600" : "text-emerald-600"}`}>
                          {(v.pBest * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--color-surface-sunken)]">
                        <div
                          className={`h-full ${v.pBest < 0.02 ? "bg-red-500" : "bg-emerald-500"}`}
                          style={{ width: `${Math.min(100, Math.max(2, v.pBest * 100))}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[color:var(--color-border)] p-8 text-center text-sm text-[color:var(--color-text-secondary)]">
              Click &ldquo;Step Next Live Evaluation&rdquo; above to run simulated traffic and posterior evaluation on the selected campaign.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function KnockoutRoundColumn({
  round,
  isCurrentRound,
}: {
  round: KnockoutSimState["rounds"][number];
  isCurrentRound: boolean;
}) {
  return (
    <div className={`flex min-w-[280px] max-w-[320px] flex-1 flex-col gap-3 rounded-2xl border p-4 shadow-sm ${
      isCurrentRound
        ? "border-[color:var(--color-primary)] bg-[color:var(--color-surface)] ring-1 ring-[color:var(--color-primary)]/20"
        : "border-[color:var(--color-border)] bg-[color:var(--color-surface)]"
    }`}>
      <div className="flex items-center justify-between border-b border-[color:var(--color-border)] pb-2.5">
        <div>
          <h4 className="text-sm font-bold text-[color:var(--color-text-primary)]">{round.title}</h4>
          <p className="text-[11px] text-[color:var(--color-text-secondary)]">
            {round.isComplete ? "Round finalized" : "Current active round"}
          </p>
        </div>
        {round.isComplete ? (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200">
            ✓ Complete
          </span>
        ) : (
          <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 ring-1 ring-blue-200 animate-pulse">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-600" /> Live
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2.5">
        {round.variants.map((v) => (
          <KnockoutVariantPill key={v.id} variant={v} isWinner={round.winnerId === v.id} />
        ))}
      </div>
    </div>
  );
}

function KnockoutVariantPill({
  variant,
  isWinner,
}: {
  variant: KnockoutSimState["rounds"][number]["variants"][number];
  isWinner: boolean;
}) {
  const isEliminated = variant.status === "ELIMINATED";
  const hasStrike = variant.eliminationStrikes > 0 && !isEliminated;

  return (
    <div
      className={`relative flex flex-col gap-2 rounded-xl border p-3 transition-all ${
        isWinner
          ? "border-emerald-300 bg-emerald-50/60 shadow-sm"
          : isEliminated
            ? "border-gray-200 bg-gray-50/70 opacity-50"
            : hasStrike
              ? "border-amber-300 bg-amber-50/40"
              : "border-[color:var(--color-border)] bg-[color:var(--color-surface)] hover:border-[color:var(--color-primary)]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white shadow-xs"
            style={{ backgroundColor: variant.color }}
          >
            {variant.initials}
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-[color:var(--color-text-primary)]">
              {variant.name}
            </p>
            <p className="truncate text-[10px] text-[color:var(--color-text-secondary)]">
              {variant.headline}
            </p>
          </div>
        </div>

        {/* Status Badges */}
        <div className="shrink-0">
          {isWinner ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
              🏆 Winner
            </span>
          ) : isEliminated ? (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
              🚫 Out
            </span>
          ) : hasStrike ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 animate-pulse">
              ⚠️ Strike 1/2
            </span>
          ) : variant.isControl ? (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-700">
              Control
            </span>
          ) : (
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
              {variant.trafficPercent}% share
            </span>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-1.5 rounded-lg bg-[color:var(--color-surface-sunken)] p-1.5 text-center">
        <div>
          <p className="text-xs font-bold tabular-nums text-[color:var(--color-text-primary)]">
            {variant.conversionRate}%
          </p>
          <p className="text-[9px] text-[color:var(--color-text-secondary)]">CVR</p>
        </div>
        <div>
          <p className="text-xs font-bold tabular-nums text-[color:var(--color-text-primary)]">
            {variant.impressions.toLocaleString()}
          </p>
          <p className="text-[9px] text-[color:var(--color-text-secondary)]">Visitors</p>
        </div>
        <div>
          <p className="text-xs font-bold tabular-nums text-[color:var(--color-text-primary)]">
            {variant.submissions.toLocaleString()}
          </p>
          <p className="text-[9px] text-[color:var(--color-text-secondary)]">Conversions</p>
        </div>
      </div>

      {/* Posterior Probability Bar */}
      <div className="pt-0.5">
        <div className="flex items-center justify-between text-[10px] mb-1">
          <span className="text-[color:var(--color-text-secondary)]">
            Win Posterior P(best)
          </span>
          <span className={`font-mono font-bold ${variant.pBest < 0.02 && !isEliminated ? "text-amber-600" : "text-[color:var(--color-text-primary)]"}`}>
            {(variant.pBest * 100).toFixed(1)}%
          </span>
        </div>
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-[color:var(--color-surface-sunken)]">
          {/* Danger zone threshold mark at 2% */}
          <div className="absolute top-0 bottom-0 left-[2%] w-0.5 bg-red-400 z-10" title="Elimination Threshold (2.0%)" />
          <div
            className={`h-full transition-all duration-300 ${
              isWinner
                ? "bg-emerald-500"
                : variant.pBest < 0.02
                  ? "bg-red-500"
                  : "bg-[color:var(--color-primary)]"
            }`}
            style={{ width: `${Math.min(100, Math.max(isEliminated ? 0 : 2, variant.pBest * 100))}%` }}
          />
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
  diversityGoal: DiversityGoal; setDiversityGoal: (v: DiversityGoal) => void;
  busy: string | null; onRun: () => void; result: DiversityResult | null;
  runs: DiversityRunDTO[]; runsTotal: number; runsPage: number; runsLoading: boolean;
  pageSize: number;
  onLoadRuns: (page: number) => void; onDeleteRun: (id: string) => void; onClearRuns: () => void;
}) {
  const aiOff = p.aiSampleCount === 0;
  const pageCount = Math.max(1, Math.ceil(p.runsTotal / p.pageSize));

  return (
    <>
      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Slider label={`Structural variants (free): ${p.diversityN}`} min={10} max={300} step={10} value={p.diversityN} onChange={p.setDiversityN} />
            <p className="mt-1 text-xs text-[color:var(--color-text-secondary)]">
              <b>Free generation</b> draws {p.diversityN} popup <i>blueprints</i> the exact way the real engine does — same design-knob sampler, same 15-deep novelty avoid-list — but stops before any AI writes copy or renders HTML. No API calls, no cost. It answers <i>“does the structure repeat?”</i> via the metrics below; it does <b>not</b> produce viewable popups.
            </p>
          </div>
          <div>
            <Slider label={`Real AI popups: ${p.aiSampleCount} call${p.aiSampleCount === 1 ? "" : "s"}`} min={0} max={AI_MAX_CALLS} step={1} value={p.aiSampleCount} onChange={p.setAiSampleCount} />
            <p className="mt-1 text-xs text-[color:var(--color-text-secondary)]">
              {aiOff
                ? "Structural only — no AI calls, no cost. Raise this to render real, viewable popups."
                : <>Renders <b>{p.aiSampleCount * 2}</b> real popups · rough (over)estimated cost <b className="text-[color:var(--color-text-primary)]">{formatEstimatedCost(p.aiSampleCount)}</b></>}
            </p>
          </div>
        </div>

        {/* Goal: what kind of popup to actually generate */}
        <div className="mt-4">
          <Label>Generate popups for</Label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {GOAL_OPTIONS.map((g) => (
              <button
                key={g.id}
                type="button"
                title={g.hint}
                onClick={() => p.setDiversityGoal(g.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  p.diversityGoal === g.id
                    ? "bg-[color:var(--color-primary)] text-white"
                    : "border border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-[color:var(--color-text-secondary)]">
            {GOAL_OPTIONS.find((g) => g.id === p.diversityGoal)?.hint}
            {aiOff && " · applies once you render real AI popups above"}
          </p>
        </div>

        <div className="mt-4">
          <PrimaryButton disabled={p.busy !== null} onClick={p.onRun}>
            {p.busy === "diversity"
              ? "Analyzing…"
              : aiOff
                ? "Analyze diversity (free)"
                : `Generate ${p.aiSampleCount * 2} popups`}
          </PrimaryButton>
        </div>
      </Card>

      {/* Just-completed run (immediate feedback before scrolling history) */}
      {p.result && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[color:var(--color-text-primary)]">
              Latest run result
            </h3>
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
              Just completed · logged to history below
            </span>
          </div>

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
              <h3 className="mb-1 text-sm font-semibold text-[color:var(--color-text-primary)]">
                The actual generated popups — look for repetition
              </h3>
              <p className="mb-3 text-xs text-[color:var(--color-text-secondary)]">
                {p.result.goal === "MIXED"
                  ? "Goal: all three mixed — each card is tagged with the goal it was generated for."
                  : `Goal: ${GOAL_OPTIONS.find((g) => g.id === p.result!.goal)?.label ?? p.result.goal}.`}{" "}
                Previews are scaled to fit; use “Open full size” to inspect one at real browser size.
              </p>
              <PopupGrid popups={p.result.popups} />
            </div>
          )}
        </>
      )}

      {/* Durable history of generations */}
      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-[color:var(--color-text-primary)]">
            Generation diversity history{p.runsTotal > 0 && ` · ${p.runsTotal} run${p.runsTotal === 1 ? "" : "s"}`}
          </h3>
          {p.runsTotal > 0 && (
            <ConfirmButton
              label="Clear ALL"
              confirmLabel="Delete all history?"
              busy={p.busy === "cleardiversityruns"}
              disabled={p.busy !== null}
              onConfirm={p.onClearRuns}
              tone="danger"
            />
          )}
        </div>

        {p.runsLoading && p.runs.length === 0 ? (
          <Card><div className="flex items-center gap-2 text-sm text-[color:var(--color-text-secondary)]"><Spinner /> Loading history…</div></Card>
        ) : p.runs.length === 0 ? (
          <Card><p className="text-sm text-[color:var(--color-text-secondary)]">No diversity runs logged yet. Run an analysis above to start the log.</p></Card>
        ) : (
          <div className="flex flex-col gap-3">
            {p.runs.map((run, i) => (
              <DiversityRunRow
                key={run.id}
                run={run}
                runNumber={p.runsTotal - (p.runsPage * p.pageSize + i)}
                busy={p.busy}
                onDelete={() => p.onDeleteRun(run.id)}
              />
            ))}
          </div>
        )}

        {pageCount > 1 && (
          <div className="mt-3 flex items-center justify-center gap-3">
            <GhostButton disabled={p.busy !== null || p.runsPage <= 0} onClick={() => p.onLoadRuns(p.runsPage - 1)}>
              ← Newer
            </GhostButton>
            <span className="text-xs text-[color:var(--color-text-secondary)]">
              Page {p.runsPage + 1} of {pageCount}
            </span>
            <GhostButton disabled={p.busy !== null || p.runsPage >= pageCount - 1} onClick={() => p.onLoadRuns(p.runsPage + 1)}>
              Older →
            </GhostButton>
          </div>
        )}
      </div>
    </>
  );
}

function DiversityRunRow({
  run,
  runNumber,
  busy,
  onDelete,
}: {
  run: DiversityRunDTO;
  runNumber: number;
  busy: string | null;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const goalOpt = GOAL_OPTIONS.find((g) => g.id === run.goal);
  const hasPopups = run.popups && run.popups.length > 0;

  return (
    <Card>
      <div className="flex flex-col gap-3">
        {/* Header row: Run #x, date+timestamp, goal, tags, actions */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-[color:var(--color-surface-sunken)] px-2 py-0.5 text-xs font-bold text-[color:var(--color-text-primary)]">
              Run #{runNumber}
            </span>
            <span className="text-xs font-medium text-[color:var(--color-text-secondary)]">
              {formatTimestamp(run.createdAt)}
            </span>
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
              {goalOpt?.label ?? run.goal}
            </span>
            <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-[11px] font-semibold text-purple-700">
              {hasPopups ? `${run.popups.length} AI popups` : `${run.n} structural variants`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-2.5 py-1 text-xs font-medium text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-surface-sunken)]"
            >
              {expanded ? "Hide details ▲" : hasPopups ? `View details & popups (${run.popups.length}) ▼` : "View details ▼"}
            </button>
            <ConfirmButton
              label="Delete"
              confirmLabel="Confirm delete?"
              busy={busy === "deldiversityrun"}
              disabled={busy !== null}
              onConfirm={onDelete}
              tone="danger"
              small
            />
          </div>
        </div>

        {/* Quick summary strip */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[color:var(--color-text-secondary)]">
          <span>Unique: <b className={run.uniqueRate > 0.9 ? "text-emerald-600" : "text-amber-600"}>{pct(run.uniqueRate)}</b></span>
          <span>Mean dist: <b className="text-[color:var(--color-text-primary)]">{run.meanNearestNeighbor.toFixed(2)}</b></span>
          <span>Too-similar: <b className={run.tooClosePairRate < 0.05 ? "text-emerald-600" : "text-amber-600"}>{pct(run.tooClosePairRate)}</b></span>
          <span>Clones: <b className={run.exactCollisions === 0 ? "text-emerald-600" : "text-amber-600"}>{run.exactCollisions}</b></span>
          {run.copy && (
            <>
              <span>Headline overlap: <b className={run.copy.maxHeadlineSimilarity < 0.5 ? "text-emerald-600" : "text-amber-600"}>{pct(run.copy.maxHeadlineSimilarity)}</b></span>
              <span>Exact dupes: <b className={run.copy.exactHeadlineDupes === 0 ? "text-emerald-600" : "text-amber-600"}>{run.copy.exactHeadlineDupes}</b></span>
            </>
          )}
        </div>

        {/* First popup preview thumbnail preview if collapsed and has popups */}
        {!expanded && hasPopups && (
          <div className="mt-1 flex items-center gap-3 overflow-hidden rounded-lg bg-[color:var(--color-surface-sunken)] p-2">
            <div className="h-14 w-20 shrink-0 overflow-hidden rounded border border-[color:var(--color-border)]">
              <PopupFrame code={run.popups[0].generatedCode} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-[color:var(--color-text-primary)]">
                {run.popups[0].headline || "Generated popup"}
              </p>
              <p className="truncate text-[11px] text-[color:var(--color-text-secondary)]">
                {run.popups.length === 1 ? run.popups[0].subhead : `+ ${run.popups.length - 1} more popup${run.popups.length > 2 ? "s" : ""} in this run · click View details & popups to inspect all`}
              </p>
            </div>
          </div>
        )}

        {/* Expanded full details */}
        {expanded && (
          <div className="mt-3 flex flex-col gap-4 border-t border-[color:var(--color-border)] pt-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MiniStat label="Unique structures" value={pct(run.uniqueRate)} />
              <MiniStat label="Mean neighbour dist" value={run.meanNearestNeighbor.toFixed(2)} />
              <MiniStat label="Too-similar pairs" value={pct(run.tooClosePairRate)} />
              <MiniStat label="Exact clones" value={String(run.exactCollisions)} />
            </div>

            {/* Knobs */}
            {run.knobs && Object.keys(run.knobs).length > 0 && (
              <div className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-3">
                <h4 className="mb-2 text-xs font-semibold text-[color:var(--color-text-primary)]">
                  Design knob coverage
                </h4>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {Object.entries(run.knobs).map(([knob, cov]) => (
                    <div key={knob}>
                      <div className="mb-1 flex items-center justify-between text-[11px]">
                        <span className="font-medium text-[color:var(--color-text-primary)]">{knob}</span>
                        <span className="text-[color:var(--color-text-secondary)]">top: {cov.topValue} ({pct(cov.topShare)})</span>
                      </div>
                      <ProgressBar value={cov.coverage} tone={cov.coverage >= 0.66 ? "ok" : "warn"} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Copy stats */}
            {run.copy && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MiniStat label="Exact headline dupes" value={String(run.copy.exactHeadlineDupes)} />
                <MiniStat label="Max headline overlap" value={pct(run.copy.maxHeadlineSimilarity)} />
                <MiniStat label="Subhead restates" value={pct(run.copy.subheadRestateRate)} />
                <MiniStat label="Banned openers" value={pct(run.copy.bannedOpenerRate)} />
              </div>
            )}

            {/* Popups */}
            {hasPopups && (
              <div>
                <h4 className="mb-2 text-xs font-semibold text-[color:var(--color-text-primary)]">
                  Generated popups ({run.popups.length})
                </h4>
                <PopupGrid popups={run.popups} />
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

// ─── Timing ──────────────────────────────────────────────────────────────────

function TimingSection(p: {
  busy: string | null; campaignId: string; timedStatus: string | null;
  timing: TimedGenerationStatus | null; onRun: () => void;
  runs: TimingRunDTO[]; runsTotal: number; runsPage: number; runsLoading: boolean;
  pageSize: number;
  onLoadRuns: (page: number) => void; onDeleteRun: (id: string) => void; onClearRuns: () => void;
}) {
  const running = p.busy === "timedgen";
  const pageCount = Math.max(1, Math.ceil(p.runsTotal / p.pageSize));

  return (
    <>
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <PrimaryButton disabled={p.busy !== null || !p.campaignId} onClick={p.onRun}>
            {running ? "Generating & timing…" : "Time a fresh generation"}
          </PrimaryButton>
          {running && (
            <span className="flex items-center gap-2 text-sm text-[color:var(--color-text-secondary)]">
              <Spinner /> {p.timedStatus}
            </span>
          )}
          {!running && p.timedStatus && (
            <span className="text-sm text-[color:var(--color-text-secondary)]">{p.timedStatus}</span>
          )}
        </div>
        <p className="mt-2 text-xs text-[color:var(--color-text-secondary)]">
          Each run clones the selected campaign, times the real generation pipeline, logs the result to the
          history below, then deletes the throwaway <code>[⏱ timing test]</code> campaign automatically.
        </p>
      </Card>

      {/* Just-completed run (immediate feedback before it's just another history row). */}
      {p.timing?.trace && <LatestRunBreakdown timing={p.timing} />}

      {/* Durable history */}
      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-[color:var(--color-text-primary)]">
            Generation-timing history{p.runsTotal > 0 && ` · ${p.runsTotal} run${p.runsTotal === 1 ? "" : "s"}`}
          </h3>
          {p.runsTotal > 0 && (
            <ConfirmButton
              label="Clear ALL"
              confirmLabel="Delete all history?"
              busy={p.busy === "clearruns"}
              disabled={p.busy !== null}
              onConfirm={p.onClearRuns}
              tone="danger"
            />
          )}
        </div>

        {p.runsLoading && p.runs.length === 0 ? (
          <Card><div className="flex items-center gap-2 text-sm text-[color:var(--color-text-secondary)]"><Spinner /> Loading history…</div></Card>
        ) : p.runs.length === 0 ? (
          <Card><p className="text-sm text-[color:var(--color-text-secondary)]">No timed runs yet. Run one above to start the log.</p></Card>
        ) : (
          <div className="flex flex-col gap-3">
            {p.runs.map((run, i) => (
              <RunRow
                key={run.id}
                run={run}
                runNumber={p.runsTotal - (p.runsPage * p.pageSize + i)}
                busy={p.busy}
                onDelete={() => p.onDeleteRun(run.id)}
              />
            ))}
          </div>
        )}

        {pageCount > 1 && (
          <div className="mt-3 flex items-center justify-center gap-3">
            <GhostButton disabled={p.busy !== null || p.runsPage <= 0} onClick={() => p.onLoadRuns(p.runsPage - 1)}>
              ← Newer
            </GhostButton>
            <span className="text-xs text-[color:var(--color-text-secondary)]">
              Page {p.runsPage + 1} of {pageCount}
            </span>
            <GhostButton disabled={p.busy !== null || p.runsPage >= pageCount - 1} onClick={() => p.onLoadRuns(p.runsPage + 1)}>
              Older →
            </GhostButton>
          </div>
        )}
      </div>
    </>
  );
}

function stageRows(t: {
  queueMs: number | null; initializeMs: number | null; aiThinkingMs: number | null; savingMs: number | null;
}): { label: string; ms: number | null }[] {
  return [
    { label: "Queue wait", ms: t.queueMs },
    { label: "Initialize", ms: t.initializeMs },
    { label: "AI thinking", ms: t.aiThinkingMs },
    { label: "Saving", ms: t.savingMs },
  ];
}

function LatestRunBreakdown({ timing }: { timing: TimedGenerationStatus }) {
  const trace = timing.trace!;
  const stages = stageRows(trace);
  const maxMs = Math.max(1, ...stages.map((s) => s.ms ?? 0));
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-[color:var(--color-text-primary)]">Latest run — where the time went</h3>
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
      {timing.popups.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-sm">
          <PopupFrame code={timing.popups[0].generatedCode} />
          <div className="flex items-center justify-between gap-2 border-t border-[color:var(--color-border)] p-3">
            <span className="truncate text-sm font-medium text-[color:var(--color-text-primary)]">
              {timing.popups[0].headline || "Generated popup"}
            </span>
            <OpenFullButton code={timing.popups[0].generatedCode} />
          </div>
        </div>
      )}
    </div>
  );
}

function RunRow({
  run,
  runNumber,
  busy,
  onDelete,
}: {
  run: TimingRunDTO;
  runNumber: number;
  busy: string | null;
  onDelete: () => void;
}) {
  const stages = stageRows(run);
  const maxMs = Math.max(1, ...stages.map((s) => s.ms ?? 0));
  return (
    <Card>
      <div className="flex flex-col gap-4 sm:flex-row">
        {/* Popup thumbnail */}
        <div className="w-full shrink-0 overflow-hidden rounded-lg border border-[color:var(--color-border)] sm:w-44">
          <PopupFrame code={run.generatedCode ?? ""} />
        </div>

        {/* Meta + timing */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-[color:var(--color-surface-sunken)] px-2 py-0.5 text-xs font-bold text-[color:var(--color-text-primary)]">
                Run #{runNumber}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  run.succeeded ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                }`}
              >
                {run.succeeded ? "success" : "failed"}
              </span>
              {run.totalMs != null && (
                <span className="text-sm font-bold text-[color:var(--color-text-primary)]">{secs(run.totalMs)} total</span>
              )}
            </div>
            <ConfirmButton
              label="Delete"
              confirmLabel="Confirm delete?"
              busy={busy === "delrun"}
              disabled={busy !== null}
              onConfirm={onDelete}
              tone="danger"
              small
            />
          </div>

          <p className="mt-1 truncate text-xs text-[color:var(--color-text-secondary)]">
            {formatTimestamp(run.createdAt)} · {run.templateName}
          </p>
          {run.headline && (
            <p className="mt-0.5 truncate text-sm font-medium text-[color:var(--color-text-primary)]">{run.headline}</p>
          )}
          {run.errorMessage && (
            <p className="mt-1 truncate text-xs text-red-600" title={run.errorMessage}>{run.errorMessage}</p>
          )}

          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
            {stages.map((s) => (
              <div key={s.label}>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[color:var(--color-text-secondary)]">{s.label}</span>
                  <span className="font-mono text-[color:var(--color-text-primary)]">{secs(s.ms)}</span>
                </div>
                <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-[color:var(--color-surface-sunken)]">
                  <div className="h-full rounded-full bg-[color:var(--color-primary)]" style={{ width: `${((s.ms ?? 0) / maxMs) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2">
            <OpenFullButton code={run.generatedCode ?? ""} />
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── Shared bits ─────────────────────────────────────────────────────────────

/**
 * Renders a popup the way it actually appears: the generated HTML is a
 * full-viewport overlay with a centered modal, so we render it into a real
 * desktop-sized viewport and scale that whole viewport down to fit the card.
 * That shows the entire popup (dimmed backdrop + modal, nothing clipped)
 * instead of cropping a corner of a squished full-screen overlay.
 */
function PopupFrame({
  code,
  naturalWidth = 900,
  naturalHeight = 620,
}: {
  code: string;
  naturalWidth?: number;
  naturalHeight?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setWidth(entries[0]?.contentRect.width ?? 0);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = width > 0 ? width / naturalWidth : 0;

  if (!code) {
    return (
      <div
        className="grid place-items-center bg-[color:var(--color-surface-sunken)] text-xs text-[color:var(--color-text-secondary)]"
        style={{ aspectRatio: `${naturalWidth} / ${naturalHeight}` }}
      >
        No preview available
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden bg-white"
      style={{ aspectRatio: `${naturalWidth} / ${naturalHeight}` }}
    >
      {scale > 0 && (
        <iframe
          srcDoc={code}
          title="Popup preview"
          sandbox="allow-scripts allow-same-origin"
          scrolling="no"
          className="pointer-events-none border-0 bg-white"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: naturalWidth,
            height: naturalHeight,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        />
      )}
    </div>
  );
}

/** Opens a generated popup's raw HTML in a new tab at real browser size. */
function openFullSize(code: string) {
  if (!code) return;
  const blob = new Blob([code], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function OpenFullButton({ code }: { code: string }) {
  if (!code) return null;
  return (
    <button
      type="button"
      onClick={() => openFullSize(code)}
      className="text-[11px] font-medium text-[color:var(--color-primary)] hover:underline"
    >
      Open full size ↗
    </button>
  );
}

function PopupGrid({ popups }: { popups: RenderedPopup[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {popups.map((pop, i) => (
        <div key={i} className="overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-sm">
          <div className="relative">
            <PopupFrame code={pop.generatedCode} />
            {pop.testAxis && (
              <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                {pop.testAxis}
              </span>
            )}
          </div>
          <div className="border-t border-[color:var(--color-border)] p-2.5">
            <div className="flex items-start justify-between gap-2">
              <p className="truncate text-xs font-semibold text-[color:var(--color-text-primary)]">{pop.headline || "—"}</p>
              <OpenFullButton code={pop.generatedCode} />
            </div>
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

function Spinner() {
  return (
    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-[color:var(--color-border)] border-t-[color:var(--color-primary)]" />
  );
}

/**
 * Two-step delete: first click arms (turns red + shows confirmLabel), second
 * click within 4s fires onConfirm. Avoids native confirm() dialogs while still
 * guarding destructive actions.
 */
function ConfirmButton({
  label,
  confirmLabel,
  busy,
  disabled,
  onConfirm,
  tone,
  small,
}: {
  label: string;
  confirmLabel: string;
  busy?: boolean;
  disabled?: boolean;
  onConfirm: () => void;
  tone?: "danger";
  small?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  const size = small ? "px-2.5 py-1 text-xs" : "px-4 py-2 text-sm";
  return (
    <button
      type="button"
      disabled={disabled || busy}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else {
          setArmed(true);
        }
      }}
      className={`rounded-lg font-semibold transition-colors disabled:opacity-50 ${size} ${
        armed
          ? "bg-red-600 text-white hover:bg-red-700"
          : tone === "danger"
            ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
            : "border border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-surface-sunken)]"
      }`}
    >
      {busy ? "Working…" : armed ? confirmLabel : label}
    </button>
  );
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function pct(v: number): string {
  return `${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%`;
}
function secs(ms: number | null): string {
  return typeof ms === "number" ? `${(ms / 1000).toFixed(1)}s` : "—";
}
