import { randomBytes } from "crypto";
import { auth, currentUser } from "@/lib/auth-adapter";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { sendInviteEmail } from "@/lib/email";
import type { UserRole } from "@/generated/prisma/client";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const account = await getOrCreateAccount();
  const invites = await prisma.invite.findMany({
    where: { accountId: account.id, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({ invites });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { email, role } = (await request.json()) as {
    email?: string;
    role?: UserRole;
  };
  if (!email || email.trim().length === 0) {
    return Response.json({ error: "email is required" }, { status: 400 });
  }

  const account = await getOrCreateAccount();
  const user = await currentUser();
  const inviterName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.primaryEmailAddress?.emailAddress ||
    "A teammate";

  const token = randomBytes(24).toString("hex");
  const invite = await prisma.invite.create({
    data: {
      accountId: account.id,
      email: email.trim(),
      role: role === "ADMIN" ? "ADMIN" : "MEMBER",
      token,
    },
  });

  const acceptUrl = `${new URL(request.url).origin}/invite/${token}`;
  try {
    await sendInviteEmail({
      to: invite.email,
      inviterName,
      accountName: account.name,
      acceptUrl,
    });
  } catch {
    // Invite is still created — email delivery failing shouldn't block the invite itself.
  }

  return Response.json({ invite });
}
