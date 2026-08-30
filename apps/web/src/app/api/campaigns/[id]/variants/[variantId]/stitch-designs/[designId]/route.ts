import { auth } from "@/lib/auth-adapter";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/lib/inngest/client";
import { findOwnedVariant } from "../../route";

async function findOwnedDesign(campaignId: string, variantId: string, designId: string, accountId: string) {
  const variant = await findOwnedVariant(campaignId, variantId, accountId);
  if (!variant) return null;
  return prisma.stitchDesign.findFirst({
    where: { id: designId, variantId: variant.id },
    select: {
      id: true,
      prompt: true,
      deviceType: true,
      status: true,
      lastError: true,
      createdAt: true,
      // htmlContent is text, not binary - safe to include here (unlike the
      // list route) since this is a single-row fetch the UI needs it for.
      htmlContent: true,
    },
  });
}

// This is the poll target - mirrors GET /api/campaigns/[id].
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/campaigns/[id]/variants/[variantId]/stitch-designs/[designId]">,
) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, variantId, designId } = await ctx.params;
  const account = await getOrCreateAccount();
  const design = await findOwnedDesign(id, variantId, designId, account.id);
  if (!design) {
    return Response.json({ error: "Design not found" }, { status: 404 });
  }

  return Response.json({ design });
}

// { retry: true } - mirrors PATCH /api/campaigns/[id]'s retry block.
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/campaigns/[id]/variants/[variantId]/stitch-designs/[designId]">,
) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, variantId, designId } = await ctx.params;
  const account = await getOrCreateAccount();
  const design = await findOwnedDesign(id, variantId, designId, account.id);
  if (!design) {
    return Response.json({ error: "Design not found" }, { status: 404 });
  }

  const body = (await request.json()) as { retry?: boolean };
  if (!body.retry) {
    return Response.json({ error: "Nothing to do" }, { status: 400 });
  }
  if (design.status !== "FAILED") {
    return Response.json({ error: "Only a failed design can be retried" }, { status: 400 });
  }

  let retried = await prisma.stitchDesign.update({
    where: { id: design.id },
    data: { status: "QUEUED", lastError: null },
  });
  try {
    await inngest.send({ name: "stitch.design.generate", data: { stitchDesignId: design.id } });
  } catch (err) {
    console.error("[stitch-designs/[designId]] inngest.send failed for retry", err);
    retried = await prisma.stitchDesign.update({
      where: { id: design.id },
      data: { status: "FAILED", lastError: "Failed to queue design generation. Please retry." },
    });
  }

  return Response.json({ design: retried }, { status: 202 });
}
