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
    select: { id: true, url: true },
  });
  if (!website) {
    return Response.json({ error: "Website not found" }, { status: 404 });
  }

  if (!website.url) {
    return Response.json({ verified: false, reason: "unreachable" });
  }

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
    }

    return Response.json({
      verified: snippetFound,
      ...(snippetFound ? {} : { reason: "snippet_not_detected" }),
    });
  } catch {
    return Response.json({ verified: false, reason: "unreachable" });
  }
}
