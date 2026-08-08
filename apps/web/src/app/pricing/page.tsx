import type { Metadata } from "next";
import Link from "next/link";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { PricingClient } from "@/components/marketing/PricingClient";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildMetadata, faqJsonLd } from "@/lib/seo";
import { CTA } from "@/lib/site";

export const metadata: Metadata = buildMetadata({
  title: "Pricing — Flexible Plans Built Around Your Traffic",
  description:
    "Every Asmos plan includes the full platform. Pricing scales with your monthly traffic and level of support, not locked features.",
  path: "/pricing",
});

const COMPARISON_ROWS: { label: string; starter: string; growth: string; scale: string }[] = [
  { label: "Full Asmos Platform", starter: "Included", growth: "Included", scale: "Included" },
  { label: "Monthly Visitors", starter: "Up to 20K", growth: "50K – 500K", scale: "750K – 1M" },
  { label: "A/B Test Capacity", starter: "4", growth: "30 – 50", scale: "100 – 150" },
  { label: "Live Chat Support", starter: "Included", growth: "Included", scale: "Included" },
  { label: "Automatic Onboarding", starter: "Included", growth: "Included", scale: "—" },
  { label: "Managed Success", starter: "+$200/mo", growth: "+$200/mo", scale: "Included" },
  { label: "Dedicated CSM", starter: "With Managed Success", growth: "With Managed Success", scale: "Included" },
];

const FAQS = [
  { question: "Does every plan include all Asmos features?", answer: "Yes. Pricing is based primarily on monthly traffic, testing capacity, and support level." },
  { question: "What counts as a monthly visitor?", answer: "A unique visitor to a page where the Asmos widget is installed, counted once per month per visitor. The exact technical billing methodology will be finalized and kept aligned with product analytics before general availability." },
  { question: "What happens if I exceed my visitor limit?", answer: "We'll notify you before any charges apply and walk you through upgrading to the right plan. Overage handling is being finalized ahead of launch." },
  { question: "What is Managed Success?", answer: "White-glove onboarding, a dedicated Customer Success Manager, and hands-on setup and support." },
  { question: "Can I change plans?", answer: "Yes. Plans scale automatically as your traffic changes." },
  { question: "Do you offer annual billing?", answer: "Yes. Annual plans receive a 20% discount." },
  { question: "Do Scale plans include Managed Success?", answer: "Yes, Managed Success is included automatically on all Scale plans." },
  { question: "What happens above 1M visitors?", answer: "Custom pricing applies — book a demo and we'll build a plan around your traffic and support needs." },
];

export default function PricingPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-[color:var(--color-surface)]">
      <JsonLd data={faqJsonLd(FAQS)} />
      <MarketingHeader />

      {/* Hero */}
      <section className="px-5 pt-14 pb-8 sm:pt-20 sm:pb-10 text-center">
        <div className="mx-auto max-w-2xl">
          <h1 className="mb-3 text-[2rem] sm:text-[2.5rem] font-bold tracking-[-0.02em] text-[color:var(--color-text-primary)] animate-page-enter" style={{ textWrap: "balance" } as React.CSSProperties}>
            Flexible pricing built around your traffic
          </h1>
          <p className="mb-2 text-sm sm:text-base text-[color:var(--color-text-secondary)] animate-page-enter-delay-1">
            Scale your plan as your business grows. Pay for the capacity you actually need.
          </p>
          <p className="text-xs text-[color:var(--color-text-secondary)] animate-page-enter-delay-2">
            Every plan includes the full Asmos platform. Pricing changes based on traffic volume and level of support, not locked features.
          </p>
        </div>
      </section>

      {/* Interactive slider + cards */}
      <section className="px-5 pb-16 sm:pb-24">
        <PricingClient />
      </section>

      {/* Feature philosophy */}
      <section className="px-5 py-14 bg-[color:var(--color-surface-sunken)] border-y border-[color:var(--color-border)]">
        <div className="mx-auto max-w-xl text-center reveal">
          <h2 className="mb-2 text-xl font-bold tracking-tight text-[color:var(--color-text-primary)]">No feature gates.</h2>
          <p className="text-sm text-[color:var(--color-text-secondary)] leading-relaxed">
            Starter, Growth, and Scale all include the full Asmos platform. Your price changes with the traffic you optimize and the support you need — not which product capabilities you unlock.
          </p>
        </div>
      </section>

      {/* Managed Success */}
      <section className="px-5 py-16 sm:py-24">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-8 text-2xl font-bold tracking-tight text-[color:var(--color-text-primary)] text-center reveal" style={{ textWrap: "balance" } as React.CSSProperties}>
            Need more hands-on support?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 reveal-stagger">
            {[
              { title: "White-Glove Onboarding", body: "Our team helps configure and launch Asmos with you." },
              { title: "Dedicated Customer Success Manager", body: "A dedicated Asmos contact who understands your account and optimization goals." },
              { title: "Hands-On Setup & Support", body: "Help configuring experiments, integrations, and optimization workflows." },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
                <h3 className="mb-1.5 text-sm font-semibold text-[color:var(--color-text-primary)]">{item.title}</h3>
                <p className="text-xs text-[color:var(--color-text-secondary)] leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-[color:var(--color-text-secondary)]">
            Managed Success is optional on Starter and Growth and included with Scale.
          </p>
        </div>
      </section>

      {/* Compact comparison table */}
      <section className="px-5 py-16 sm:py-24 bg-[color:var(--color-surface-sunken)] border-y border-[color:var(--color-border)]">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-8 text-2xl font-bold tracking-tight text-[color:var(--color-text-primary)] text-center reveal" style={{ textWrap: "balance" } as React.CSSProperties}>
            What actually changes
          </h2>
          <div className="overflow-x-auto reveal-eager">
            <table className="w-full min-w-[520px] border-collapse rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
              <thead>
                <tr className="border-b border-[color:var(--color-border)] text-xs font-semibold uppercase tracking-wide text-[color:var(--color-text-secondary)]">
                  <th className="px-4 py-3 text-left"></th>
                  <th className="px-4 py-3 text-left">Starter</th>
                  <th className="px-4 py-3 text-left">Growth</th>
                  <th className="px-4 py-3 text-left">Scale</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row.label} className="border-b border-[color:var(--color-border)] last:border-b-0 text-sm">
                    <td className="px-4 py-3 font-medium text-[color:var(--color-text-primary)]">{row.label}</td>
                    <td className="px-4 py-3 text-[color:var(--color-text-secondary)]">{row.starter}</td>
                    <td className="px-4 py-3 text-[color:var(--color-text-secondary)]">{row.growth}</td>
                    <td className="px-4 py-3 text-[color:var(--color-text-secondary)]">{row.scale}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Enterprise */}
      <section className="px-5 py-16 sm:py-24">
        <div className="mx-auto max-w-xl text-center reveal">
          <h2 className="mb-3 text-2xl font-bold tracking-tight text-[color:var(--color-text-primary)]" style={{ textWrap: "balance" } as React.CSSProperties}>
            More than 1M monthly visitors?
          </h2>
          <p className="mb-7 text-sm text-[color:var(--color-text-secondary)]">
            We&apos;ll build a plan around your traffic, testing volume, integrations, and support requirements.
          </p>
          <Link href={CTA.secondary.href} className="inline-flex items-center gap-2 rounded-lg bg-[color:var(--color-primary)] px-6 py-3 text-sm font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-[color:var(--color-primary-dark)] active:scale-[0.97]">
            {CTA.secondary.label}
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-5 py-16 sm:py-24 bg-[color:var(--color-surface-sunken)] border-y border-[color:var(--color-border)]">
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-8 text-2xl font-bold tracking-tight text-[color:var(--color-text-primary)] text-center reveal" style={{ textWrap: "balance" } as React.CSSProperties}>
            Frequently asked questions
          </h2>
          <div className="space-y-4 reveal-stagger">
            {FAQS.map((faq) => (
              <details key={faq.question} className="group rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-5 py-4">
                <summary className="cursor-pointer list-none text-sm font-semibold text-[color:var(--color-text-primary)] flex items-center justify-between">
                  {faq.question}
                  <span className="ml-4 text-[color:var(--color-text-secondary)] group-open:rotate-45 transition-transform duration-200 text-lg leading-none">+</span>
                </summary>
                <p className="mt-2.5 text-sm text-[color:var(--color-text-secondary)] leading-relaxed">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-5 py-16 sm:py-24 text-center">
        <div className="mx-auto max-w-xl">
          <h2 className="mb-3 text-2xl font-bold tracking-tight text-[color:var(--color-text-primary)]" style={{ textWrap: "balance" } as React.CSSProperties}>
            Start optimizing with Asmos.
          </h2>
          <p className="mb-7 text-sm text-[color:var(--color-text-secondary)]">Get the full Asmos platform with pricing that scales around your traffic.</p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href={CTA.primary.href} className="rounded-lg bg-[color:var(--color-primary)] px-6 py-3 text-sm font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-[color:var(--color-primary-dark)] active:scale-[0.97]">
              {CTA.primary.label}
            </Link>
            <Link href={CTA.secondary.href} className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-6 py-3 text-sm font-semibold text-[color:var(--color-text-primary)] transition-[background-color,transform] duration-200 hover:bg-[color:var(--color-surface-sunken)] active:scale-[0.97]">
              {CTA.secondary.label}
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
