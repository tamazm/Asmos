import { prisma } from "@/lib/prisma";

/**
 * Everything the dashboard home page renders, in one place.
 *
 * Two rules govern this file:
 *
 * 1. **Nothing is invented.** Every number returned here is counted from the
 *    database. Where a comparison is impossible (no prior window, no target
 *    set, a single variant) the field comes back `null` and the card renders
 *    an honest empty state rather than a plausible-looking placeholder.
 * 2. **Counts stay in the database.** The page this replaced loaded every
 *    event row for every variant into memory to call `.filter().length` on
 *    them. Impressions are the highest-volume table in the product, so they
 *    are aggregated with `groupBy`; rows are only materialised where the
 *    timestamps themselves are needed (daily series and sparklines).
 */

export const WINDOW_DAYS = 30;

export type Trend = { value: number; direction: "up" | "down" } | null;

export type CampaignMetric = {
  id: string;
  name: string;
  impressions: number;
  conversions: number;
  leads: number;
  conversionRate: number;
  trend: Trend;
};

export type BracketEntry = {
  id: string;
  name: string;
  conversionRate: number | null;
  eliminated: boolean;
  advanced: boolean;
};

export type BracketData = {
  campaignId: string;
  campaignName: string;
  currentRound: number;
  totalRounds: number;
  percentComplete: number;
  rounds: { round: number; entries: BracketEntry[] }[];
  championName: string | null;
};

export type ActivityItem = {
  id: string;
  title: string;
  body: string;
  href: string | null;
  createdAt: Date;
  unread: boolean;
};

export type RecentRow = {
  id: string;
  name: string;
  status: string;
  impressions: number;
  conversions: number;
  conversionRate: number;
  spark: number[];
};

export type DashboardMetrics = Awaited<ReturnType<typeof getDashboardMetrics>>;

/** Relative change between two windows. Null when the prior window is empty:
 *  "up 100%" from a base of zero is noise, not a trend. */
function trend(current: number, previous: number): Trend {
  if (previous <= 0) return null;
  const value = ((current - previous) / previous) * 100;
  if (!Number.isFinite(value) || Math.abs(value) < 0.05) return null;
  return { value: Math.abs(value), direction: value > 0 ? "up" : "down" };
}

function rate(conversions: number, impressions: number) {
  return impressions > 0 ? (conversions / impressions) * 100 : 0;
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

const GOAL_LABELS: Record<string, string> = {
  email_capture: "Grow Email List",
  discount: "Drive Discount Redemptions",
  contest: "Run a Contest",
  lead_gen: "Generate Leads",
};

export async function getDashboardMetrics(accountId: string) {
  const now = new Date();
  const since = new Date(now.getTime() - WINDOW_DAYS * 86_400_000);
  const prevSince = new Date(now.getTime() - WINDOW_DAYS * 2 * 86_400_000);

  const [account, campaigns, siteCount] = await Promise.all([
    prisma.account.findUnique({
      where: { id: accountId },
      select: { conversionGoal: true, targetCvr: true, goalTargetAt: true },
    }),
    prisma.campaign.findMany({
      where: { accountId, status: { not: "ARCHIVED" } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        status: true,
        tournamentRound: true,
        winningVariantId: true,
        updatedAt: true,
        variants: {
          select: { id: true, name: true, status: true, tournamentRound: true },
        },
      },
    }),
    prisma.website.count({ where: { accountId } }),
  ]);

  const variantIds = campaigns.flatMap((c) => c.variants.map((v) => v.id));
  const campaignOfVariant = new Map<string, string>();
  for (const campaign of campaigns) {
    for (const variant of campaign.variants) campaignOfVariant.set(variant.id, campaign.id);
  }

  const empty = { windowDays: WINDOW_DAYS, hasCampaigns: campaigns.length > 0 };

  if (variantIds.length === 0) {
    return {
      ...empty,
      totals: {
        impressions: 0,
        conversions: 0,
        leads: 0,
        conversionRate: 0,
        impressionsTrend: null as Trend,
        conversionsTrend: null as Trend,
        leadsTrend: null as Trend,
        conversionRateTrend: null as Trend,
      },
      active: { count: 0, siteCount, top: [] as CampaignMetric[] },
      bracket: null as BracketData | null,
      leadSeries: buildLeadSeries([], since),
      topByLeads: [] as CampaignMetric[],
      goal: buildGoal(account, 0, null),
      activity: [] as ActivityItem[],
      recent: [] as RecentRow[],
    };
  }

  // Recent campaigns are the only ones needing per-day conversion detail, so
  // the sparkline query is scoped to their variants instead of the account's.
  const recentCampaigns = campaigns.slice(0, 5);
  const recentVariantIds = recentCampaigns.flatMap((c) => c.variants.map((v) => v.id));

  const [eventsNow, eventsPrev, leadsNow, leadsPrev, submissionRows, notifications] =
    await Promise.all([
      prisma.campaignEvent.groupBy({
        by: ["variantId", "type"],
        where: { variantId: { in: variantIds }, createdAt: { gte: since } },
        _count: { _all: true },
      }),
      prisma.campaignEvent.groupBy({
        by: ["variantId", "type"],
        where: { variantId: { in: variantIds }, createdAt: { gte: prevSince, lt: since } },
        _count: { _all: true },
      }),
      prisma.lead.findMany({
        where: { variantId: { in: variantIds }, createdAt: { gte: since } },
        select: { variantId: true, createdAt: true },
      }),
      prisma.lead.groupBy({
        by: ["variantId"],
        where: { variantId: { in: variantIds }, createdAt: { gte: prevSince, lt: since } },
        _count: { _all: true },
      }),
      recentVariantIds.length
        ? prisma.campaignEvent.findMany({
            where: {
              variantId: { in: recentVariantIds },
              type: "SUBMISSION",
              createdAt: { gte: since },
            },
            select: { variantId: true, createdAt: true },
          })
        : Promise.resolve([] as { variantId: string; createdAt: Date }[]),
      prisma.notification.findMany({
        where: { accountId },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, title: true, body: true, href: true, createdAt: true, readAt: true },
      }),
    ]);

  // ── Per-campaign rollups ────────────────────────────────────────────────
  type Roll = { impressions: number; conversions: number; leads: number };
  const zero = (): Roll => ({ impressions: 0, conversions: 0, leads: 0 });
  const nowByCampaign = new Map<string, Roll>();
  const prevByCampaign = new Map<string, Roll>();
  for (const campaign of campaigns) {
    nowByCampaign.set(campaign.id, zero());
    prevByCampaign.set(campaign.id, zero());
  }

  // Variant-level rollups feed the knockout bracket, which labels individual
  // arms; campaign-level rollups feed everything else.
  const nowByVariant = new Map<string, Roll>();
  for (const variantId of variantIds) nowByVariant.set(variantId, zero());

  const applyEvents = (
    rows: { variantId: string; type: string; _count: { _all: number } }[],
    target: Map<string, Roll>,
    variantTarget?: Map<string, Roll>,
  ) => {
    for (const row of rows) {
      const campaignId = campaignOfVariant.get(row.variantId);
      if (!campaignId) continue;
      const roll = target.get(campaignId);
      const variantRoll = variantTarget?.get(row.variantId);
      if (row.type === "IMPRESSION") {
        if (roll) roll.impressions += row._count._all;
        if (variantRoll) variantRoll.impressions += row._count._all;
      }
      if (row.type === "SUBMISSION") {
        if (roll) roll.conversions += row._count._all;
        if (variantRoll) variantRoll.conversions += row._count._all;
      }
    }
  };
  applyEvents(eventsNow, nowByCampaign, nowByVariant);
  applyEvents(eventsPrev, prevByCampaign);

  for (const lead of leadsNow) {
    const campaignId = campaignOfVariant.get(lead.variantId);
    const roll = campaignId ? nowByCampaign.get(campaignId) : undefined;
    if (roll) roll.leads += 1;
  }
  for (const row of leadsPrev) {
    const campaignId = campaignOfVariant.get(row.variantId);
    const roll = campaignId ? prevByCampaign.get(campaignId) : undefined;
    if (roll) roll.leads += row._count._all;
  }

  const sum = (source: Map<string, Roll>) =>
    [...source.values()].reduce(
      (acc, roll) => ({
        impressions: acc.impressions + roll.impressions,
        conversions: acc.conversions + roll.conversions,
        leads: acc.leads + roll.leads,
      }),
      zero(),
    );
  const totalNow = sum(nowByCampaign);
  const totalPrev = sum(prevByCampaign);
  const cvrNow = rate(totalNow.conversions, totalNow.impressions);
  const cvrPrev = rate(totalPrev.conversions, totalPrev.impressions);

  const metricFor = (campaign: { id: string; name: string }): CampaignMetric => {
    const current = nowByCampaign.get(campaign.id) ?? zero();
    const previous = prevByCampaign.get(campaign.id) ?? zero();
    return {
      id: campaign.id,
      name: campaign.name,
      impressions: current.impressions,
      conversions: current.conversions,
      leads: current.leads,
      conversionRate: rate(current.conversions, current.impressions),
      trend: trend(
        rate(current.conversions, current.impressions),
        rate(previous.conversions, previous.impressions),
      ),
    };
  };

  const activeCampaigns = campaigns.filter((c) => c.status === "ACTIVE");
  const topActive = activeCampaigns
    .map(metricFor)
    .filter((m) => m.impressions > 0)
    .sort((a, b) => b.conversionRate - a.conversionRate)
    .slice(0, 4);

  const topByLeads = campaigns
    .map((campaign) => {
      const metric = metricFor(campaign);
      const previous = prevByCampaign.get(campaign.id) ?? zero();
      return { ...metric, trend: trend(metric.leads, previous.leads) };
    })
    .filter((m) => m.leads > 0)
    .sort((a, b) => b.leads - a.leads)
    .slice(0, 5);

  // ── Sparklines: daily conversions per recent campaign ───────────────────
  const sparkBuckets = new Map<string, number[]>();
  const SPARK_DAYS = 14;
  const sparkStart = new Date(now.getTime() - SPARK_DAYS * 86_400_000);
  for (const campaign of recentCampaigns) sparkBuckets.set(campaign.id, Array(SPARK_DAYS).fill(0));
  for (const row of submissionRows) {
    if (row.createdAt < sparkStart) continue;
    const campaignId = campaignOfVariant.get(row.variantId);
    const bucket = campaignId ? sparkBuckets.get(campaignId) : undefined;
    if (!bucket) continue;
    const index = Math.min(
      SPARK_DAYS - 1,
      Math.floor((row.createdAt.getTime() - sparkStart.getTime()) / 86_400_000),
    );
    if (index >= 0) bucket[index] += 1;
  }

  const recent: RecentRow[] = recentCampaigns.map((campaign) => {
    const metric = metricFor(campaign);
    return {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      impressions: metric.impressions,
      conversions: metric.conversions,
      conversionRate: metric.conversionRate,
      spark: sparkBuckets.get(campaign.id) ?? [],
    };
  });

  return {
    ...empty,
    totals: {
      impressions: totalNow.impressions,
      conversions: totalNow.conversions,
      leads: totalNow.leads,
      conversionRate: cvrNow,
      impressionsTrend: trend(totalNow.impressions, totalPrev.impressions),
      conversionsTrend: trend(totalNow.conversions, totalPrev.conversions),
      leadsTrend: trend(totalNow.leads, totalPrev.leads),
      conversionRateTrend: trend(cvrNow, cvrPrev),
    },
    active: { count: activeCampaigns.length, siteCount, top: topActive },
    bracket: buildBracket(campaigns, nowByVariant),
    leadSeries: buildLeadSeries(leadsNow, since),
    topByLeads,
    goal: buildGoal(account, cvrNow, trend(cvrNow, cvrPrev)),
    activity: notifications.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      href: n.href,
      createdAt: n.createdAt,
      unread: n.readAt === null,
    })),
    recent,
  };
}

/** One point per day across the window, zero-filled, so the chart's x-axis is
 *  a real calendar rather than "however many days happened to have leads". */
function buildLeadSeries(leads: { createdAt: Date }[], since: Date) {
  const buckets = new Map<string, number>();
  for (let i = 0; i < WINDOW_DAYS; i += 1) {
    buckets.set(dayKey(new Date(since.getTime() + i * 86_400_000)), 0);
  }
  for (const lead of leads) {
    const key = dayKey(lead.createdAt);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return [...buckets.entries()].map(([date, count]) => ({ date, count }));
}

function buildGoal(
  account: { conversionGoal: string | null; targetCvr: number | null; goalTargetAt: Date | null } | null,
  currentCvr: number,
  cvrTrend: Trend,
) {
  const target = account?.targetCvr ?? null;
  const deadline = account?.goalTargetAt ?? null;
  const daysRemaining = deadline
    ? Math.max(0, Math.ceil((deadline.getTime() - Date.now()) / 86_400_000))
    : null;
  return {
    label: GOAL_LABELS[account?.conversionGoal ?? ""] ?? "Grow Email List",
    currentCvr,
    targetCvr: target,
    goalTargetAt: deadline ? deadline.toISOString() : null,
    daysRemaining,
    progress: target && target > 0 ? Math.min(100, (currentCvr / target) * 100) : null,
    cvrTrend,
  };
}

/** The knockout view needs a campaign that is actually running a tournament:
 *  more than one variant, and at least one round's worth of history. The most
 *  recently updated qualifying campaign wins the slot. */
function buildBracket(
  campaigns: {
    id: string;
    name: string;
    tournamentRound: number;
    winningVariantId: string | null;
    updatedAt: Date;
    variants: { id: string; name: string; status: string; tournamentRound: number }[];
  }[],
  variantRolls: Map<string, { impressions: number; conversions: number; leads: number }>,
): BracketData | null {
  const candidates = campaigns
    .filter((c) => c.variants.length > 1)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  const campaign = candidates[0];
  if (!campaign) return null;

  const byRound = new Map<number, typeof campaign.variants>();
  for (const variant of campaign.variants) {
    const round = Math.max(1, variant.tournamentRound);
    const list = byRound.get(round) ?? [];
    list.push(variant);
    byRound.set(round, list);
  }

  const firstRoundSize = byRound.get(1)?.length ?? campaign.variants.length;
  const totalRounds = Math.max(1, Math.ceil(Math.log2(Math.max(2, firstRoundSize))));
  const eliminated = campaign.variants.filter((v) => v.status === "ELIMINATED").length;
  const decidable = Math.max(1, campaign.variants.length - 1);

  // Rates are not stored per round, so each box shows the variant's rate over
  // the current window, and stays blank where the arm has no impressions yet.
  const rounds = [...byRound.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([round, variants]) => ({
      round,
      entries: variants.map((variant) => {
        const roll = variantRolls.get(variant.id);
        return {
          id: variant.id,
          name: variant.name,
          conversionRate:
            roll && roll.impressions > 0 ? (roll.conversions / roll.impressions) * 100 : null,
          eliminated: variant.status === "ELIMINATED",
          advanced: variant.status === "WINNER" || variant.id === campaign.winningVariantId,
        };
      }),
    }));

  const champion = campaign.variants.find(
    (v) => v.id === campaign.winningVariantId || v.status === "WINNER",
  );

  return {
    campaignId: campaign.id,
    campaignName: campaign.name,
    currentRound: Math.max(1, Math.min(campaign.tournamentRound, totalRounds)),
    totalRounds,
    percentComplete: Math.round((eliminated / decidable) * 100),
    rounds,
    championName: champion?.name ?? null,
  };
}
