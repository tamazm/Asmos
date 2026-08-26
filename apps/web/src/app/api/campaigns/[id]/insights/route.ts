import { auth } from "@/lib/auth-adapter";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { generateCampaignInsight, buildInsightStats } from "@/lib/insights";

// Guards against accidental cost runaway (retry loops, spam-clicking) on the
// manual "Generate report now" button - the cron job is unaffected by this.
const MANUAL_GENERATE_COOLDOWN_MS = 5 * 60 * 1000;

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/campaigns/[id]/insights">,
) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const account = await getOrCreateAccount();
  const campaign = await prisma.campaign.findFirst({ where: { id, accountId: account.id } });
  if (!campaign) {
    return Response.json({ error: "Campaign not found" }, { status: 404 });
  }

  const insights = await prisma.campaignInsight.findMany({
    where: { campaignId: id },
    orderBy: { createdAt: "desc" },
  });
  return Response.json({ insights });
}

export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/campaigns/[id]/insights">,
) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const account = await getOrCreateAccount();
  const campaign = await prisma.campaign.findFirst({
    where: { id, accountId: account.id },
    include: { variants: { include: { events: true } } },
  });
  if (!campaign) {
    return Response.json({ error: "Campaign not found" }, { status: 404 });
  }
  if (campaign.variants.length === 0) {
    return Response.json({ error: "Campaign has no variants yet" }, { status: 400 });
  }

  const mostRecent = await prisma.campaignInsight.findFirst({
    where: { campaignId: id },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (mostRecent && Date.now() - mostRecent.createdAt.getTime() < MANUAL_GENERATE_COOLDOWN_MS) {
    return Response.json(
      { error: "A report was just generated for this campaign - try again in a few minutes." },
      { status: 429 },
    );
  }

  const { summary, suggestedVariant } = await generateCampaignInsight(
    buildInsightStats(campaign),
  );

  const insight = await prisma.campaignInsight.create({
    data: {
      campaignId: id,
      summary,
      suggestedVariant: suggestedVariant ?? undefined,
    },
  });

  return Response.json({ insight });
}
