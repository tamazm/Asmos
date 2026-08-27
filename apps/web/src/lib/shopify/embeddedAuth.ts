import { readShopSessionFromCookies } from "./session-cookie";
import { verifySessionToken, InvalidSessionTokenError } from "./session";
import { getAccountForShop } from "./tenant";

// Resolves the Account for an embedded Shopify request. Prefers the signed
// session cookie; falls back to a valid App Bridge session token, which App
// Bridge attaches as `Authorization: Bearer <token>` to fetches automatically —
// so this works even when the third-party cookie is blocked. Returns null if
// neither identifies an installed shop.
//
// API routes that must serve embedded merchants should use this instead of the
// Clerk-only `auth()` userId check.
export async function getEmbeddedAccount(request?: Request) {
  const cookieSession = await readShopSessionFromCookies();
  if (cookieSession) {
    const account = await getAccountForShop(cookieSession.shopDomain);
    if (account) return account;
  }

  if (request) {
    try {
      const { shopDomain } = await verifySessionToken(request);
      const account = await getAccountForShop(shopDomain);
      if (account) return account;
    } catch (err) {
      if (!(err instanceof InvalidSessionTokenError)) throw err;
    }
  }

  return null;
}
