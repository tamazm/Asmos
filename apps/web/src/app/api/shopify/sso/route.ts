import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySsoToken, InvalidSsoTokenError } from "@/lib/shopify/ssoToken";
import { setFirstPartyShopSessionCookie } from "@/lib/shopify/session-cookie";

// GET /api/shopify/sso?token=…&next=/campaigns/new
// Top-frame landing for the handoff: verifies the one-time token, re-confirms
// the token's account still owns the installed shop, sets the first-party shop
// session cookie, then redirects to `next` on the app. Runs first-party on
// app.asmos.io (the merchant has broken out of the Shopify iframe), so the
// SameSite=Lax cookie sticks for subsequent dashboard requests.
export async function GET(request: Request): Promise<Response> {
  const appUrl = process.env.SHOPIFY_APP_URL || "https://app.asmos.io";
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token") ?? "";
  const next = safeInternalPath(searchParams.get("next"), appUrl);

  let shopDomain: string;
  let accountId: string;
  try {
    ({ shopDomain, accountId } = verifySsoToken(token));
  } catch (err) {
    if (err instanceof InvalidSsoTokenError) {
      // Fall back to normal sign-in rather than 500 on a stale/forged link.
      return NextResponse.redirect(new URL("/sign-in", appUrl), 302);
    }
    throw err;
  }

  // Re-verify ownership at exchange time: the shop could have uninstalled or
  // been re-linked to a different account since the token was minted.
  const shop = await prisma.shopifyShop.findUnique({
    where: { shopDomain },
    select: { accountId: true, uninstalledAt: true },
  });
  if (!shop || shop.uninstalledAt || shop.accountId !== accountId) {
    return NextResponse.redirect(new URL("/sign-in", appUrl), 302);
  }

  await setFirstPartyShopSessionCookie({ shopDomain, accountId });
  return NextResponse.redirect(new URL(next, appUrl), 302);
}

// Resolve an untrusted `next` param to a guaranteed-same-origin relative path.
// String-shape checks (regex on leading slashes) are NOT enough: the WHATWG URL
// parser strips tab/newline/CR before parsing, so `/\t/evil.com` becomes
// `//evil.com` → an off-origin redirect. The only robust check is to parse
// against appUrl and confirm the RESULT's origin matches, then return only the
// path+query+hash — never an absolute URL. Anything off-origin or unparseable
// falls back to /campaigns.
function safeInternalPath(raw: string | null, appUrl: string): string {
  const fallback = "/campaigns";
  if (!raw) return fallback;
  try {
    const u = new URL(raw, appUrl);
    if (u.origin !== new URL(appUrl).origin) return fallback;
    const rel = `${u.pathname}${u.search}${u.hash}`;
    return rel.startsWith("/") ? rel : fallback;
  } catch {
    return fallback;
  }
}
