/**
 * lib/testing/testingActions.ts
 *
 * DB / generation / bandit orchestration for the superadmin Tester Toolkit.
 * The pure engines live in trafficSim.ts, diversityMetrics.ts and genTiming.ts;
 * this module is the thin, side-effecting wrapper the API route calls.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from ".prisma/client";
import { inngest } from "@/lib/inngest/client";
import { recomputeCampaignAllocation, detectSampleRatioMismatch } from "@/lib/bandit";
import {
  planWave,
  splitVolumeIntoWaves,
  resolveWinnerId,
  summarizeEvents,
  type SimConfig,
  type SimArm,
  type SimEvent,
} from "@/lib/testing/trafficSim";
import {
  structuralStats,
  knobCoverage,
  copyStats,
  type CopySample,
  type KnobCoverage,
} from "@/lib/testing/diversityMetrics";
import { summarizeTraces, type TraceRow } from "@/lib/testing/genTiming";
import { buildVariantBriefs, hashSeed } from "@/lib/designBrief";
import {
  ART_DIRECTIONS,
  TIMER_MODES,
  THEMES,
  BUTTON_SHAPES,
  DENSITIES,
  STEP_FLOWS,
} from "@/lib/popupDna";
import {
  generatePopupWithVariants,
  buildPopupInput,
  brandTokensFromAnalyzeResult,
  computedStylesFromAnalyzeResult,
  existingPopupFromAnalyzeResult,
  fetchNoveltyMemory,
} from "@/lib/popupGeneration";
import { renderPopupTemplate } from "@/lib/templates";

/**
 * Turns a generated popup spec into the same self-contained HTML the widget
 * ships, so the Tester dashboard can render it in an iframe instead of dumping
 * JSON. Mirrors the mapping generateCampaign.ts uses when it persists a variant.
 */
// PopupSpec is a broad generated shape; we read a known subset defensively.
function renderSpecToHtml(spec: any): string {
  try {
    return renderPopupTemplate(spec?.template_id, {
      headline: spec?.headline,
      subhead: spec?.subhead,
      cta: spec?.cta,
      primaryColor: spec?.design_tokens?.palette?.[0],
      couponCode: spec?.coupon_code,
      goal: "BOTH",
      layoutStyle: spec?.layout_style,
      imageUrl: spec?.image_url,
      dna: spec?.dna,
      brandFonts: spec?.design_tokens,
      palette: spec?.design_tokens?.palette,
      discountPercent: spec?.discount_percent,
      redirectUrl: null,
      captureFields: ["email"],
    });
  } catch (err) {
    console.error("[testing] renderSpecToHtml failed", err);
    return "";
  }
}

export type RenderedPopup = {
  generatedCode: string;
  headline: string;
  subhead: string;
  cta: string;
  primaryColor: string;
  testAxis?: string | null;
};

// The account's real novelty lookback is 15 (NOVELTY_LOOKBACK in
// popupGeneration.ts); mirror it so the harness measures the same avoid-window
// production actually applies.
const NOVELTY_WINDOW = 15;

// ─── Traffic simulation ──────────────────────────────────────────────────────

type WaveResult = {
  wave: number;
  volume: number;
  perArm: Record<string, { impressions: number; submissions: number; dismissals: number }>;
  allocation: { id: string; name: string; trafficPercent: number }[];
};

export type TrafficSimVariant = RenderedPopup & {
  id: string;
  name: string;
  trafficPercent: number;
  impressions: number;
  submissions: number;
  cvr: number;
  isWinner: boolean;
};

export type TrafficSimResult = {
  campaignId: string;
  trueWinnerId: string | null;
  totalImpressions: number;
  totalSubmissions: number;
  waves: WaveResult[];
  variants: TrafficSimVariant[];
  srm: { chiSquare: number; mismatch: boolean; total: number };
  knockoutTriggered: boolean;
};

async function activeArms(campaignId: string): Promise<{ id: string; name: string; trafficPercent: number }[]> {
  return prisma.variant.findMany({
    where: { campaignId, status: "ACTIVE" },
    select: { id: true, name: true, trafficPercent: true },
    orderBy: { createdAt: "asc" },
  });
}

function toSimEventRows(events: SimEvent[]): Prisma.CampaignEventCreateManyInput[] {
  return events.map((e) => ({
    variantId: e.variantId,
    type: e.type,
    details: {
      sim: true,
      device: e.device,
      intent: e.intent,
      ...(typeof e.dismissAfterMs === "number" ? { dismissAfterMs: e.dismissAfterMs } : {}),
    } as Prisma.InputJsonValue,
  }));
}

export async function runTrafficSimulation(
  campaignId: string,
  config: SimConfig,
  { triggerKnockout = true }: { triggerKnockout?: boolean } = {},
): Promise<TrafficSimResult> {
  const initialArms = await activeArms(campaignId);
  if (initialArms.length === 0) {
    throw new Error("Campaign has no active variants to simulate against");
  }

  const simArms: SimArm[] = initialArms.map((a) => ({ id: a.id, trafficPercent: a.trafficPercent }));
  const trueWinnerId = resolveWinnerId(config, simArms);
  const waveVolumes = splitVolumeIntoWaves(config.volume, config.waves);

  const waves: WaveResult[] = [];
  let totalImpressions = 0;
  let totalSubmissions = 0;

  for (let w = 0; w < waveVolumes.length; w++) {
    // Read the CURRENT allocation fresh each wave - it shifts as the bandit
    // reallocates between waves, and the sim must follow the real split.
    const current = await activeArms(campaignId);
    if (current.length === 0) break; // all arms eliminated mid-run - nothing to simulate
    const arms: SimArm[] = current.map((a) => ({ id: a.id, trafficPercent: a.trafficPercent }));

    const events = planWave(config, arms, waveVolumes[w], w);
    if (events.length > 0) {
      await prisma.campaignEvent.createMany({ data: toSimEventRows(events) });
    }

    // Force past the 30s throttle - all waves run inside this one request.
    await recomputeCampaignAllocation(current[0].id, { force: true }).catch((err) => {
      console.error("[testing] recompute after wave failed", err);
    });

    const rollup = summarizeEvents(events);
    const perArm: WaveResult["perArm"] = {};
    for (const [id, s] of Object.entries(rollup)) {
      perArm[id] = { impressions: s.impressions, submissions: s.submissions, dismissals: s.dismissals };
      totalImpressions += s.impressions;
      totalSubmissions += s.submissions;
    }

    const allocation = await activeArms(campaignId);
    waves.push({ wave: w + 1, volume: waveVolumes[w], perArm, allocation });
  }

  // Final SRM check over everything simulated this run.
  const finalArms = await activeArms(campaignId);
  const observed = await prisma.campaignEvent.groupBy({
    by: ["variantId"],
    where: { variantId: { in: finalArms.map((a) => a.id) }, type: "IMPRESSION" },
    _count: { _all: true },
  });
  const impressionsById = new Map(observed.map((o) => [o.variantId, o._count._all]));
  const srm = detectSampleRatioMismatch(
    finalArms.map((a) => ({
      id: a.id,
      impressions: impressionsById.get(a.id) ?? 0,
      trafficPercent: a.trafficPercent,
    })),
  );

  // Per-variant rendered popups + their measured stats (sim events only), so
  // the dashboard shows the actual popups competing rather than a table.
  const submissionCounts = await prisma.campaignEvent.groupBy({
    by: ["variantId"],
    where: {
      variantId: { in: finalArms.map((a) => a.id) },
      type: "SUBMISSION",
      details: { path: ["sim"], equals: true },
    },
    _count: { _all: true },
  });
  const simSubmissionsById = new Map(submissionCounts.map((s) => [s.variantId, s._count._all]));
  const simImpressionCounts = await prisma.campaignEvent.groupBy({
    by: ["variantId"],
    where: {
      variantId: { in: finalArms.map((a) => a.id) },
      type: "IMPRESSION",
      details: { path: ["sim"], equals: true },
    },
    _count: { _all: true },
  });
  const simImpressionsById = new Map(simImpressionCounts.map((s) => [s.variantId, s._count._all]));

  const variantRows = await prisma.variant.findMany({
    where: { id: { in: finalArms.map((a) => a.id) } },
    select: { id: true, name: true, trafficPercent: true, generatedCode: true, design: true },
  });
  const variants: TrafficSimVariant[] = variantRows.map((v) => {
    const design = (v.design ?? {}) as { headline?: string; ctaText?: string; primaryColor?: string };
    const impressions = simImpressionsById.get(v.id) ?? 0;
    const submissions = simSubmissionsById.get(v.id) ?? 0;
    return {
      id: v.id,
      name: v.name,
      trafficPercent: v.trafficPercent,
      impressions,
      submissions,
      cvr: impressions > 0 ? submissions / impressions : 0,
      isWinner: v.id === trueWinnerId,
      generatedCode: v.generatedCode ?? "",
      headline: design.headline ?? v.name,
      subhead: "",
      cta: design.ctaText ?? "",
      primaryColor: design.primaryColor ?? "#111827",
    };
  });

  let knockoutTriggered = false;
  if (triggerKnockout) {
    await inngest
      .send({ name: "campaign.evaluate", data: { campaignId } })
      .then(() => {
        knockoutTriggered = true;
      })
      .catch((err) => console.error("[testing] campaign.evaluate send failed", err));
  }

  return {
    campaignId,
    trueWinnerId,
    totalImpressions,
    totalSubmissions,
    waves,
    variants,
    srm: { chiSquare: srm.chiSquare, mismatch: srm.mismatch, total: srm.total },
    knockoutTriggered,
  };
}

/**
 * Removes every simulated event from a campaign (details.sim === true) so a test
 * run never permanently pollutes the campaign's real analytics, then rebalances.
 */
export async function clearSimData(campaignId: string): Promise<{ removed: number }> {
  const variants = await prisma.variant.findMany({ where: { campaignId }, select: { id: true } });
  const ids = variants.map((v) => v.id);
  if (ids.length === 0) return { removed: 0 };

  const result = await prisma.campaignEvent.deleteMany({
    where: { variantId: { in: ids }, details: { path: ["sim"], equals: true } },
  });

  await recomputeCampaignAllocation(ids[0], { force: true }).catch(() => {});
  return { removed: result.count };
}

// ─── Diversity harness ───────────────────────────────────────────────────────

const KNOB_SPACES: Record<string, readonly string[]> = {
  template_id: ["split-screen", "corner-toast", "fullscreen-takeover"],
  art_direction: ART_DIRECTIONS,
  timer_mode: TIMER_MODES,
  theme: THEMES,
  button_shape: BUTTON_SHAPES,
  density: DENSITIES,
  step_flow: STEP_FLOWS,
};

export type DiversityResult = {
  n: number;
  structural: ReturnType<typeof structuralStats>;
  knobs: Record<string, KnobCoverage>;
  copy: (ReturnType<typeof copyStats> & { generationErrors: number }) | null;
  /** Real rendered popups from the AI tier - the whole point of the visual page. */
  popups: RenderedPopup[];
  aiCallsRequested: number;
};

/**
 * Tier A (free, all N): draw N briefs the way generation does across successive
 * rounds - feeding each draw's fingerprint forward into the novelty avoid-list -
 * and measure structural diversity + per-knob coverage.
 *
 * Tier B (opt-in, real AI): make `aiSampleCount` real generation calls and
 * measure copy repetition. Each call yields 2 specs (baseline + 1 variant).
 */
export async function runDiversityAnalysis(opts: {
  n: number;
  aiSampleCount: number;
  seed?: number;
  campaignId?: string;
}): Promise<DiversityResult> {
  const n = Math.max(2, Math.min(500, Math.floor(opts.n)));
  const baseSeed = opts.seed ?? hashSeed("diversity", Date.now());

  // ── Tier A: structural ──
  const fingerprints: string[] = [];
  const knobDraws: Record<string, string>[] = [];
  let avoid: string[] = [];
  let iter = 0;
  while (fingerprints.length < n && iter < n + 50) {
    const { control, variants } = buildVariantBriefs({
      seed: hashSeed(baseSeed, iter),
      variantCount: 2,
      mode: "explore",
      avoid,
    });
    for (const b of [control, ...variants]) {
      fingerprints.push(b.fingerprint);
      knobDraws.push(b.locked as unknown as Record<string, string>);
      avoid = [...avoid, b.fingerprint].slice(-NOVELTY_WINDOW);
    }
    iter++;
  }
  fingerprints.length = n;
  knobDraws.length = n;

  const structural = structuralStats(fingerprints);
  const knobs: Record<string, KnobCoverage> = {};
  for (const [knob, space] of Object.entries(KNOB_SPACES)) {
    knobs[knob] = knobCoverage(
      knobDraws.map((d) => String(d[knob])),
      space,
    );
  }

  // ── Tier B: copy (real AI) ──
  let copy: DiversityResult["copy"] = null;
  const popups: RenderedPopup[] = [];
  const aiCalls = Math.max(0, Math.floor(opts.aiSampleCount));
  if (aiCalls > 0) {
    const { industry, domain, accountId } = await resolveDiversityContext(opts.campaignId);
    const brandTokens = await brandTokensFromAnalyzeResult({ industry, storeName: domain });
    const computedStyles = await computedStylesFromAnalyzeResult({ industry });
    const existingPopup = existingPopupFromAnalyzeResult({ popup: { found: false, description: "" } });
    const novelty = accountId
      ? await fetchNoveltyMemory(accountId)
      : { recentHeadlines: [], recentFingerprints: [] };

    const samples: CopySample[] = [];
    let generationErrors = 0;

    for (let i = 0; i < aiCalls; i++) {
      try {
        const briefs = buildVariantBriefs({
          seed: hashSeed(baseSeed, "ai", i),
          variantCount: 1,
          mode: "explore",
          avoid: novelty.recentFingerprints,
        });
        const input = buildPopupInput({
          domain,
          category: industry,
          brandTokens,
          existingPopup,
          computedStyles,
          analyticsVariants: [],
          variantCount: 1,
          multivariate: false,
          testingMode: "explore",
          novelty,
        });
        const output = await generatePopupWithVariants(input, briefs);
        for (const spec of [output.baseline.spec, ...output.variants.map((v) => v.spec)]) {
          samples.push({
            headline: String(spec.headline ?? ""),
            subhead: String(spec.subhead ?? ""),
            cta: String(spec.cta ?? ""),
          });
          popups.push({
            generatedCode: renderSpecToHtml(spec),
            headline: String(spec.headline ?? ""),
            subhead: String(spec.subhead ?? ""),
            cta: String(spec.cta ?? ""),
            primaryColor: String(spec.design_tokens?.palette?.[0] ?? "#111827"),
          });
        }
      } catch (err) {
        generationErrors += 1;
        console.error(`[testing] diversity AI sample ${i} failed`, err);
      }
    }

    copy = { ...copyStats(samples), generationErrors };
  }

  return { n, structural, knobs, copy, popups, aiCallsRequested: aiCalls };
}

async function resolveDiversityContext(
  campaignId?: string,
): Promise<{ industry: string; domain: string; accountId: string | null }> {
  const fallback = { industry: "Ecommerce / Retail", domain: "example.com", accountId: null };
  if (!campaignId) return fallback;
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: {
      accountId: true,
      account: { select: { industry: true } },
      website: { select: { url: true } },
    },
  });
  if (!campaign) return fallback;
  let domain = fallback.domain;
  try {
    if (campaign.website?.url) domain = new URL(campaign.website.url).hostname.replace(/^www\./, "");
  } catch {}
  return {
    industry: campaign.account.industry ?? fallback.industry,
    domain,
    accountId: campaign.accountId,
  };
}

// ─── Live timed generation ───────────────────────────────────────────────────

const TIMING_TEST_PREFIX = "[⏱ timing test]";

/**
 * Actually times a FRESH generation, rather than reading past traces. Clones a
 * chosen campaign's generationContext into a brand-new throwaway campaign and
 * kicks the real generateCampaign pipeline; the client then polls
 * timedGenerationStatus until the GenerationTrace lands. The clone is named with
 * TIMING_TEST_PREFIX so deleteTestCampaign can only ever remove our own probes.
 *
 * This is a real generation: it creates variants + a reward and counts one unit
 * of the account's AI budget. Superadmin-only, and cleaned up by the caller.
 */
export async function runTimedGeneration(templateCampaignId: string): Promise<{ campaignId: string }> {
  const template = await prisma.campaign.findUnique({
    where: { id: templateCampaignId },
    select: { accountId: true, websiteId: true, generationContext: true, name: true },
  });
  if (!template) throw new Error("Template campaign not found");
  if (!template.generationContext) {
    throw new Error("That campaign has no generationContext to clone - pick one created via the normal flow");
  }

  const created = await prisma.campaign.create({
    data: {
      accountId: template.accountId,
      websiteId: template.websiteId,
      name: `${TIMING_TEST_PREFIX} ${template.name}`.slice(0, 120),
      type: "FORM",
      status: "GENERATING",
      generationStage: "QUEUED",
      generationContext: template.generationContext as Prisma.InputJsonValue,
    },
    select: { id: true },
  });

  await inngest.send({
    name: "campaign.generate",
    data: { campaignId: created.id, enqueuedAt: Date.now() },
  });
  return { campaignId: created.id };
}

export type TimedGenerationStatus = {
  status: string;
  generationStage: string | null;
  lastError: string | null;
  trace: GenTimingResult["recent"][number] | null;
  popups: RenderedPopup[];
};

/** Polled by the client while a timed generation runs. */
export async function timedGenerationStatus(campaignId: string): Promise<TimedGenerationStatus> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { status: true, generationStage: true, lastError: true },
  });
  if (!campaign) throw new Error("Timing campaign not found");

  const row = await prisma.generationTrace.findFirst({
    where: { campaignId },
    orderBy: { createdAt: "desc" },
  });

  // Once it's produced popups, hand them back so the page renders what was
  // actually generated alongside the timing breakdown.
  let popups: RenderedPopup[] = [];
  if (campaign.status === "ACTIVE") {
    const vs = await prisma.variant.findMany({
      where: { campaignId, status: "ACTIVE" },
      select: { name: true, generatedCode: true, design: true },
      orderBy: { createdAt: "asc" },
    });
    popups = vs.map((v) => {
      const design = (v.design ?? {}) as { headline?: string; body?: string; ctaText?: string; primaryColor?: string };
      return {
        generatedCode: v.generatedCode ?? "",
        headline: design.headline ?? v.name,
        subhead: design.body ?? "",
        cta: design.ctaText ?? "",
        primaryColor: design.primaryColor ?? "#111827",
      };
    });
  }

  return {
    popups,
    status: campaign.status,
    generationStage: campaign.generationStage,
    lastError: campaign.lastError,
    trace: row
      ? {
          campaignId: row.campaignId,
          round: row.round,
          kind: row.kind,
          succeeded: row.succeeded,
          createdAt: row.createdAt.toISOString(),
          queueMs: row.queueMs,
          initializeMs: row.initializeMs,
          aiThinkingMs: row.aiThinkingMs,
          structuringMs: row.structuringMs,
          savingMs: row.savingMs,
          totalMs: row.totalMs,
        }
      : null,
  };
}

/** Hard-deletes a timing-test throwaway campaign. Refuses anything else. */
export async function deleteTestCampaign(campaignId: string): Promise<{ deleted: boolean }> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { name: true },
  });
  if (!campaign) return { deleted: false };
  if (!campaign.name.startsWith(TIMING_TEST_PREFIX)) {
    throw new Error("Refusing to delete a campaign that is not a timing-test probe");
  }
  await prisma.campaign.delete({ where: { id: campaignId } });
  return { deleted: true };
}

// ─── Generation timing (history) ─────────────────────────────────────────────

export type GenTimingResult = {
  summary: ReturnType<typeof summarizeTraces>;
  recent: {
    campaignId: string;
    round: number;
    kind: string;
    succeeded: boolean;
    createdAt: string;
    queueMs: number | null;
    initializeMs: number | null;
    aiThinkingMs: number | null;
    structuringMs: number | null;
    savingMs: number | null;
    totalMs: number | null;
  }[];
};

export async function getGenTimingSummary(
  campaignId?: string,
  limit = 50,
): Promise<GenTimingResult> {
  const rows = await prisma.generationTrace.findMany({
    where: campaignId ? { campaignId } : undefined,
    orderBy: { createdAt: "desc" },
    take: Math.max(1, Math.min(200, limit)),
  });

  const traceRows: TraceRow[] = rows.map((r) => ({
    queueMs: r.queueMs,
    initializeMs: r.initializeMs,
    aiThinkingMs: r.aiThinkingMs,
    structuringMs: r.structuringMs,
    savingMs: r.savingMs,
    totalMs: r.totalMs,
  }));

  return {
    summary: summarizeTraces(traceRows),
    recent: rows.map((r) => ({
      campaignId: r.campaignId,
      round: r.round,
      kind: r.kind,
      succeeded: r.succeeded,
      createdAt: r.createdAt.toISOString(),
      queueMs: r.queueMs,
      initializeMs: r.initializeMs,
      aiThinkingMs: r.aiThinkingMs,
      structuringMs: r.structuringMs,
      savingMs: r.savingMs,
      totalMs: r.totalMs,
    })),
  };
}
