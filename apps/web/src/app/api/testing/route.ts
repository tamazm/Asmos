import { currentUser } from "@/lib/auth-adapter";
import { isSuperadminEmail } from "@/lib/superadmin";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/lib/inngest/client";
import { recomputeCampaignAllocation } from "@/lib/bandit";
import {
  runTrafficSimulation,
  clearSimData,
  runDiversityAnalysis,
  getGenTimingSummary,
} from "@/lib/testing/testingActions";
import type { SimConfig, Device, Intent } from "@/lib/testing/trafficSim";

// Superadmin-only test harness for the knockout/bandit + generation systems -
// lets you skip the real-world wait for impressions to accumulate and probe
// generation diversity/timing. See components/TesterToolkit.tsx for the UI.
// Every action below is gated by requireSuperadmin(); the client component does
// no auth of its own.
async function requireSuperadmin() {
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!isSuperadminEmail(email)) {
    throw new Error("Unauthorized");
  }
}

type Body = {
  action?:
    | "inject"
    | "trigger_knockout"
    | "simulate_traffic"
    | "clear_sim_data"
    | "analyze_diversity"
    | "gen_timing";
  variantId?: string;
  mockCount?: number;
  campaignId?: string;
  sim?: Partial<{
    volume: number;
    baseCvr: number;
    winnerLiftPct: number;
    trueWinnerId: string;
    fastDismissRate: number;
    deviceMix: Record<Device, number>;
    intentMix: Record<Intent, number>;
    waves: number;
  }>;
  diversity?: { n?: number; aiSampleCount?: number };
};

const clamp = (v: unknown, lo: number, hi: number, fallback: number): number => {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
};

export async function POST(request: Request) {
  try {
    await requireSuperadmin();
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;

  // ── Diversity + timing: campaign-optional, handle before the variant gate ──
  if (body.action === "analyze_diversity") {
    const result = await runDiversityAnalysis({
      n: clamp(body.diversity?.n, 2, 500, 100),
      aiSampleCount: clamp(body.diversity?.aiSampleCount, 0, 50, 0),
      campaignId: body.campaignId,
    });
    return Response.json({ ok: true, diversity: result });
  }

  if (body.action === "gen_timing") {
    const result = await getGenTimingSummary(body.campaignId);
    return Response.json({ ok: true, timing: result });
  }

  // ── Campaign-scoped simulation ──
  if (body.action === "simulate_traffic" || body.action === "clear_sim_data") {
    let campaignId = body.campaignId;
    if (!campaignId && body.variantId) {
      const v = await prisma.variant.findUnique({
        where: { id: body.variantId },
        select: { campaignId: true },
      });
      campaignId = v?.campaignId;
    }
    if (!campaignId) {
      return Response.json({ error: "campaignId (or variantId) is required" }, { status: 400 });
    }

    if (body.action === "clear_sim_data") {
      const { removed } = await clearSimData(campaignId);
      return Response.json({ ok: true, removed });
    }

    const config: SimConfig = {
      seed: Math.floor(Math.random() * 2 ** 31),
      volume: clamp(body.sim?.volume, 10, 100_000, 2000),
      baseCvr: clamp(body.sim?.baseCvr, 0.001, 0.5, 0.04),
      winnerLiftPct: clamp(body.sim?.winnerLiftPct, 0, 500, 50),
      trueWinnerId: body.sim?.trueWinnerId,
      fastDismissRate: clamp(body.sim?.fastDismissRate, 0, 1, 0.2),
      deviceMix: body.sim?.deviceMix ?? { mobile: 60, desktop: 35, tablet: 5 },
      intentMix: body.sim?.intentMix ?? { browsing: 60, high_intent: 25, exit: 15 },
      waves: clamp(body.sim?.waves, 1, 50, 5),
    };

    try {
      const result = await runTrafficSimulation(campaignId, config);
      return Response.json({ ok: true, simulation: result });
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : "Simulation failed" },
        { status: 400 },
      );
    }
  }

  // ── Legacy variant-scoped actions (inject / trigger_knockout) ──
  if (!body.variantId) {
    return Response.json({ error: "variantId is required" }, { status: 400 });
  }

  const variant = await prisma.variant.findUnique({
    where: { id: body.variantId },
    select: { id: true, campaignId: true },
  });
  if (!variant) {
    return Response.json({ error: "Variant not found" }, { status: 404 });
  }

  if (body.action === "trigger_knockout") {
    await inngest.send({ name: "campaign.evaluate", data: { campaignId: variant.campaignId } });
    return Response.json({ ok: true, message: "campaign.evaluate sent", campaignId: variant.campaignId });
  }

  // Default action: inject.
  const count = Math.floor(Number(body.mockCount));
  if (!Number.isFinite(count) || count < 1 || count > 10000) {
    return Response.json({ error: "mockCount must be between 1 and 10000" }, { status: 400 });
  }

  // Favorable ~20% conversion rate so the target variant looks like a clear
  // winner, comfortably past MIN_SAMPLE_FOR_SIGNIFICANCE (100 impressions).
  const submissions = Math.round(count * 0.2);
  const rows: { variantId: string; type: "IMPRESSION" | "SUBMISSION" }[] = [
    ...Array.from({ length: count }, () => ({ variantId: variant.id, type: "IMPRESSION" as const })),
    ...Array.from({ length: submissions }, () => ({ variantId: variant.id, type: "SUBMISSION" as const })),
  ];
  await prisma.campaignEvent.createMany({ data: rows });

  try {
    await recomputeCampaignAllocation(variant.id);
  } catch (err) {
    console.error("[testing] bandit recompute after injection failed", err);
  }

  return Response.json({ ok: true, injectedImpressions: count, injectedSubmissions: submissions });
}
