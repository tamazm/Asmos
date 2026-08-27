import { adminGraphql } from "./admin-client";

// Shopify Billing API. App Store apps must bill through Shopify, not Stripe.
// Price points live in PLANS below — set these to your real pricing (or drive
// them from Shopify managed pricing in the Partner Dashboard and use only
// getActiveSubscription()).

export type Plan = {
  key: string;
  name: string;
  amount: number; // in currencyCode units
  currencyCode: string;
  interval: "EVERY_30_DAYS" | "ANNUAL";
  trialDays?: number;
};

// Placeholder pricing — replace amounts with your real tiers.
export const PLANS: Record<string, Plan> = {
  growth: { key: "growth", name: "Asmos Growth", amount: 29, currencyCode: "USD", interval: "EVERY_30_DAYS", trialDays: 14 },
  scale: { key: "scale", name: "Asmos Scale", amount: 99, currencyCode: "USD", interval: "EVERY_30_DAYS", trialDays: 14 },
};

export type ActiveSubscription = {
  id: string;
  name: string;
  status: string;
  test: boolean;
  currentPeriodEnd: string | null;
} | null;

export async function getActiveSubscription(shopDomain: string): Promise<ActiveSubscription> {
  const data = await adminGraphql(
    shopDomain,
    `query {
      currentAppInstallation {
        activeSubscriptions { id name status test currentPeriodEnd }
      }
    }`,
  );
  return data?.currentAppInstallation?.activeSubscriptions?.[0] ?? null;
}

// Creates a recurring subscription and returns the confirmationUrl the merchant
// must visit to approve the charge (open it in the top frame from the embedded
// admin). `test: true` outside production so no real money moves.
export async function createSubscription(
  shopDomain: string,
  plan: Plan,
  returnUrl: string,
  test: boolean,
): Promise<{ confirmationUrl: string | null; id: string | null }> {
  const data = await adminGraphql(
    shopDomain,
    `mutation Create(
      $name: String!, $returnUrl: URL!, $test: Boolean,
      $trialDays: Int, $amount: Decimal!, $currencyCode: CurrencyCode!,
      $interval: AppPricingInterval!
    ) {
      appSubscriptionCreate(
        name: $name
        returnUrl: $returnUrl
        test: $test
        trialDays: $trialDays
        lineItems: [{
          plan: { appRecurringPricingDetails: {
            price: { amount: $amount, currencyCode: $currencyCode }
            interval: $interval
          } }
        }]
      ) {
        confirmationUrl
        appSubscription { id status }
        userErrors { field message }
      }
    }`,
    {
      name: plan.name,
      returnUrl,
      test,
      trialDays: plan.trialDays ?? null,
      amount: plan.amount,
      currencyCode: plan.currencyCode,
      interval: plan.interval,
    },
  );

  const result = data.appSubscriptionCreate;
  if (result?.userErrors?.length) {
    throw new Error(result.userErrors.map((e: any) => e.message).join("; "));
  }
  return {
    confirmationUrl: result?.confirmationUrl ?? null,
    id: result?.appSubscription?.id ?? null,
  };
}
