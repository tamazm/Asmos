import { adminGraphql } from "./admin-client";

// Write popup-captured leads back into the merchant's Shopify admin as
// Customers. This is the App Store "Forms" category's core API requirement
// (demonstrated customerCreate + customerUpdate usage) and satisfies the
// "send collected data back to the merchant" policy far more strongly than an
// in-app leads table alone: a lead that opts in through an Asmos popup becomes
// a real, marketing-subscribed customer the merchant already knows how to use.
//
// Best-effort by contract: every caller runs this inside `after()` / a
// try-catch so a Shopify hiccup never breaks the widget's lead acknowledgement.

interface LeadCustomer {
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  acceptsMarketing?: boolean;
}

// Reduce a customer GID ("gid://shopify/Customer/123") to its numeric legacy id
// ("123"). We store THAT on Lead.shopifyCustomerId so it matches what the
// customers/create webhook writes and what customers/redact looks up by (both
// use the numeric id from the webhook payload) — a GID here would silently break
// GDPR redaction matching. See lib/shopify/compliance.ts.
function gidToLegacyId(gid: string): string {
  const m = gid.match(/(\d+)\s*$/);
  return m ? m[1] : gid;
}

function splitName(name?: string | null): { firstName?: string; lastName?: string } {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return {};
  const parts = trimmed.split(/\s+/);
  const firstName = parts.shift();
  const lastName = parts.length ? parts.join(" ") : undefined;
  return { firstName, lastName };
}

// A customer already on file with this email — so we UPDATE instead of trying to
// create a duplicate (which Shopify rejects with "email has been taken").
async function findCustomerIdByEmail(shopDomain: string, email: string): Promise<string | null> {
  const data = await adminGraphql<{
    customers?: { edges: { node: { id: string } }[] };
  }>(
    shopDomain,
    `query FindCustomer($q: String!) {
      customers(first: 1, query: $q) { edges { node { id } } }
    }`,
    { q: `email:${email}` },
  );
  return data?.customers?.edges?.[0]?.node?.id ?? null;
}

// Marketing consent block shared by create + update. Only marks the customer
// SUBSCRIBED when the shopper actually opted in on the popup — otherwise we
// leave consent untouched and just record contact details.
function marketingConsent(acceptsMarketing?: boolean) {
  if (!acceptsMarketing) return undefined;
  return {
    marketingState: "SUBSCRIBED",
    marketingOptInLevel: "SINGLE_OPT_IN",
    consentUpdatedAt: new Date().toISOString(),
  };
}

/**
 * Create the customer, or update the existing one if the email is already taken.
 * Exercises BOTH customerCreate and customerUpdate across the lead population
 * (new shoppers create, returning shoppers update). Returns the customer id, or
 * null if nothing could be written (e.g. no email/phone, or the shop token is
 * gone). Never throws for expected Shopify userErrors.
 */
export async function upsertShopifyCustomer(
  shopDomain: string,
  lead: LeadCustomer,
): Promise<string | null> {
  const email = lead.email?.trim() || undefined;
  const phone = lead.phone?.trim() || undefined;
  // A customer needs at least an email or phone to be meaningful.
  if (!email && !phone) return null;

  const { firstName, lastName } = splitName(lead.name);
  const consent = marketingConsent(lead.acceptsMarketing);

  const baseInput: Record<string, unknown> = {
    ...(firstName && { firstName }),
    ...(lastName && { lastName }),
    tags: ["asmos-popup"],
  };

  // 1) Try to create.
  const createInput: Record<string, unknown> = {
    ...baseInput,
    ...(email && { email }),
    ...(phone && { phone }),
    ...(consent && { emailMarketingConsent: consent }),
  };

  const created = await adminGraphql<{
    customerCreate?: { customer?: { id: string }; userErrors: { field: string[]; message: string }[] };
  }>(
    shopDomain,
    `mutation AsmosCustomerCreate($input: CustomerInput!) {
      customerCreate(input: $input) {
        customer { id }
        userErrors { field message }
      }
    }`,
    { input: createInput },
  );

  const createdId = created?.customerCreate?.customer?.id;
  if (createdId) return gidToLegacyId(createdId);

  const errs = created?.customerCreate?.userErrors ?? [];
  const emailTaken = errs.some(
    (e) => /taken|already/i.test(e.message) || e.field?.includes("email") || e.field?.includes("phone"),
  );
  // A create failure that isn't "already exists" is a real error worth logging,
  // but not worth throwing (this runs best-effort in after()).
  if (!emailTaken) {
    if (errs.length) console.error("[shopify/customers] customerCreate userErrors", shopDomain, errs);
    return null;
  }

  // 2) Already exists → look it up and UPDATE.
  if (!email) return null; // can only reliably resolve an existing record by email here
  const existingId = await findCustomerIdByEmail(shopDomain, email);
  if (!existingId) return null;

  const updated = await adminGraphql<{
    customerUpdate?: { customer?: { id: string }; userErrors: { field: string[]; message: string }[] };
  }>(
    shopDomain,
    `mutation AsmosCustomerUpdate($input: CustomerInput!) {
      customerUpdate(input: $input) {
        customer { id }
        userErrors { field message }
      }
    }`,
    {
      input: {
        id: existingId,
        ...baseInput,
        ...(phone && { phone }),
        ...(consent && { emailMarketingConsent: consent }),
      },
    },
  );

  const updateErrs = updated?.customerUpdate?.userErrors ?? [];
  if (updateErrs.length) console.error("[shopify/customers] customerUpdate userErrors", shopDomain, updateErrs);
  return gidToLegacyId(updated?.customerUpdate?.customer?.id ?? existingId);
}
