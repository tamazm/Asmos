import { auth } from "@clerk/nextjs/server";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

type DesignPatch = Record<string, string | number | boolean | null>;

async function findOwnedVariant(campaignId: string, variantId: string, accountId: string) {
  return prisma.variant.findFirst({
    where: { id: variantId, campaignId, campaign: { accountId } },
  });
}

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/campaigns/[id]/variants/[variantId]">,
) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, variantId } = await ctx.params;
  const account = await getOrCreateAccount();
  const variant = await findOwnedVariant(id, variantId, account.id);
  if (!variant) {
    return Response.json({ error: "Variant not found" }, { status: 404 });
  }

  const body = (await request.json()) as {
    name?: string;
    trafficPercent?: number;
    design?: DesignPatch;
  };

  const data: Prisma.VariantUpdateInput = {};
  if (body.name !== undefined) data.name = body.name.trim();
  if (body.trafficPercent !== undefined) {
    data.trafficPercent = Math.max(0, Math.min(100, Math.round(body.trafficPercent)));
  }
  if (body.design !== undefined) {
    const existing = (variant.design as DesignPatch | null) ?? {};
    data.design = { ...existing, ...body.design } satisfies DesignPatch as Prisma.InputJsonValue;
  }

  const updated = await prisma.variant.update({ where: { id: variant.id }, data });
  return Response.json({ variant: updated });
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/campaigns/[id]/variants/[variantId]">,
) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, variantId } = await ctx.params;
  const account = await getOrCreateAccount();
  const variant = await findOwnedVariant(id, variantId, account.id);
  if (!variant) {
    return Response.json({ error: "Variant not found" }, { status: 404 });
  }

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: { variants: { select: { id: true } } },
  });
  if (campaign && campaign.variants.length <= 1) {
    return Response.json({ error: "A campaign needs at least one variant" }, { status: 400 });
  }
  if (campaign?.winningVariantId === variant.id) {
    return Response.json({ error: "Clear the declared winner before deleting it" }, { status: 400 });
  }

  await prisma.variant.delete({ where: { id: variant.id } });
  return Response.json({ ok: true });
}
