import { NextRequest, NextResponse } from "next/server";
import { getStripe, isStripeConfigured } from "@/lib/stripe/client";
import { prisma } from "@/lib/prisma";
import { getTierByStripePriceId } from "@/lib/stripe/pricing";
import { SubscriptionStatus, PlanTier } from "@prisma/client";
import { canStartStripeCheckout } from "@/lib/billing/source";
import Stripe from "stripe";

// Helper to map Stripe subscription status to our internal enum
function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "trialing":
      return "TRIALING";
    case "active":
      return "ACTIVE";
    case "past_due":
    case "unpaid":
      return "PAST_DUE";
    case "canceled":
    case "incomplete_expired":
      return "CANCELED";
    default:
      // Fallback for incomplete/paused/etc. Treat as past_due so it restricts usage if needed.
      return "PAST_DUE";
  }
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No stripe-signature header" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook secret missing" }, { status: 500 });
  }
  if (!isStripeConfigured) {
    console.error("STRIPE_SECRET_KEY is not set");
    return NextResponse.json({ error: "Stripe configuration missing" }, { status: 503 });
  }

  let event: Stripe.Event;

  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        
        // Link customer to our account based on the metadata passed during checkout creation
        const accountId = session.subscription_details?.metadata?.accountId || session.metadata?.accountId;
        const customerId = session.customer as string;

        if (accountId && customerId) {
          await prisma.account.update({
            where: { id: accountId },
            data: { stripeCustomerId: customerId },
          });
        }
        break;
      }
      
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        
        // Get the active price ID
        const priceId = subscription.items.data[0]?.price.id;
        
        let mappedTier: PlanTier | null = null;
        if (priceId) {
          mappedTier = getTierByStripePriceId(priceId);
        }
        
        const mappedStatus = mapStripeStatus(subscription.status);

        // Update the account based on stripeCustomerId
        // An active/trialing/past_due Stripe sub makes Stripe the owning rail;
        // a terminal status relinquishes ownership so the merchant could later
        // be billed via Shopify without a stale STRIPE flag blocking them.
        const stripeOwns =
          mappedStatus === "ACTIVE" || mappedStatus === "TRIALING" || mappedStatus === "PAST_DUE";

        // Symmetric with the Shopify side (applyShopifySubscription): never let a
        // stray/reactivated Stripe event clobber an account that Shopify actively
        // owns — that would bill the merchant on both rails. stripeCustomerId is
        // unique, so this resolves at most one account.
        const owner = await prisma.account.findUnique({
          where: { stripeCustomerId: customerId },
          select: { billingSource: true, planTier: true, subscriptionStatus: true },
        });
        if (owner && !canStartStripeCheckout(owner)) {
          console.warn(
            `[stripe/webhook] ignoring Stripe sub ${event.type} for customer ${customerId}: account is actively billed by Shopify`,
          );
          break;
        }
        await prisma.account.updateMany({
          where: { stripeCustomerId: customerId },
          data: {
            subscriptionStatus: mappedStatus,
            ...(mappedTier && { planTier: mappedTier }), // Only update tier if we successfully mapped it
            billingSource: stripeOwns ? "STRIPE" : "NONE",
          },
        });
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Revert to FREE on cancellation
        await prisma.account.updateMany({
          where: { stripeCustomerId: customerId },
          data: {
            subscriptionStatus: "CANCELED",
            planTier: "FREE",
            billingSource: "NONE",
          },
        });
        break;
      }

      default:
        // Unhandled event type
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(`Error processing webhook ${event.type}:`, error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
