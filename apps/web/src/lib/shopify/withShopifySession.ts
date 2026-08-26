import type { Account } from "@prisma/client";
import { verifySessionToken, InvalidSessionTokenError } from "./session";
import { getAccountForShop } from "./tenant";

type ShopifyRouteHandler = (
  request: Request,
  ctx: { shopDomain: string; account: Account },
) => Promise<Response>;

// Wraps a shopify-admin API route handler with session-token verification
// and tenant resolution — the Shopify analog of calling auth() +
// getOrCreateAccount() at the top of a Clerk-gated route. Every route under
// /api/shopify/admin/* should be wrapped with this.
export function withShopifySession(handler: ShopifyRouteHandler) {
  return async (request: Request): Promise<Response> => {
    let shopDomain: string;
    try {
      ({ shopDomain } = await verifySessionToken(request));
    } catch (err) {
      if (err instanceof InvalidSessionTokenError) {
        return Response.json({ error: err.message }, { status: 401 });
      }
      throw err;
    }

    const account = await getAccountForShop(shopDomain);
    if (!account) {
      return Response.json({ error: "Shop is not installed" }, { status: 403 });
    }

    return handler(request, { shopDomain, account });
  };
}
