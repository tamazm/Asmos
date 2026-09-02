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
    where: { accountId: account.id, status: { not: "ARCHIVED" } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      createdAt: true,
      // The placement (trigger/delay/page-targeting) the widget reads lives on
      // each variant's `targeting` JSON, set identically across a campaign's
      // variants — so the first variant is a faithful representative for the UI.
      variants: {
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { targeting: true },
      },
    },
  });

  // Aggregate revenue attribution across leads with orders for this shop's account
  let totalAttributedRevenue = 0;
  let totalAttributedOrders = 0;
  let currency = "USD";

  if (campaigns.length > 0) {
    const campaignIds = campaigns.map((c) => c.id);
    const convertedLeads = await prisma.lead.findMany({
      where: {
        variant: { campaignId: { in: campaignIds } },
        firstOrderId: { not: null },
      },
      select: {
        firstOrderId: true,
        firstOrderAmount: true,
        firstOrderCurrency: true,
      },
    });

    for (const lead of convertedLeads) {
      totalAttributedOrders += 1;
      const amt = parseFloat(String(lead.firstOrderAmount || "0"));
      if (!isNaN(amt)) totalAttributedRevenue += amt;
      if (lead.firstOrderCurrency) currency = lead.firstOrderCurrency;
    }
  }

  // Flatten the representative variant's targeting into a `placement` field so
  // the embedded UI never has to know popups are stored per-variant.
  const shaped = campaigns.map((c: { variants: { targeting: unknown }[] } & Record<string, unknown>) => {
    const { variants, ...rest } = c;
    const t = (variants[0]?.targeting ?? {}) as Record<string, unknown>;
    const pages = (t.pages ?? {}) as Record<string, unknown>;
    return {
      ...rest,
      placement: {
        trigger: (t.trigger as string) ?? "time_delay",
        delaySeconds: typeof t.delaySeconds === "number" ? t.delaySeconds : 5,
        minCartSubtotal: typeof t.minCartSubtotal === "number" ? t.minCartSubtotal : null,
        suppressIfCustomer: Boolean(t.suppressIfCustomer),
        autoApplyDiscount: t.autoApplyDiscount !== false,
        pages: {
          mode: (pages.mode as string) ?? "all",
          patterns: Array.isArray(pages.patterns) ? pages.patterns.map(String) : [],
        },
      },
    };
  });

  return Response.json({
    campaigns: shaped,
    stats: {
      totalRevenue: Math.round(totalAttributedRevenue * 100) / 100,
      totalOrders: totalAttributedOrders,
      convertedLeads: allLeads.length,
      currency,
    },
  });
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
