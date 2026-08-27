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

  // Fail loudly-but-cleanly if the deployment is missing its Shopify server
  // credentials, instead of letting tokenExchange throw an opaque 500 (which
  // reaches the client as an empty body / "Unexpected end of JSON input").
  if (!process.env.SHOPIFY_API_KEY || !process.env.SHOPIFY_API_SECRET) {
    console.error("[shopify/session] missing SHOPIFY_API_KEY / SHOPIFY_API_SECRET env");
    return Response.json(
      { error: "Server is missing Shopify credentials (SHOPIFY_API_KEY / SHOPIFY_API_SECRET)." },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get("authorization") ?? request.headers.get("Authorization");
  const sessionToken = authHeader!.replace(/^Bearer /, "");

  let session;
  try {
    ({ session } = await shopify.auth.tokenExchange({
      shop: shopDomain,
      sessionToken,
      requestedTokenType: RequestedTokenType.OfflineAccessToken,
    }));
  } catch (err) {
    console.error("[shopify/session] tokenExchange failed", shopDomain, err);
    return Response.json(
      { error: `Token exchange failed: ${(err as Error).message}` },
      { status: 502 },
    );
  }

  if (!session.accessToken) {
    return Response.json({ error: "Token exchange did not return an access token" }, { status: 502 });
  }

  // Provision/refresh the shop's Account and establish the first-party embedded
  // session cookie. Wrapped so a DB failure (e.g. migrations not yet applied to
  // this environment) or a missing SHOPIFY_TOKEN_ENCRYPTION_KEY surfaces as a
  // readable JSON error instead of an empty-body 500.
  let account;
  try {
    account = await getOrCreateAccountForShop(session.shop, session.accessToken, session.scope ?? "");
    // The reused dashboard UI and /shopify-admin API routes resolve this shop's
    // Account from this cookie (no Clerk).
    await setShopSessionCookie({ shopDomain: session.shop, accountId: account.id });
  } catch (err) {
    console.error("[shopify/session] account provisioning failed", session.shop, err);
    return Response.json(
      { error: `Account provisioning failed: ${(err as Error).message}` },
      { status: 500 },
    );
  }

  // Reconcile the optional-scope-gated webhooks (orders/paid, customers/create)
  // against what the merchant has granted. Fire-and-forget: a failure here must
  // not block the merchant from loading the embedded app.
  reconcileDataWebhooks(session.shop).catch((err) => {
    console.error("[shopify/session] reconcileDataWebhooks failed", session.shop, err);
  });

  return Response.json({ ok: true, shop: session.shop });
}
