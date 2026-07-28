import { auth } from "@clerk/nextjs/server";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/invites/[id]">,
) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const account = await getOrCreateAccount();
  const invite = await prisma.invite.findFirst({
    where: { id, accountId: account.id },
  });
  if (!invite) {
    return Response.json({ error: "Invite not found" }, { status: 404 });
  }

  await prisma.invite.update({
    where: { id: invite.id },
    data: { status: "REVOKED" },
  });

  return Response.json({ ok: true });
}
