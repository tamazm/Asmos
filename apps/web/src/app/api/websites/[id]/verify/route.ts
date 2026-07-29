import { auth } from "@/lib/auth-adapter";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/websites/[id]/verify">,
) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const account = await getOrCreateAccount();
  const website = await prisma.website.findFirst({
    where: { id, accountId: account.id },
  });
  if (!website) {
    return Response.json({ error: "Website not found" }, { status: 404 });
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
