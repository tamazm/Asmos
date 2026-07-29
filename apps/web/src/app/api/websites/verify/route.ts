import { auth } from "@/lib/auth-adapter";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/websites/verify
 * Attempts to verify that the Asmos snippet is installed on the merchant's site.
 * Strategy: fetch the site's homepage HTML and look for data-asmos-key.
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    websiteId?: string;
  };

  if (!body.websiteId) {
    return Response.json({ error: "websiteId is required" }, { status: 400 });
  }

  const account = await getOrCreateAccount();

  const website = await prisma.website.findFirst({
    where: { id: body.websiteId, accountId: account.id },
  });

  if (!website) {
    return Response.json({ error: "Website not found" }, { status: 404 });
  }

  // Attempt to fetch the site and check for the snippet
  try {
    const siteUrl = website.url.startsWith("http")
      ? website.url
      : `https://${website.url}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(siteUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "Asmos-Verifier/1.0" },
    }).finally(() => clearTimeout(timeout));

    const html = await res.text();
    const verified =
      html.includes("data-asmos-key") ||
      html.includes("asmos-widget.js");

    if (verified) {
      await prisma.website.update({
        where: { id: website.id },
        data: { installVerified: true, installVerifiedAt: new Date() },
      });
    }

    return Response.json({ verified });
  } catch {
    // If we can't reach the site, return unverified without error
    return Response.json({ verified: false });
  }
}
