import { prisma } from "@/lib/prisma";
import { getEmbeddedAccount } from "@/lib/shopify/embeddedAuth";
import { getSegmentsOverview } from "@/lib/shopify/segments";

// Embedded admin — the shop's Shopify customer segments ("Audiences" panel).
// Backs the App Store "Forms" category requirement that the app query `segments`
// and `customerSegmentMembers`. Both need the read_customers optional scope, so
// this returns { needsScope: true } (200, not an error) when it isn't granted
// yet — the UI then nudges the merchant to allow Customers instead of showing a
// scary failure. Authed by the shop session like every /api/shopify/admin/* route.
export async function GET(request: Request): Promise<Response> {
  const account = await getEmbeddedAccount(request);
  if (!account) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const shop = await prisma.shopifyShop.findUnique({
    where: { accountId: account.id },
    select: { shopDomain: true, uninstalledAt: true },
  });
  if (!shop || shop.uninstalledAt) {
    return Response.json({ error: "No connected Shopify store." }, { status: 409 });
  }

  try {
    const overview = await getSegmentsOverview(shop.shopDomain);
    return Response.json(overview);
  } catch (err) {
    // The queries need read_customers; a missing-scope/permission error is an
    // expected state, not a server fault. Surface it as a soft "grant the scope"
    // signal rather than a 500.
    const message = (err as Error).message ?? "";
    if (/access denied|not approved|scope|permission|read_customers/i.test(message)) {
      return Response.json({ needsScope: true, segments: [] });
    }
    console.error("[shopify/admin/segments] failed", shop.shopDomain, err);
    return Response.json({ error: "Could not load segments." }, { status: 502 });
  }
}
