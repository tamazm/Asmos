import { prisma } from "@/lib/prisma";
import { getAccountForShop } from "./tenant";

// Shopify's mandatory GDPR/CCPA compliance webhooks. Every listed app must
// action these, not just acknowledge them. The Shopify customer_id -> Lead
// mapping (Lead.shopifyCustomerId, set by the customers/create webhook) plus
// email matching is what lets us locate a customer's data here.

function customerMatchClause(customerId?: string | null, email?: string | null) {
  const or: Record<string, unknown>[] = [];
  if (customerId) or.push({ shopifyCustomerId: String(customerId) });
  if (email) or.push({ email: { equals: String(email), mode: "insensitive" } });
  return or;
}

// customers/redact — erase the named customer's personal data. We anonymize
// (null out PII) rather than delete the row so per-variant conversion counts
// stay intact; no identifiable data remains.
export async function redactCustomer(
  shopDomain: string,
  customerId?: string | null,
  email?: string | null,
) {
  const account = await getAccountForShop(shopDomain);
  if (!account) return { redacted: 0 };

  const or = customerMatchClause(customerId, email);
  if (or.length === 0) return { redacted: 0 };

  const res = await prisma.lead.updateMany({
    where: { OR: or, variant: { campaign: { accountId: account.id } } },
    data: { name: null, email: null, phone: null, shopifyCustomerId: null },
  });
  return { redacted: res.count };
}

// customers/data_request — collect the data we hold about the customer so the
// merchant can be provided it. Delivery to the merchant (e.g. email to the
// shop owner) is a productionization; here we locate and return it.
export async function collectCustomerData(
  shopDomain: string,
  customerId?: string | null,
  email?: string | null,
) {
  const account = await getAccountForShop(shopDomain);
  if (!account) return { leads: [] as unknown[] };

  const or = customerMatchClause(customerId, email);
  if (or.length === 0) return { leads: [] as unknown[] };

  const leads = await prisma.lead.findMany({
    where: { OR: or, variant: { campaign: { accountId: account.id } } },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      consentGiven: true,
      consentAt: true,
      rewardClaimedCode: true,
      createdAt: true,
      shopifyCustomerId: true,
    },
  });
  return { leads };
}

// shop/redact — fired 48h after uninstall: erase all of the shop's data. A pure
// Shopify tenant (no Clerk users) is deleted outright, cascading to its
// websites/campaigns/leads. If the account also has web (Clerk) users, we don't
// nuke it — we strip Shopify data + lead PII and remove the shop link instead.
export async function redactShop(shopDomain: string) {
  const shop = await prisma.shopifyShop.findUnique({
    where: { shopDomain },
    include: { account: { include: { users: { select: { id: true } } } } },
  });
  if (!shop) return { deleted: false };

  if (shop.account.users.length === 0) {
    await prisma.account.delete({ where: { id: shop.account.id } });
    return { deleted: true };
  }

  await prisma.lead.updateMany({
    where: { variant: { campaign: { accountId: shop.account.id } } },
    data: { name: null, email: null, phone: null, shopifyCustomerId: null },
  });
  await prisma.shopifyShop.delete({ where: { id: shop.id } });
  return { deleted: false, stripped: true };
}
