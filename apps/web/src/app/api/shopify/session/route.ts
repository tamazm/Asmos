import { RequestedTokenType } from "@shopify/shopify-api";
import { shopify } from "@/lib/shopify/client";
import { verifySessionToken, InvalidSessionTokenError } from "@/lib/shopify/session";
import { getOrCreateAccountForShop } from "@/lib/shopify/tenant";

// POST /api/shopify/session
// Called by the embedded frontend on load with the App Bridge session token
// (Authorization: Bearer <token>). Exchanges it for an offline access token
// via token exchange — this is what lets a merchant land in a working,
// authenticated embedded admin without ever going through a separate
// sign-up screen (already-installed shops just re-prove their session).
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

  const authHeader = request.headers.get("authorization") ?? request.headers.get("Authorization");
  const sessionToken = authHeader!.replace(/^Bearer /, "");

  const { session } = await shopify.auth.tokenExchange({
    shop: shopDomain,
    sessionToken,
    requestedTokenType: RequestedTokenType.OfflineAccessToken,
  });

  if (!session.accessToken) {
    return Response.json({ error: "Token exchange did not return an access token" }, { status: 502 });
  }

  await getOrCreateAccountForShop(session.shop, session.accessToken, session.scope ?? "");

  return Response.json({ ok: true, shop: session.shop });
}
