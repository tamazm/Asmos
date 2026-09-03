import { shopify } from "@/lib/shopify/client";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/lib/inngest/client";
import { redactCustomer, collectCustomerData, redactShop } from "@/lib/shopify/compliance";
import { applyShopifySubscription } from "@/lib/shopify/billingSync";

// POST /api/shopify/webhooks
// Handles the four mandatory compliance topics every listed Shopify app
// must respond to (app/uninstalled, customers/data_request,
// customers/redact, shop/redact) plus is the single endpoint any future
// topic subscription should point at. HMAC-verified via shopify.webhooks.validate.
//
// The three GDPR topics are actioned via lib/shopify/compliance.ts: leads are
// located by the stored Shopify customer_id (Lead.shopifyCustomerId, set by the
// customers/create webhook) or email, then anonymized (customers/redact) or
// collected (customers/data_request); shop/redact erases the shop's data.
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
      // Defensive downgrade: Shopify auto-cancels the app subscription on
      // uninstall and should also fire app_subscriptions/update, but if that
      // event is missed we must not leave the account entitled to a plan it no
      // longer pays for. Only touch accounts this shop was billing.
      await prisma.account.updateMany({
        where: { shopifyShop: { shopDomain }, billingSource: "SHOPIFY" },
        data: { billingSource: "NONE", planTier: "FREE", subscriptionStatus: "CANCELED", shopifySubscriptionId: null },
      });
      break;
    }
    case "customers/data_request": {
      const data = await collectCustomerData(shopDomain, payload?.customer?.id, payload?.customer?.email);
      console.log("[shopify/webhooks] customers/data_request collected", {
        shopDomain,
        leads: data.leads.length,
      });
      break;
    }
    case "customers/redact": {
      const res = await redactCustomer(shopDomain, payload?.customer?.id, payload?.customer?.email);
      console.log("[shopify/webhooks] customers/redact done", { shopDomain, redacted: res.redacted });
      break;
    }
    case "shop/redact": {
      const res = await redactShop(shopDomain);
      console.log("[shopify/webhooks] shop/redact done", { shopDomain, ...res });
      break;
    }
    case "orders/paid": {
      // Handle async so the endpoint returns 200 fast and gets Inngest retries.
      await inngest.send({ name: "shopify/order.paid", data: { shopDomain, order: payload } });
      break;
    }
    case "customers/create": {
      await inngest.send({ name: "shopify/customer.created", data: { shopDomain, customer: payload } });
      break;
    }
    case "app_subscriptions/update": {
      await applyShopifySubscription(shopDomain, payload?.app_subscription ?? {});
      break;
    }
    default: {
      console.warn("[shopify/webhooks] unhandled topic", { topic, shopDomain });
    }
  }

  return Response.json({ ok: true });
}
