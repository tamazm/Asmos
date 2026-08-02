// @ts-nocheck
import { auth } from "@/lib/auth-adapter";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const account = await getOrCreateAccount();

  const notifications = await prisma.notification.findMany({
    where: { accountId: account.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return Response.json({
    notifications: notifications.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      href: n.href,
      readAt: n.readAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    })),
    unreadCount: notifications.filter((n) => !n.readAt).length,
  });
}
