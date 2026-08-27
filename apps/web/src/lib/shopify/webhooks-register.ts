import { adminGraphql } from "./admin-client";

// Runtime registration for the data-tracking webhooks whose scopes are
// OPTIONAL (orders/paid needs read_orders, customers/create needs
// read_customers). Shopify's config validator refuses to let these be declared
// statically in shopify.app.toml because their scopes aren't required, so we
// reconcile them here against the scopes the merchant has actually granted via
// the in-app "what you'll allow" toggles (App Bridge Scopes API).
//
// reconcileDataWebhooks is idempotent and self-healing: call it on every
// embedded session load. It queries the shop's granted scopes + existing
// subscriptions, then creates the webhook when its scope is present and deletes
// it when the scope has been revoked. All errors are the caller's to swallow —
// a failed reconcile must never block the merchant from loading the app.

const APP_URL = process.env.SHOPIFY_APP_URL || "https://app.asmos.io";
const CALLBACK_URL = `${APP_URL}/api/shopify/webhooks`;

// topic (GraphQL enum) -> the optional scope that gates it.
const SCOPE_GATED_TOPICS: { topic: string; scope: string }[] = [
  { topic: "ORDERS_PAID", scope: "read_orders" },
  { topic: "CUSTOMERS_CREATE", scope: "read_customers" },
];

type ExistingSub = { id: string; topic: string; callbackUrl: string | null };

async function getGrantedScopes(shopDomain: string): Promise<Set<string>> {
  const data = await adminGraphql<{
    currentAppInstallation?: { accessScopes?: { handle: string }[] };
  }>(shopDomain, `query { currentAppInstallation { accessScopes { handle } } }`);
  return new Set((data?.currentAppInstallation?.accessScopes ?? []).map((s) => s.handle));
}

async function getExistingSubs(shopDomain: string): Promise<ExistingSub[]> {
  const data = await adminGraphql<{
    webhookSubscriptions?: {
      edges: { node: { id: string; topic: string; endpoint: { callbackUrl?: string } | null } }[];
    };
  }>(
    shopDomain,
    `query {
      webhookSubscriptions(first: 100) {
        edges { node {
          id
          topic
          endpoint { ... on WebhookHttpEndpoint { callbackUrl } }
        } }
      }
    }`,
  );
  return (data?.webhookSubscriptions?.edges ?? []).map((e) => ({
    id: e.node.id,
    topic: e.node.topic,
    callbackUrl: e.node.endpoint?.callbackUrl ?? null,
  }));
}

async function createSub(shopDomain: string, topic: string): Promise<void> {
  const data = await adminGraphql<{
    webhookSubscriptionCreate?: { userErrors: { message: string }[] };
  }>(
    shopDomain,
    `mutation Create($topic: WebhookSubscriptionTopic!, $sub: WebhookSubscriptionInput!) {
      webhookSubscriptionCreate(topic: $topic, webhookSubscription: $sub) {
        userErrors { field message }
        webhookSubscription { id }
      }
    }`,
    { topic, sub: { callbackUrl: CALLBACK_URL, format: "JSON" } },
  );
  const errs = data?.webhookSubscriptionCreate?.userErrors ?? [];
  if (errs.length) throw new Error(`webhookSubscriptionCreate(${topic}): ${errs.map((e) => e.message).join("; ")}`);
}

async function deleteSub(shopDomain: string, id: string): Promise<void> {
  await adminGraphql(
    shopDomain,
    `mutation Delete($id: ID!) {
      webhookSubscriptionDelete(id: $id) { userErrors { message } }
    }`,
    { id },
  );
}

// Reconcile the scope-gated webhooks for one shop. Idempotent.
export async function reconcileDataWebhooks(shopDomain: string): Promise<void> {
  const [granted, existing] = await Promise.all([
    getGrantedScopes(shopDomain),
    getExistingSubs(shopDomain),
  ]);

  for (const { topic, scope } of SCOPE_GATED_TOPICS) {
    const mine = existing.filter((s) => s.topic === topic && s.callbackUrl === CALLBACK_URL);
    const wanted = granted.has(scope);

    if (wanted && mine.length === 0) {
      await createSub(shopDomain, topic);
    } else if (!wanted && mine.length > 0) {
      for (const s of mine) await deleteSub(shopDomain, s.id);
    }
    // wanted && exists, or !wanted && absent -> nothing to do.
  }
}
