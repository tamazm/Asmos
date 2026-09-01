"use client";

import { useState } from "react";
import { BillingInterval } from "@/lib/stripe/pricing";

interface BillingControlsProps {
  planTier: string;
  subscriptionStatus: string;
  hasStripeCustomer: boolean;
  isShopify: boolean;
}

export function BillingControls({ planTier, subscriptionStatus, hasStripeCustomer, isShopify }: BillingControlsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [interval, setInterval] = useState<BillingInterval>("monthly");

  const isBillingActive = subscriptionStatus === "ACTIVE" || subscriptionStatus === "TRIALING" || subscriptionStatus === "PAST_DUE";

  const handleCheckout = async (targetTier: string) => {
    try {
      setLoading(targetTier);
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: targetTier, interval }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start checkout");
      
      window.location.href = data.url;
    } catch (err: any) {
      alert(err.message);
      setLoading(null);
    }
  };

  const handlePortal = async () => {
    try {
      setLoading("portal");
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Failed to open portal");
      
      window.location.href = data.url;
    } catch (err: any) {
      alert(err.message);
      setLoading(null);
    }
  };

  if (isShopify) {
    return (
      <div className="text-sm text-[color:var(--color-text-secondary)] bg-[color:var(--color-surface-sunken)] p-4 rounded-lg border border-[color:var(--color-border)]">
        Your billing is managed securely through Shopify. Please return to the Shopify Admin to change your plan.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 rounded-lg bg-[color:var(--color-surface-sunken)] p-1 border border-[color:var(--color-border)]">
          <button
            onClick={() => setInterval("monthly")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${interval === "monthly" ? "bg-white text-[color:var(--color-text-primary)] shadow-sm" : "text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]"}`}
          >
            Monthly
          </button>
          <button
            onClick={() => setInterval("yearly")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${interval === "yearly" ? "bg-white text-[color:var(--color-text-primary)] shadow-sm" : "text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]"}`}
          >
            Yearly
          </button>
        </div>
        
        {hasStripeCustomer && isBillingActive && (
          <button
            onClick={handlePortal}
            disabled={loading !== null}
            className="rounded-lg bg-white border border-[color:var(--color-border)] px-4 py-2 text-sm font-semibold text-[color:var(--color-text-primary)] shadow-sm hover:bg-gray-50 focus:outline-none disabled:opacity-50"
          >
            {loading === "portal" ? "Redirecting..." : "Manage Billing"}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { id: "STARTER", name: "Starter", price: interval === "yearly" ? "$290/yr" : "$29/mo" },
          { id: "GROWTH", name: "Growth", price: interval === "yearly" ? "$790/yr" : "$79/mo" },
          { id: "SCALE", name: "Scale", price: interval === "yearly" ? "$1990/yr" : "$199/mo" },
        ].map((tier) => {
          const isCurrentPlan = planTier === tier.id;
          return (
            <div key={tier.id} className={`rounded-xl border p-5 flex flex-col justify-between h-full ${isCurrentPlan ? 'border-[color:var(--color-primary)] ring-1 ring-[color:var(--color-primary)]/20 bg-[color:var(--color-primary-light)]/10' : 'border-[color:var(--color-border)] bg-[color:var(--color-surface)]'}`}>
              <div>
                <h3 className="text-sm font-semibold text-[color:var(--color-text-primary)]">{tier.name}</h3>
                <div className="mt-2 flex items-baseline gap-1 text-2xl font-bold tracking-tight text-[color:var(--color-text-primary)]">
                  {tier.price.split('/')[0]}
                  <span className="text-sm font-semibold text-[color:var(--color-text-secondary)] tracking-normal">/{tier.price.split('/')[1]}</span>
                </div>
              </div>
              <button
                onClick={() => handleCheckout(tier.id)}
                disabled={isCurrentPlan || loading !== null}
                className={`mt-6 w-full rounded-lg px-3 py-2 text-sm font-semibold shadow-sm transition-colors ${
                  isCurrentPlan
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-[color:var(--color-primary)] text-white hover:bg-[color:var(--color-primary-hover)] disabled:opacity-50"
                }`}
              >
                {loading === tier.id ? "Loading..." : isCurrentPlan ? "Current Plan" : "Upgrade"}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  );
}
