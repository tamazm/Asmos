import { prisma } from "@/lib/prisma";
import { generateCampaignInsight, buildInsightStats } from "@/lib/insights";

// Automatic biweekly/monthly AI review — see vercel.json for the schedule.
// Vercel Cron sends this exact Authorization header; CRON_SECRET must be set
// as an env var for this to run (see .env.local).
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const campaigns = await prisma.campaign.findMany({
    where: { status: "ACTIVE" },
    include: { variants: { include: { events: true } } },
  });

  let generated = 0;
  for (const campaign of campaigns) {
    if (campaign.variants.length === 0) continue;

    const { summary, suggestedVariant } = await generateCampaignInsight(
      buildInsightStats(campaign),
    );
    await prisma.campaignInsight.create({
      data: {
        campaignId: campaign.id,
        summary,
        suggestedVariant: suggestedVariant ?? undefined,
      },
    });
    generated++;
  }

  return Response.json({ generated });
}
