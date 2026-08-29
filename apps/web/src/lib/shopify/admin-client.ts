import { getValidAccessTokenForShop } from "./tenant";

// Minimal Admin GraphQL client: posts to the shop's Admin API with a currently
// valid (expiring) offline token, refreshing transparently as needed. A raw
// fetch keeps this independent of per-request SDK session juggling — any
// /api/shopify/admin/* feature that needs live shop data (billing, catalog,
// orders) can call this.
const API_VERSION = "2026-07";

export async function adminGraphql<T = any>(
  shopDomain: string,
  query: string,
  variables?: Record<string, unknown>,
  // An access token freshly obtained by the caller (e.g. the session route just
  // exchanged one) — passing it skips a redundant refresh round-trip. Omit to
  // resolve/refresh the shop's stored token.
  accessToken?: string,
): Promise<T> {
  const token = accessToken ?? (await getValidAccessTokenForShop(shopDomain));
  if (!token) throw new Error(`No valid Shopify access token for ${shopDomain}`);

  const res = await fetch(`https://${shopDomain}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();
  if (json.errors) {
    throw new Error(`Admin GraphQL error: ${JSON.stringify(json.errors)}`);
  }
  return json.data as T;
}
