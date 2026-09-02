// @ts-expect-error
import { auth } from "@/lib/auth-adapter";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { after } from "next/server";
import { emitIntegrationEvent } from "@/lib/integrations/emit";
import { inngest } from "@/lib/inngest/client";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/campaigns/[id]">,
) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const account = await getOrCreateAccount();
  const campaign = await prisma.campaign.findFirst({
    where: { id, accountId: account.id },
    include: {
      variants: {
        select: { id: true, name: true, isControl: true, design: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!campaign) {
    return Response.json({ error: "Campaign not found" }, { status: 404 });
  }

  return Response.json({ campaign });
}

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
    retry?: boolean;
  };

  const { id } = await ctx.params;
  const account = await getOrCreateAccount();
  const campaign = await prisma.campaign.findFirst({
    where: { id, accountId: account.id },
    include: {
      variants: { select: { id: true, name: true } },
      account: {
        select: {
          id: true,
        },
      },
    },
  });
  if (!campaign) {
    return Response.json({ error: "Campaign not found" }, { status: 404 });
  }

  if (body.retry) {
    if (campaign.status !== "FAILED") {
      return Response.json({ error: "Only a failed campaign can be retried" }, { status: 400 });
    }
    let retried = await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: "GENERATING", lastError: null, generationStage: "QUEUED" },
    });
    try {
      await inngest.send({ name: "campaign.generate", data: { campaignId: campaign.id } });
    } catch (err) {
      console.error("[campaigns/[id]/route] inngest.send failed for campaign.generate retry", err);
      retried = await prisma.campaign.update({
        where: { id: campaign.id },
        data: {
          status: "FAILED",
          lastError: "Failed to queue campaign generation. Please retry.",
        },
      });
    }
    return Response.json({ campaign: retried }, { status: 202 });
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

  // Keep low-volume lifecycle changes available to webhook and notification
  // integrations without emitting duplicates when a status is unchanged.
  if (body.status !== undefined && body.status !== campaign.status) {
    after(async () => {
      try {
        await emitIntegrationEvent(campaign.account.id, {
          event: body.status === "ACTIVE" ? "campaign.activated" : "campaign.paused",
          payload: {
            campaign_id: campaign.id,
            campaign_name: campaign.name,
            changed_at: new Date().toISOString(),
          },
        });
      } catch (err) {
        console.error(`[integrations] campaign.${body.status === "ACTIVE" ? "activated" : "paused"} emit failed`, err);
      }
    });
  }

  // Emit variant.winner_declared through the integration bus when a winner is set (fire-and-forget).
  if (body.winningVariantId && body.winningVariantId !== null) {
    after(async () => {
      try {
        const acc = campaign.account;
        const winningVariant = campaign.variants.find(
          (v) => v.id === body.winningVariantId,
        );
        await emitIntegrationEvent(acc.id, {
          event: "variant.winner_declared",
          payload: {
            campaign_id: campaign.id,
            campaign_name: campaign.name,
            winning_variant_id: body.winningVariantId!,
            winning_variant_name: winningVariant?.name ?? body.winningVariantId!,
            declared_at: new Date().toISOString(),
          },
        });
      } catch (err) {
        console.error("[integrations] variant.winner_declared emit failed", err);
      }
    });
  }

  return Response.json({ campaign: updated });
}

// Deletes a campaign - a real row delete only when there's genuinely nothing
// to lose (no leads captured, no events recorded on any of its variants);
// otherwise archives it (status: ARCHIVED) so it disappears from the
// campaigns list and is never served, without cascading away a merchant's
// real captured leads/analytics. See the CampaignStatus.ARCHIVED comment in
// schema.prisma.
export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/campaigns/[id]">,
) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const account = await getOrCreateAccount();
  const campaign = await prisma.campaign.findFirst({
    where: { id, accountId: account.id },
    select: { id: true },
  });
  if (!campaign) {
    return Response.json({ error: "Campaign not found" }, { status: 404 });
  }

  const [leadCount, eventCount] = await Promise.all([
    prisma.lead.count({ where: { variant: { campaignId: id } } }),
    prisma.campaignEvent.count({ where: { variant: { campaignId: id } } }),
  ]);

  if (leadCount === 0 && eventCount === 0) {
    await prisma.campaign.delete({ where: { id: campaign.id } });
    return Response.json({ ok: true, mode: "deleted" });
  }

  await prisma.campaign.update({ where: { id: campaign.id }, data: { status: "ARCHIVED" } });
  return Response.json({ ok: true, mode: "archived" });
}
