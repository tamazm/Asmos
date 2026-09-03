import { prisma } from "@/lib/prisma";
import { getEmbeddedAccount } from "@/lib/shopify/embeddedAuth";
import { getActiveSubscription, createSubscription, PLANS } from "@/lib/shopify/billing";
import { canStartShopifyCharge } from "@/lib/billing/source";

const APP_URL = process.env.SHOPIFY_APP_URL || "https://app.asmos.io";

// Resolve the embedded merchant's account AND its shop domain in one place.
async function resolve(request: Request) {
  const account = await getEmbeddedAccount(request);
  if (!account) return null;
  const shop = await prisma.shopifyShop.findUnique({
    where: { accountId: account.id },
    select: { shopDomain: true },
  });
  if (!shop) return null;
  return { account, shopDomain: shop.shopDomain };
}

// GET — current subscription status for the embedded merchant.
export async function GET(request: Request): Promise<Response> {
  const ctx = await resolve(request);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const plans = Object.values(PLANS).map((p) => ({
    key: p.key,
    name: p.name,
    amount: p.amount,
    currencyCode: p.currencyCode,
    interval: p.interval,
    trialDays: p.trialDays ?? null,
  }));

  // If this account is actively billed by Stripe (web-first merchant who later
  // connected their store), the embed must NOT offer a Shopify charge — that
  // would double-bill and violates "one rail per account". Show it read-only.
  if (!canStartShopifyCharge(ctx.account)) {
    return Response.json({
      managedElsewhere: true,
      planTier: ctx.account.planTier,
      subscriptionStatus: ctx.account.subscriptionStatus,
      plans,
      subscription: null,
    });
  }

  const subscription = await getActiveSubscription(ctx.shopDomain);
  return Response.json({ managedElsewhere: false, subscription, plans });
}

// POST { plan } — start a Shopify subscription; returns the confirmationUrl.
export async function POST(request: Request): Promise<Response> {
  const ctx = await resolve(request);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // Hard guard: refuse to create a Shopify charge while Stripe actively owns
  // the account. Belt-and-suspenders with the GET read-only state above.
  if (!canStartShopifyCharge(ctx.account)) {
    return Response.json(
      {
        error:
          "Your Asmos plan is billed by card and managed in Asmos. Manage or cancel it there before switching to Shopify billing.",
        managedElsewhere: true,
      },
      { status: 409 },
    );
  }

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
    const { confirmationUrl } = await createSubscription(ctx.shopDomain, plan, returnUrl, test);
    return Response.json({ confirmationUrl });
  } catch (err) {
    console.error("[shopify/admin/billing] createSubscription failed", err);
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}
