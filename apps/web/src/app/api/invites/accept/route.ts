import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { token } = (await request.json()) as { token?: string };
  if (!token) {
    return Response.json({ error: "token is required" }, { status: 400 });
  }

  const invite = await prisma.invite.findUnique({ where: { token } });
  if (!invite || invite.status !== "PENDING") {
    return Response.json({ error: "This invite is no longer valid." }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({ where: { clerkUserId: userId } });
  if (existingUser) {
    return Response.json(
      { error: "You already belong to an account and can't accept another invite." },
      { status: 409 },
    );
  }

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? invite.email;
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || null;

  await prisma.$transaction([
    prisma.user.create({
      data: {
        accountId: invite.accountId,
        clerkUserId: userId,
        email,
        name,
        role: invite.role,
      },
    }),
    prisma.invite.update({
      where: { id: invite.id },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    }),
  ]);

  return Response.json({ ok: true });
}
