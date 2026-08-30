import { auth } from "@/lib/auth-adapter";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/lib/inngest/client";
import { AI_GENERATION_LIMITS } from "@/lib/limits";
import { findOwnedVariant } from "../route";

const MAX_PROMPT_LENGTH = 2000;
const DEVICE_TYPES = ["MOBILE", "DESKTOP", "TABLET", "AGNOSTIC"] as const;

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/campaigns/[id]/variants/[variantId]/stitch-designs">,
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

  const body = (await request.json()) as { prompt?: string; deviceType?: string };
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return Response.json({ error: "prompt is required" }, { status: 400 });
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return Response.json({ error: `prompt must be ${MAX_PROMPT_LENGTH} characters or fewer` }, { status: 400 });
  }
  const deviceType = DEVICE_TYPES.includes(body.deviceType as typeof DEVICE_TYPES[number])
    ? (body.deviceType as typeof DEVICE_TYPES[number])
    : "DESKTOP";

  // Costs real money like any other AI call - same lifetime budget as
  // campaign/knockout generation (see api/campaigns/route.ts's identical gate).
  const max = AI_GENERATION_LIMITS[account.planTier as keyof typeof AI_GENERATION_LIMITS] ?? 3;
  if (account.aiGenerationsCount >= max) {
    return Response.json(
      { error: `You have reached your AI generation limit (${max}) for the ${account.planTier} plan. Please upgrade your plan to generate more design previews.` },
      { status: 403 },
    );
  }

  let design = await prisma.stitchDesign.create({
    data: { variantId: variant.id, prompt, deviceType, status: "QUEUED" },
  });

  try {
    await inngest.send({ name: "stitch.design.generate", data: { stitchDesignId: design.id } });
  } catch (err) {
    console.error("[stitch-designs] inngest.send failed for stitch.design.generate", err);
    design = await prisma.stitchDesign.update({
      where: { id: design.id },
      data: { status: "FAILED", lastError: "Failed to queue design generation. Please retry." },
    });
  }

  return Response.json({ design }, { status: 202 });
}

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/campaigns/[id]/variants/[variantId]/stitch-designs">,
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

  // Excludes htmlContent/imageData - multi-KB blobs don't belong in a list payload.
  const designs = await prisma.stitchDesign.findMany({
    where: { variantId: variant.id },
    select: {
      id: true,
      prompt: true,
      deviceType: true,
      status: true,
      lastError: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({ designs });
}
