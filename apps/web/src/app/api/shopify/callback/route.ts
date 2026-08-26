import { shopify } from "@/lib/shopify/client";
import { getOrCreateAccountForShop } from "@/lib/shopify/tenant";

// GET /api/shopify/callback - OAuth callback Shopify redirects to after the
// merchant approves scopes on the /api/shopify/install redirect. Exchanges
// the code for an offline access token, provisions the Account/ShopifyShop
// (no Clerk sign-up involved), then redirects into the embedded admin.
export async function GET(request: Request): Promise<Response> {
  const { headers, session } = await shopify.auth.callback({
    rawRequest: request,
  });

  if (!session.accessToken) {
    return Response.json({ error: "OAuth callback did not return an access token" }, { status: 502 });
  }

  await getOrCreateAccountForShop(session.shop, session.accessToken, session.scope ?? "");

  const embeddedAppUrl = await shopify.auth.getEmbeddedAppUrl({ rawRequest: request });

  const redirectHeaders = new Headers(headers as HeadersInit);
  redirectHeaders.set("Location", embeddedAppUrl);
  return new Response(null, { status: 302, headers: redirectHeaders });
}
