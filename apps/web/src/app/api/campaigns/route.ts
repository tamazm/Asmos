import { auth } from "@/lib/auth-adapter";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import type { GeneratedCampaign } from "@/lib/campaignGeneration";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const campaign = (await request.json()) as GeneratedCampaign;

  const account = await getOrCreateAccount();
  const website = await prisma.website.findFirst({
    where: { accountId: account.id },
    orderBy: { createdAt: "asc" },
  });

  if (!website) {
    return Response.json(
      { error: "Connect a website before publishing a campaign." },
      { status: 400 },
    );
  }

  const created = await prisma.campaign.create({
    data: {
      accountId: account.id,
      websiteId: website.id,
      name: campaign.name,
      type: campaign.type,
      status: "ACTIVE",
      variants: {
        create: {
          name: "Control",
          isControl: true,
          trafficPercent: 100,
          design: campaign.design,
          formFields: campaign.formFields,
          targeting: campaign.targeting,
          rewards: {
            create: campaign.rewards.map((reward) => ({
              label: reward.label,
              type: reward.type,
              couponCode: reward.couponCode,
              weight: reward.weight,
            })),
          },
        },
      },
    },
    include: { variants: true },
  });

  return Response.json({ campaign: created });
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const account = await getOrCreateAccount();
  const campaigns = await prisma.campaign.findMany({
    where: { accountId: account.id },
    orderBy: { createdAt: "desc" },
    include: {
      variants: { include: { _count: { select: { leads: true } } } },
    },
  });

  return Response.json({ campaigns });
}
