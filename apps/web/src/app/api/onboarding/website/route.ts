import { auth } from "@/lib/auth-adapter";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { normalizeHost } from "@/lib/host";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { url } = (await request.json()) as { url?: string };
  if (!url || url.trim().length === 0) {
    return Response.json({ error: "url is required" }, { status: 400 });
  }

  const account = await getOrCreateAccount();
  const host = normalizeHost(url);

  const existing = await prisma.website.findFirst({
    where: { accountId: account.id, url: host },
  });

  const website =
    existing ??
    (await prisma.website.create({
      data: { accountId: account.id, url: host },
    }));

  return Response.json({ website });
}
