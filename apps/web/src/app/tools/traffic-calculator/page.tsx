import type { Metadata } from "next";
import Link from "next/link";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { TrafficCalculatorClient } from "@/components/marketing/TrafficCalculatorClient";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Traffic Calculator — Estimate Your Ecommerce Traffic Opportunity",
  description:
    "Model how growth in your website traffic translates into customers and revenue, and see why conversion rate determines whether that traffic pays off.",
  path: "/tools/traffic-calculator",
});

export default function TrafficCalculatorPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-[color:var(--color-surface)]">
      <MarketingHeader />

      <section className="px-5 pt-14 pb-4 sm:pt-20 text-center">
        <div className="mx-auto max-w-2xl">
          <span className="mb-4 inline-block rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-text-secondary)]">
            Free Ecommerce Calculator
          </span>
          <h1 className="mb-3 text-[2rem] sm:text-[2.5rem] font-bold tracking-[-0.02em] text-[color:var(--color-text-primary)] animate-page-enter" style={{ textWrap: "balance" } as React.CSSProperties}>
            What would more traffic actually be worth?
          </h1>
          <p className="text-sm sm:text-base text-[color:var(--color-text-secondary)] animate-page-enter-delay-1">
            Model a traffic growth scenario against your current conversion rate and AOV to see the customer and revenue impact.
          </p>
        </div>
      </section>

      <section className="px-5 py-10 sm:py-14">
        <TrafficCalculatorClient />
      </section>

      <section className="px-5 py-14 bg-[color:var(--color-surface-sunken)] border-t border-[color:var(--color-border)] text-center">
        <div className="mx-auto max-w-md">
          <h2 className="mb-2 text-lg font-bold text-[color:var(--color-text-primary)]">Also want to model email capture specifically?</h2>
          <p className="mb-4 text-sm text-[color:var(--color-text-secondary)]">Compare your capture rate against an industry benchmark and estimate the revenue opportunity.</p>
          <Link href="/tools/email-capture-calculator" className="inline-flex items-center rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-5 py-2.5 text-sm font-semibold text-[color:var(--color-text-primary)] transition-[background-color,transform] duration-200 hover:bg-white active:scale-[0.97]">
            Email Capture Revenue Calculator
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
