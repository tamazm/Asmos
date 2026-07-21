import { auth } from "@clerk/nextjs/server";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const account = await getOrCreateAccount();
  const website = await prisma.website.findFirst({
    where: { accountId: account.id },
    orderBy: { createdAt: "asc" },
  });

  if (!website) {
    return Response.json({ error: "No website connected yet" }, { status: 400 });
  }

  let verified = false;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`https://${website.url}`, { signal: controller.signal });
    clearTimeout(timeout);
    const html = await res.text();
    verified = html.includes("/widget.js") && html.includes(`data-site="${website.url}"`);
  } catch {
    verified = false;
  }

  if (verified) {
    await prisma.website.update({
      where: { id: website.id },
      data: { installVerified: true, installVerifiedAt: new Date() },
    });
  }

  return Response.json({ verified });
}
