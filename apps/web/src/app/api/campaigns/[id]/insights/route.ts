import { auth } from "@clerk/nextjs/server";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { generateCampaignInsight, buildInsightStats } from "@/lib/insights";

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
