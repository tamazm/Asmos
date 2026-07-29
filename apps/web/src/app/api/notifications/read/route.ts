import { auth } from "@/lib/auth-adapter";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const account = await getOrCreateAccount();

  const body = (await request.json().catch(() => ({}))) as {
    notificationId?: string;
    all?: boolean;
  };

  if (body.all) {
    await prisma.notification.updateMany({
      where: { accountId: account.id, readAt: null },
      data: { readAt: new Date() },
    });
    return Response.json({ ok: true });
  }

  if (!body.notificationId) {
    return Response.json({ error: "notificationId required" }, { status: 400 });
  }

  await prisma.notification.updateMany({
    where: { id: body.notificationId, accountId: account.id },
    data: { readAt: new Date() },
  });

  return Response.json({ ok: true });
}
