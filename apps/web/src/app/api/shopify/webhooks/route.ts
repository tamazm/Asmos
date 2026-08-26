import { shopify } from "@/lib/shopify/client";
import { prisma } from "@/lib/prisma";

// POST /api/shopify/webhooks
// Handles the four mandatory compliance topics every listed Shopify app
// must respond to (app/uninstalled, customers/data_request,
// customers/redact, shop/redact) plus is the single endpoint any future
// topic subscription should point at. HMAC-verified via shopify.webhooks.validate.
//
// NOTE: customers/data_request and customers/redact currently only log and
// acknowledge (200) — they do NOT yet locate/export/delete the merchant's
// Lead rows tied to the named Shopify customer, because there's no stored
// mapping from a Shopify customer_id to a Lead today. That mapping and the
// actual data actions must exist before this app can be submitted for
// review — tracked as a Milestone B1 follow-up, not shipped here.
export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();

  const validation = await shopify.webhooks.validate({
    rawBody,
    rawRequest: request,
  });

  if (!validation.valid) {
    return Response.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  const { topic, domain: shopDomain } = validation;
  const payload = rawBody ? JSON.parse(rawBody) : {};

  switch (topic) {
    case "app/uninstalled": {
      await prisma.shopifyShop.updateMany({
        where: { shopDomain },
        data: { uninstalledAt: new Date() },
      });
      break;
    }
    case "customers/data_request": {
      console.warn("[shopify/webhooks] customers/data_request received, not yet actioned", {
        shopDomain,
        customerId: payload?.customer?.id,
      });
      break;
    }
    case "customers/redact": {
      console.warn("[shopify/webhooks] customers/redact received, not yet actioned", {
        shopDomain,
        customerId: payload?.customer?.id,
      });
      break;
    }
    case "shop/redact": {
      console.warn("[shopify/webhooks] shop/redact received, not yet actioned", { shopDomain });
      break;
    }
    default: {
      console.warn("[shopify/webhooks] unhandled topic", { topic, shopDomain });
    }
  }

  return Response.json({ ok: true });
}
