import { RequestedTokenType } from "@shopify/shopify-api";
import { shopify } from "@/lib/shopify/client";
import { verifySessionToken, InvalidSessionTokenError } from "@/lib/shopify/session";
import { getOrCreateAccountForShop } from "@/lib/shopify/tenant";
import { setShopSessionCookie } from "@/lib/shopify/session-cookie";
import { reconcileDataWebhooks } from "@/lib/shopify/webhooks-register";

// POST /api/shopify/session
// Called by the embedded frontend on load with the App Bridge session token
// (Authorization: Bearer <token>). Exchanges it for an offline access token
// via token exchange - this is what lets a merchant land in a working,
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

  const account = await getOrCreateAccountForShop(session.shop, session.accessToken, session.scope ?? "");

  // Establish the first-party embedded session so the reused dashboard UI and
  // API routes under /shopify-admin resolve this shop's Account without Clerk.
  await setShopSessionCookie({ shopDomain: session.shop, accountId: account.id });

  // Reconcile the optional-scope-gated webhooks (orders/paid, customers/create)
  // against what the merchant has granted. Fire-and-forget: a failure here must
  // not block the merchant from loading the embedded app.
  reconcileDataWebhooks(session.shop).catch((err) => {
    console.error("[shopify/session] reconcileDataWebhooks failed", session.shop, err);
  });

  return Response.json({ ok: true, shop: session.shop });
}
