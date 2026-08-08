import { inngest } from "./client";
import { prisma } from "@/lib/prisma";
import { fetchVariantAnalytics, type TestAxis, type FailurePattern } from "@/lib/popupGeneration";

// AI popup variation roadmap, Phase 4 — the "guidelines get smarter across
// accounts" loop. Runs weekly, looks at every ACTIVE campaign's already-
// computed analytics (reusing fetchVariantAnalytics — the same
// significance/failure-pattern logic evaluateKnockout.ts uses per campaign,
// not a separate parallel implementation), and looks for (axis, failure
// pattern, category) combinations that conclusively won across MANY
// independent campaigns — not just one merchant's fluke.
//
// Writes DRAFT rows only. Nothing here ever touches the live system prompt —
// see popupGeneration.ts's getLearnedPatternsSection, which only reads
// APPROVED rows, and /admin/learned-patterns, which is where a human
// approves or rejects each candidate.
const MIN_CAMPAIGNS_FOR_PATTERN = 5;

export const mineCrossAccountPatterns = inngest.createFunction(
  { id: "mine-cross-account-patterns", triggers: { cron: "0 8 * * 1" } }, // weekly, Monday 08:00 UTC
  async ({ step }) => {
    const campaigns = await step.run("fetch-campaigns", async () =>
      prisma.campaign.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, account: { select: { industry: true } } },
      }),
    );

    if (campaigns.length === 0) {
      return { message: "No active campaigns yet", candidatesCreated: 0 };
    }

    type Observation = { axis: TestAxis; pattern: FailurePattern; category: string; campaignId: string };
    const observations: Observation[] = [];

    // One analytics fetch per campaign — not the most efficient shape for a
    // platform with heavy traffic, but this reuses fetchVariantAnalytics's
    // already-correct control-relative significance logic rather than
    // re-deriving it in a separate global SQL query, and it's a weekly batch
    // job, not a hot path. Worth revisiting (move to SQL-side aggregation)
    // once campaign volume makes N sequential fetches too slow.
    for (const c of campaigns) {
      const category = c.account.industry ?? "unknown";
      const analytics = await step.run(`analyze-${c.id}`, async () => fetchVariantAnalytics(c.id));

      for (const v of analytics) {
        if (!v.test_axis || v.significance_flag !== "conclusive") continue;
        if (v.conversion_rate <= 0) continue; // only mining confirmed wins for now, not losses
        for (const pattern of v.failure_patterns) {
          if (pattern === "insufficient_data") continue;
          observations.push({ axis: v.test_axis, pattern, category, campaignId: c.id });
        }
      }
    }

    const grouped = new Map<
      string,
      { axis: TestAxis; pattern: FailurePattern; category: string; campaignIds: Set<string> }
    >();
    for (const obs of observations) {
      const key = `${obs.axis}::${obs.pattern}::${obs.category}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.campaignIds.add(obs.campaignId);
      } else {
        grouped.set(key, { axis: obs.axis, pattern: obs.pattern, category: obs.category, campaignIds: new Set([obs.campaignId]) });
      }
    }

    const candidatesCreated = await step.run("write-candidates", async () => {
      let count = 0;
      for (const g of grouped.values()) {
        if (g.campaignIds.size < MIN_CAMPAIGNS_FOR_PATTERN) continue;

        // Don't spam a duplicate candidate for a combination that's already
        // pending review or already decided.
        const existing = await prisma.learnedPattern.findFirst({
          where: { testAxis: g.axis, failurePattern: g.pattern, category: g.category, status: { in: ["DRAFT", "APPROVED"] } },
        });
        if (existing) continue;

        await prisma.learnedPattern.create({
          data: {
            testAxis: g.axis,
            failurePattern: g.pattern,
            category: g.category,
            sampleSize: g.campaignIds.size,
            description: describeCandidate(g.axis, g.pattern, g.category, g.campaignIds.size),
            status: "DRAFT",
          },
        });
        count++;
      }
      return count;
    });

    return { message: "Mining complete", candidatesCreated };
  },
);

function describeCandidate(axis: TestAxis, pattern: FailurePattern, category: string, sampleSize: number): string {
  const patternLabel: Record<FailurePattern, string> = {
    low_offer_appeal: "low engagement with the offer/teaser itself",
    form_friction: "people reaching the form but not completing it",
    premature_dismissal: "people dismissing almost immediately after the popup appears",
    insufficient_data: "insufficient data",
  };
  return (
    `Across ${sampleSize} independent ${category} campaigns, testing the "${axis}" axis conclusively ` +
    `improved conversion when the underlying issue was "${patternLabel[pattern]}". Candidate for a ` +
    `general heuristic: when a ${category} popup shows this pattern, prioritize the ${axis} axis.`
  );
}
