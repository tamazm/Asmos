import { cookies } from "next/headers";
import { shopify } from "@/lib/shopify/client";
import { getOrCreateAccountForShop, linkShopToAccount } from "@/lib/shopify/tenant";

// GET /api/shopify/callback - OAuth callback Shopify redirects to after the
// merchant approves scopes on the /api/shopify/install redirect. Exchanges
// the code for an offline access token, provisions the Account/ShopifyShop
// (no Clerk sign-up involved), then redirects into the embedded admin.
export async function GET(request: Request): Promise<Response> {
  const { headers, session } = await shopify.auth.callback({
    rawRequest: request,
    // Request an expiring offline token (+ refresh token); permanent offline
    // tokens are deprecated (see /api/shopify/session).
    expiring: true,
  });

  if (!session.accessToken) {
    return Response.json({ error: "OAuth callback did not return an access token" }, { status: 502 });
  }

  await getOrCreateAccountForShop(session.shop, {
    accessToken: session.accessToken,
    scope: session.scope ?? "",
    expiresAt: session.expires ?? null,
    refreshToken: session.refreshToken ?? null,
    refreshTokenExpiresAt: session.refreshTokenExpires ?? null,
  });

  // If this install was started by a signed-in Asmos user, automatically link
  // this shop directly to their Asmos account.
  try {
    const cookieStore = await cookies();
    const installAccountId = cookieStore.get("asmos_install_account_id")?.value;
    if (installAccountId) {
      cookieStore.delete("asmos_install_account_id");
      await linkShopToAccount(session.shop, installAccountId).catch((err) => {
        console.warn("[shopify/callback] auto-link to install account failed", err);
      });
    }
  } catch {
    /* Non-fatal: shop remains on throwaway account until linked */
  }

  const embeddedAppUrl = await shopify.auth.getEmbeddedAppUrl({ rawRequest: request });

  const redirectHeaders = new Headers(headers as HeadersInit);
  redirectHeaders.set("Location", embeddedAppUrl);
  return new Response(null, { status: 302, headers: redirectHeaders });
}
