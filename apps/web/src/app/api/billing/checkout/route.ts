import { NextRequest, NextResponse } from "next/server";
import { getOrCreateAccount } from "@/lib/account";
import { getStripe, isStripeConfigured } from "@/lib/stripe/client";
import { getStripePriceId, BillingInterval } from "@/lib/stripe/pricing";
import { PlanTier } from "@prisma/client";
import { canStartStripeCheckout } from "@/lib/billing/source";

export async function POST(req: NextRequest) {
  try {
    if (!isStripeConfigured) {
      return NextResponse.json(
        { error: "Billing is temporarily unavailable. Please contact support to upgrade your plan." },
        { status: 503 },
      );
    }

    const { tier, interval } = (await req.json()) as { 
      tier: string; 
      interval: BillingInterval 
    };

    if (!tier || !["STARTER", "GROWTH", "SCALE"].includes(tier)) {
      return NextResponse.json({ error: "Invalid plan tier" }, { status: 400 });
    }

    if (!interval || !["monthly", "yearly"].includes(interval)) {
      return NextResponse.json({ error: "Invalid billing interval" }, { status: 400 });
    }

    const account = await getOrCreateAccount();

    // One rail per account: refuse card checkout while Shopify actively bills
    // this merchant. They must change their plan from the Shopify admin.
    if (!canStartStripeCheckout(account)) {
      return NextResponse.json(
        {
          error:
            "Your plan is billed through Shopify. Open your Shopify admin to change or cancel it.",
        },
        { status: 409 },
      );
    }

    const priceId = getStripePriceId(tier as Exclude<PlanTier, "FREE">, interval);
    const stripe = getStripe();

    // Get the base URL for the success/cancel redirects
    const baseUrl = process.env.NEXT_PUBLIC_APP_HOST || new URL(req.url).origin;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/settings?billing=success`,
      cancel_url: `${baseUrl}/settings?billing=canceled`,
      // Use existing Stripe customer if we have one, otherwise create a new one
      customer: account.stripeCustomerId ?? undefined,
      client_reference_id: account.id,
      subscription_data: {
        metadata: {
          accountId: account.id,
        },
      },
    });

    if (!session.url) {
      throw new Error("Failed to create Stripe checkout session");
    }

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("[Stripe Checkout Error]", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
