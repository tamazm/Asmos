import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

export const isStripeConfigured = Boolean(stripeSecretKey);

let stripe: Stripe | undefined;

/**
 * Stripe is optional for local development and preview builds. Keep it out of
 * module initialization so Next can collect API route data without a secret.
 */
export function getStripe(): Stripe {
  if (!stripeSecretKey) {
    throw new Error("Billing is not configured. Please contact support to enable billing.");
  }

  stripe ??= new Stripe(stripeSecretKey, {
    // Use a stable recent version for the types
    apiVersion: "2024-06-20",
    appInfo: {
      name: "Asmos",
      version: "0.1.0",
    },
  });

  return stripe;
}
