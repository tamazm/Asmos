import { prisma } from "@/lib/prisma";
import { verifySessionToken, InvalidSessionTokenError } from "@/lib/shopify/session";
import { createLinkToken } from "@/lib/shopify/linkToken";

// POST /api/shopify/admin/connect
// Mints a short-lived link token for the "connect your existing Asmos account"
// flow. Authed by the App Bridge session token (NOT the shop cookie) so the
// token can only ever be minted by someone actually inside this shop's embedded
// admin — that's the shop-ownership half of the linking proof. The embedded UI
// then opens {appUrl}/connect/shopify?token=… in the TOP frame (breaking out of
// the Shopify iframe so Clerk sign-in works), where the merchant proves the
// other half: ownership of the Asmos account.
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

  const shop = await prisma.shopifyShop.findUnique({
    where: { shopDomain },
    select: { accountId: true, uninstalledAt: true },
  });
  if (!shop || shop.uninstalledAt) {
    return Response.json({ error: "This store isn't installed." }, { status: 404 });
  }

  const token = createLinkToken(shopDomain, shop.accountId);
  const appUrl = process.env.SHOPIFY_APP_URL || "https://app.asmos.io";
  const url = `${appUrl}/connect/shopify?token=${encodeURIComponent(token)}`;
  return Response.json({ url });
}
