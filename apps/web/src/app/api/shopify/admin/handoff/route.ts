import { prisma } from "@/lib/prisma";
import { verifySessionToken, InvalidSessionTokenError } from "@/lib/shopify/session";
import { createSsoToken } from "@/lib/shopify/ssoToken";

// POST /api/shopify/admin/handoff  { path?: string }
// Authed by the App Bridge session token (so only someone inside this shop's
// embedded admin can mint it). Returns a top-frame URL that, when opened, logs
// the merchant into the web dashboard as this shop's account and lands them on
// `path`. This is the "no Clerk login wall" bridge for the popup builder and
// any other web-only surface the embed links out to.
export async function POST(request: Request): Promise<Response> {
  let shopDomain: string;
  try {
    ({ shopDomain } = await verifySessionToken(request));
  } catch (err) {
    if (err instanceof InvalidSessionTokenError) {
      return Response.json({ error: err.message }, { status: 401 });
    }
    throw err;
  }

  const shop = await prisma.shopifyShop.findUnique({
    where: { shopDomain },
    select: { accountId: true, uninstalledAt: true },
  });
  if (!shop || shop.uninstalledAt) {
    return Response.json({ error: "This store isn't installed." }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as { path?: string };
  const token = createSsoToken(shopDomain, shop.accountId);
  const appUrl = process.env.SHOPIFY_APP_URL || "https://app.asmos.io";
  const next = sanitizeNext(body.path);
  const url = `${appUrl}/api/shopify/sso?token=${encodeURIComponent(token)}&next=${encodeURIComponent(next)}`;
  return Response.json({ url });
}

// Only allow app-internal absolute paths as the destination: a single leading
// slash followed by a char that is NOT "/" or "\" (both collapse to a
// protocol-relative "//evil.com" under WHATWG URL parsing → open redirect).
// Non-string, empty, or anything else falls back to /campaigns.
function sanitizeNext(path?: unknown): string {
  if (typeof path !== "string" || !/^\/[^/\\]/.test(path)) return "/campaigns";
  return path;
}
