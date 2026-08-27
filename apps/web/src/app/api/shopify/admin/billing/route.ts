import { prisma } from "@/lib/prisma";
import { getEmbeddedAccount } from "@/lib/shopify/embeddedAuth";
import { getActiveSubscription, createSubscription, PLANS } from "@/lib/shopify/billing";

const APP_URL = process.env.SHOPIFY_APP_URL || "https://app.asmos.io";

async function shopFor(request: Request) {
  const account = await getEmbeddedAccount(request);
  if (!account) return null;
  return prisma.shopifyShop.findUnique({
    where: { accountId: account.id },
    select: { shopDomain: true },
  });
}

// GET — current subscription status for the embedded merchant.
export async function GET(request: Request): Promise<Response> {
  const shop = await shopFor(request);
  if (!shop) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const subscription = await getActiveSubscription(shop.shopDomain);
  return Response.json({ subscription });
}

// POST { plan: "growth" | "scale" } — start a subscription; returns the
// confirmationUrl the merchant approves.
export async function POST(request: Request): Promise<Response> {
  const shop = await shopFor(request);
  if (!shop) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let planKey = "growth";
  try {
    const body = await request.json();
    if (body?.plan) planKey = String(body.plan);
  } catch {
    /* default plan */
  }

  const plan = PLANS[planKey];
  if (!plan) return Response.json({ error: `Unknown plan: ${planKey}` }, { status: 400 });

  const returnUrl = `${APP_URL}/shopify-admin?billing=done`;
  const test = process.env.NODE_ENV !== "production";

  try {
    const { confirmationUrl } = await createSubscription(shop.shopDomain, plan, returnUrl, test);
    return Response.json({ confirmationUrl });
  } catch (err) {
    console.error("[shopify/admin/billing] createSubscription failed", err);
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}
