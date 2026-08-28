import { auth } from "@/lib/auth-adapter";
import { getOrCreateAccount } from "@/lib/account";
import { verifyLinkToken, InvalidLinkTokenError } from "@/lib/shopify/linkToken";
import { linkShopToAccount, ShopLinkError } from "@/lib/shopify/tenant";

// POST /api/shopify/connect
// The confirm step of "connect your existing Asmos account", run on app.asmos.io
// in the TOP frame (see /connect/shopify). Requires BOTH halves of the proof:
//   1. A valid link token (proves control of the shop's embedded admin).
//   2. A signed-in Clerk user (proves ownership of the Asmos account).
// Body: { token, websiteId? }. Re-points the shop onto the caller's account.
export async function POST(request: Request): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "You need to be signed in to Asmos." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { token?: string; websiteId?: string | null };
  if (!body.token) return Response.json({ error: "Missing connection token." }, { status: 400 });

  let shopDomain: string;
  let fromAccountId: string;
  try {
    ({ shopDomain, fromAccountId } = verifyLinkToken(body.token));
  } catch (err) {
    if (err instanceof InvalidLinkTokenError) return Response.json({ error: err.message }, { status: 400 });
    throw err;
  }

  const account = await getOrCreateAccount();

  try {
    await linkShopToAccount(shopDomain, account.id, {
      websiteId: body.websiteId ?? null,
      expectedFromAccountId: fromAccountId,
    });
  } catch (err) {
    if (err instanceof ShopLinkError) return Response.json({ error: err.message }, { status: 409 });
    console.error("[shopify/connect] link failed", shopDomain, err);
    return Response.json({ error: "Could not connect this store. Please try again." }, { status: 500 });
  }

  // Send the merchant back into the embedded app inside the Shopify admin.
  const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY || process.env.SHOPIFY_API_KEY || "";
  const returnUrl = apiKey ? `https://${shopDomain}/admin/apps/${apiKey}` : `https://${shopDomain}/admin`;
  return Response.json({ ok: true, shopDomain, returnUrl });
}
