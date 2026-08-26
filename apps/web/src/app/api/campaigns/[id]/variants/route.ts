// @ts-expect-error
import { auth } from "@/lib/auth-adapter";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import type { Prisma, RewardType } from ".prisma/client";

const VARIANT_NAMES = ["Control", "Variant B", "Variant C", "Variant D", "Variant E"];

type SuggestedRewardInput = { label: string; type: RewardType; couponCode: string | null; weight: number };

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/campaigns/[id]/variants">,
) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Optional - lets an accepted AI insight suggestion (see InsightsPanel)
  // seed the new variant's copy instead of just cloning the control.
  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    design?: Prisma.InputJsonValue;
    formFields?: Prisma.InputJsonValue;
    targeting?: Prisma.InputJsonValue;
    rewards?: SuggestedRewardInput[];
  };

  const { id } = await ctx.params;
  const account = await getOrCreateAccount();
  const campaign = await prisma.campaign.findFirst({
    where: { id, accountId: account.id },
    include: { variants: { orderBy: { createdAt: "asc" } } },
  });
  if (!campaign) {
    return Response.json({ error: "Campaign not found" }, { status: 404 });
  }

  const control = campaign.variants.find((v) => v.isControl) ?? campaign.variants[0];
  if (!control) {
    return Response.json({ error: "Campaign has no base variant to clone" }, { status: 400 });
  }
  if (campaign.variants.length >= VARIANT_NAMES.length) {
    return Response.json({ error: "Too many variants on this campaign" }, { status: 400 });
  }

  const nextName = body.name?.trim() || VARIANT_NAMES[campaign.variants.length];
  const evenSplit = Math.floor(100 / (campaign.variants.length + 1));

  // Rewards live on the campaign now, not the variant - every variant under this
  // campaign already shares the same reward pool, so there's nothing to clone here.
  // We only create new RewardRules when an AI insight suggests one alongside this variant.
  const results = await prisma.$transaction([
    ...campaign.variants.map((v) =>
      prisma.variant.update({ where: { id: v.id }, data: { trafficPercent: evenSplit } }),
    ),
    prisma.variant.create({
      data: {
        campaignId: campaign.id,
        name: nextName,
        trafficPercent: evenSplit,
        isControl: false,
        design: body.design ?? control.design ?? undefined,
        formFields: body.formFields ?? control.formFields ?? undefined,
        targeting: body.targeting ?? control.targeting ?? undefined,
      },
    }),
    ...(body.rewards ?? []).map((r) =>
      prisma.rewardRule.create({
        data: {
          campaignId: campaign.id,
          label: r.label,
          type: r.type,
          couponCode: r.couponCode,
          weight: r.weight,
        },
      }),
    ),
  ]);

  return Response.json({ variant: results[results.length - 1] });
}
