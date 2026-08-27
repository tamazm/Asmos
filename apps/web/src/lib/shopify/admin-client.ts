import { getAccessTokenForShop } from "./tenant";

// Minimal Admin GraphQL client: posts to the shop's Admin API with its stored
// (decrypted) offline token. A raw fetch keeps this independent of per-request
// SDK session juggling — any /api/shopify/admin/* feature that needs live shop
// data (billing, catalog, orders) can call this.
const API_VERSION = "2026-07";

export async function adminGraphql<T = any>(
  shopDomain: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const token = await getAccessTokenForShop(shopDomain);
  if (!token) throw new Error(`No Shopify access token for ${shopDomain}`);

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
