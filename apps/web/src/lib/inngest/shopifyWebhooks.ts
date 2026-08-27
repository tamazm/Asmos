import { inngest } from "./client";
import { prisma } from "@/lib/prisma";
import { getAccountForShop } from "@/lib/shopify/tenant";

// Revenue attribution: when a Shopify order is paid, match the discount codes
// on it against the code the popup issued (single-use CouponCode pool first,
// then a legacy shared reward code) to find the Lead — and therefore the
// Variant — that converted the shopper. Records the first attributed order on
// the Lead so analytics can sum popup-driven revenue per variant.
export const shopifyOrderPaid = inngest.createFunction(
  { id: "shopify-order-paid", triggers: { event: "shopify/order.paid" }, retries: 3 },
  async ({ event, step }) => {
    const { order } = event.data as { shopDomain: string; order: any };

    const codes: string[] = Array.isArray(order?.discount_codes)
      ? order.discount_codes.map((d: any) => d?.code).filter(Boolean)
      : [];
    if (codes.length === 0) return { attributed: false, reason: "no discount codes" };

    const lead = await step.run("find-lead", async () => {
      const coupon = await prisma.couponCode.findFirst({
        where: { code: { in: codes }, leadId: { not: null } },
        select: { lead: { select: { id: true, firstOrderId: true } } },
      });
      if (coupon?.lead) return coupon.lead;
      return prisma.lead.findFirst({
        where: { rewardClaimedCode: { in: codes } },
        select: { id: true, firstOrderId: true },
        orderBy: { createdAt: "desc" },
      });
    });
    if (!lead) return { attributed: false, reason: "no matching lead" };
    if (lead.firstOrderId) return { attributed: false, reason: "already attributed" };

    await step.run("attribute", async () => {
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          firstOrderId: String(order?.id ?? ""),
          // Prisma accepts a numeric string for Decimal fields.
          firstOrderAmount: order?.total_price ?? null,
          firstOrderCurrency: order?.currency ?? null,
          firstOrderAt: new Date(),
          becameCustomerAt: new Date(),
          shopifyCustomerId: order?.customer?.id != null ? String(order.customer.id) : undefined,
        },
      });
    });

    return { attributed: true, leadId: lead.id };
  },
);

// Customer tracking: when a Shopify customer is created, link them to any popup
// Lead with the same email under this shop's account. This marks the lead as
// converted to a customer and, crucially, records the Shopify customer_id —
// the mapping GDPR customers/redact needs to locate and delete the lead.
export const shopifyCustomerCreated = inngest.createFunction(
  { id: "shopify-customer-created", triggers: { event: "shopify/customer.created" }, retries: 3 },
  async ({ event, step }) => {
    const { shopDomain, customer } = event.data as { shopDomain: string; customer: any };

    const email: string | null = customer?.email ? String(customer.email) : null;
    const customerId: string | null = customer?.id != null ? String(customer.id) : null;
    if (!email) return { matched: false, reason: "no email" };

    const account = await step.run("resolve-account", () => getAccountForShop(shopDomain));
    if (!account) return { matched: false, reason: "no account" };

    const updated = await step.run("link-leads", async () => {
      return prisma.lead.updateMany({
        where: {
          email: { equals: email, mode: "insensitive" },
          variant: { campaign: { accountId: account.id } },
        },
        data: {
          shopifyCustomerId: customerId,
          becameCustomerAt: new Date(),
        },
      });
    });

    return { matched: updated.count > 0, count: updated.count };
  },
);
