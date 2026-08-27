import { prisma } from "@/lib/prisma";
import { inngest } from "@/lib/inngest/client";
import { getEmbeddedAccount } from "@/lib/shopify/embeddedAuth";

// Embedded admin API — authenticated by the shop session (cookie or App Bridge
// session token) via getEmbeddedAccount, NOT Clerk. This is the pattern all
// /api/shopify/admin/* routes follow so the embedded UI can read/write the
// shop's Asmos data without a Clerk sign-in.

export async function GET(request: Request): Promise<Response> {
  const account = await getEmbeddedAccount(request);
  if (!account) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const campaigns = await prisma.campaign.findMany({
    where: { accountId: account.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, type: true, status: true, createdAt: true },
  });
  return Response.json({ campaigns });
}

export async function POST(request: Request): Promise<Response> {
  const account = await getEmbeddedAccount(request);
  if (!account) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // The shop's Website (linked on install, see lib/shopify/tenant.ts) is where
  // its popups live and what /api/widget/config?shop= resolves.
  const shop = await prisma.shopifyShop.findUnique({
    where: { accountId: account.id },
    select: { shopDomain: true, websiteId: true },
  });
  if (!shop?.websiteId) {
    return Response.json({ error: "No website is linked to this shop yet." }, { status: 409 });
  }

  let goal = "BOTH";
  try {
    const body = await request.json();
    if (body?.goal) goal = String(body.goal);
  } catch {
    /* no body — default goal */
  }

  const campaign = await prisma.campaign.create({
    data: {
      accountId: account.id,
      websiteId: shop.websiteId,
      name: `${shop.shopDomain} — Popup`,
      type: "FORM",
      status: "GENERATING",
      generationContext: { storeUrl: `https://${shop.shopDomain}`, goal },
    },
    select: { id: true },
  });

  try {
    await inngest.send({ name: "campaign.generate", data: { campaignId: campaign.id } });
  } catch (err) {
    console.error("[shopify/admin/campaigns] inngest.send failed", err);
    await prisma.campaign
      .update({
        where: { id: campaign.id },
        data: { status: "FAILED", lastError: "Failed to queue campaign generation." },
      })
      .catch(() => {});
    return Response.json({ error: "Failed to queue campaign generation." }, { status: 502 });
  }

  return Response.json({ id: campaign.id, status: "GENERATING" });
}
