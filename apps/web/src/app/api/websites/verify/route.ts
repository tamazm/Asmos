import { auth } from "@/lib/auth-adapter";
import { getOrCreateAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/websites/verify
 * Check whether the Asmos widget snippet is live on the merchant's site.
 *
 * Body: { websiteId: string }
 *
 * Responses:
 *   { verified: true }
 *   { verified: false, reason: "snippet_not_detected" }
 *   { verified: false, reason: "unreachable" }
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
    select: { id: true, url: true },
  });

  if (!website) {
    return Response.json({ error: "Website not found" }, { status: 404 });
  }

  if (!website.url) {
    return Response.json({ verified: false, reason: "unreachable" });
  }

  // Attempt to fetch the site and check for the snippet in the first 50KB
  try {
    const siteUrl = website.url.startsWith("http")
      ? website.url
      : `https://${website.url}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    let res: Response;
    try {
      res = await fetch(siteUrl, {
        signal: controller.signal,
        headers: { "User-Agent": "Asmos-Verifier/1.0" },
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      return Response.json({ verified: false, reason: "unreachable" });
    }

    // Read first 50KB only
    const reader = res.body?.getReader();
    const MAX_BYTES = 50 * 1024;
    let html = "";
    if (reader) {
      const decoder = new TextDecoder();
      let bytesRead = 0;
      while (bytesRead < MAX_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        bytesRead += value.byteLength;
        html += decoder.decode(value, { stream: !done });
        if (bytesRead >= MAX_BYTES) {
          await reader.cancel();
          break;
        }
      }
    } else {
      const text = await res.text();
      html = text.slice(0, MAX_BYTES);
    }

    const snippetFound =
      html.includes("asmos-widget.js") || html.includes("data-asmos-key");

    if (snippetFound) {
      await prisma.website.update({
        where: { id: website.id },
        data: { installVerified: true, installVerifiedAt: new Date() },
      });
      return Response.json({ verified: true });
    }

    return Response.json({ verified: false, reason: "snippet_not_detected" });
  } catch {
    return Response.json({ verified: false, reason: "unreachable" });
  }
}
