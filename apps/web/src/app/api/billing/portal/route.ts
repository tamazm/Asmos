import { NextRequest, NextResponse } from "next/server";
import { getOrCreateAccount } from "@/lib/account";
import { getStripe, isStripeConfigured } from "@/lib/stripe/client";

export async function POST(req: NextRequest) {
  try {
    if (!isStripeConfigured) {
      return NextResponse.json(
        { error: "Billing is temporarily unavailable. Please contact support." },
        { status: 503 },
      );
    }

    const account = await getOrCreateAccount();

    if (!account.stripeCustomerId) {
      return NextResponse.json(
        { error: "No active Stripe customer found for this account" },
        { status: 400 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_HOST || new URL(req.url).origin;
    const stripe = getStripe();

    const session = await stripe.billingPortal.sessions.create({
      customer: account.stripeCustomerId,
      return_url: `${baseUrl}/settings?billing=portal`,
    });

    if (!session.url) {
      throw new Error("Failed to create Stripe billing portal session");
    }

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("[Stripe Portal Error]", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
