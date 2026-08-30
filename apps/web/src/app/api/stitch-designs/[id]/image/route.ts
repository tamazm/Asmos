import { auth } from "@/lib/auth-adapter";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";

// Streams a StitchDesign's preview image. These are unpublished merchant
// design mockups, not public assets - ownership-checked like everything else
// under a variant, just addressed flat (by design id alone) since an <img
// src> can't carry the campaign/variant path segments the rest of this
// feature's routes use.
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/stitch-designs/[id]/image">,
) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const account = await getOrCreateAccount();

  const design = await prisma.stitchDesign.findFirst({
    where: { id, variant: { campaign: { accountId: account.id } } },
    select: { imageData: true, imageContentType: true, status: true },
  });

  if (!design || !design.imageData) {
    return Response.json({ error: "Image not found" }, { status: 404 });
  }

  return new Response(new Uint8Array(design.imageData), {
    headers: {
      "Content-Type": design.imageContentType ?? "image/png",
      // Complete once COMPLETE and never regenerated in place - a new prompt
      // creates a new StitchDesign row, so this id's image never changes.
      "Cache-Control": design.status === "COMPLETE"
        ? "private, max-age=31536000, immutable"
        : "private, no-store",
    },
  });
}
