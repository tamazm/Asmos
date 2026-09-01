import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn("STRIPE_SECRET_KEY is not set in the environment.");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  // Use a stable recent version for the types
  apiVersion: "2024-06-20", 
  appInfo: {
    name: "Asmos",
    version: "0.1.0",
  },
});
