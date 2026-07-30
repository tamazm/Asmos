import { auth } from "@/lib/auth-adapter";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { after } from "next/server";
import { dispatchWebhook } from "@/lib/webhook";

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
    include: {
      variants: { select: { id: true, name: true } },
      account: {
        select: {
          webhookUrl: true,
          webhookSecret: true,
          webhookEnabled: true,
        },
      },
    },
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

  // Fire variant.winner_declared webhook when a winner is set (fire-and-forget).
  if (body.winningVariantId && body.winningVariantId !== null) {
    after(async () => {
      try {
        const acc = campaign.account;
        if (acc.webhookEnabled && acc.webhookUrl) {
          const winningVariant = campaign.variants.find(
            (v) => v.id === body.winningVariantId,
          );
          await dispatchWebhook(acc.webhookUrl, acc.webhookSecret ?? null, {
            event: "variant.winner_declared",
            payload: {
              campaign_id: campaign.id,
              campaign_name: campaign.name,
              winning_variant_id: body.winningVariantId!,
              winning_variant_name: winningVariant?.name ?? body.winningVariantId!,
              declared_at: new Date().toISOString(),
            },
          });
        }
      } catch (err) {
        console.error("[webhook] variant.winner_declared dispatch failed", err);
      }
    });
  }

  return Response.json({ campaign: updated });
}
