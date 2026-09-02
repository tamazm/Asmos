import { cookies } from "next/headers";
import { auth } from "@/lib/auth-adapter";
import { getOrCreateAccount } from "@/lib/account";
import { shopify } from "@/lib/shopify/client";

// GET /api/shopify/install?shop=example.myshopify.com
// Entry point Shopify (or a merchant typing the app URL directly) hits to
// start install. Begins classic OAuth - the offline token this produces is
// what every later request re-authenticates against via token exchange
// (see /api/shopify/session), so this route only needs to run once per shop.
export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const shopParam = searchParams.get("shop");
  if (!shopParam) {
    return Response.json({ error: "Missing shop parameter" }, { status: 400 });
  }

  const shop = shopify.utils.sanitizeShop(shopParam, false);
  if (!shop) {
    return Response.json({ error: "Invalid shop parameter" }, { status: 400 });
  }

  // If initiated by a signed-in Asmos user, record their accountId in an HTTP-only cookie
  // so the OAuth callback can immediately link this shop to their Asmos account.
  try {
    const { userId } = await auth();
    if (userId) {
      const account = await getOrCreateAccount().catch(() => null);
      if (account) {
        const cookieStore = await cookies();
        cookieStore.set("asmos_install_account_id", account.id, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 3600, // 1 hour
        });
      }
    }
  } catch {
    /* Non-fatal: install proceeds via standard OAuth */
  }

  return shopify.auth.begin({
    shop,
    callbackPath: "/api/shopify/callback",
    isOnline: false,
    rawRequest: request,
  });
}
