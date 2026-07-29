import { auth } from "@/lib/auth-adapter";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/campaigns/[id]">,
) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    status?: string;
    winningVariantId?: string | null;
  };

  const { id } = await ctx.params;
  const account = await getOrCreateAccount();
  const campaign = await prisma.campaign.findFirst({
    where: { id, accountId: account.id },
    include: { variants: { select: { id: true } } },
  });
  if (!campaign) {
    return Response.json({ error: "Campaign not found" }, { status: 404 });
  }

  const data: { status?: "ACTIVE" | "PAUSED"; winningVariantId?: string | null } = {};

  if (body.status !== undefined) {
    if (body.status !== "ACTIVE" && body.status !== "PAUSED") {
      return Response.json({ error: "status must be ACTIVE or PAUSED" }, { status: 400 });
    }
    data.status = body.status;
  }

  if (body.winningVariantId !== undefined) {
    if (body.winningVariantId !== null) {
      const belongs = campaign.variants.some((v) => v.id === body.winningVariantId);
      if (!belongs) {
        return Response.json({ error: "Variant does not belong to this campaign" }, { status: 400 });
      }
    }
    data.winningVariantId = body.winningVariantId;
  }

  const updated = await prisma.campaign.update({
    where: { id: campaign.id },
    data,
  });

  return Response.json({ campaign: updated });
}
