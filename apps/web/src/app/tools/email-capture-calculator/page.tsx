import type { Metadata } from "next";
import Link from "next/link";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { EmailCaptureCalculatorClient } from "@/components/marketing/EmailCaptureCalculatorClient";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildMetadata, faqJsonLd } from "@/lib/seo";
import { CTA } from "@/lib/site";

export const metadata: Metadata = buildMetadata({
  title: "Email Capture Revenue Calculator | Free Ecommerce Tool",
  description:
    "Set a target email capture rate and estimate the additional revenue opportunity from your existing traffic.",
  path: "/tools/email-capture-calculator",
});

const SEO_FAQS = [
  { question: "What is email capture rate?", answer: "Email capture rate is the percentage of website visitors who submit their email address, typically through a popup or signup form, during a session." },
  { question: "What is a good email popup conversion rate?", answer: "There is no single universal number. It depends on your offer, traffic source, device mix, and industry. Comparing your own rate over time and against a relevant benchmark is more useful than chasing a single target." },
  { question: "How is email capture rate calculated?", answer: "Email capture rate = (number of visitors who submit an email) ÷ (total visitors who saw the capture form), expressed as a percentage." },
  { question: "How does email capture affect ecommerce revenue?", answer: "Every additional subscriber is a potential future customer. Small increases in capture rate compound through email flows, SMS campaigns, and repeat-purchase revenue over time." },
  { question: "How can I improve my email capture rate?", answer: "Common levers include the offer, headline clarity, number of form fields, popup timing/trigger, and mobile-specific layout. All of these are worth testing rather than assuming." },
  { question: "Why do popup conversion rates vary by industry?", answer: "Purchase consideration, price point, and traffic intent differ by category, which shifts how visitors respond to a capture offer." },
  { question: "Email capture rate vs ecommerce conversion rate", answer: "Email capture rate measures signups from visitors; ecommerce conversion rate measures purchases from visitors. They're related but distinct; a store can improve one without directly improving the other." },
];

export default function EmailCaptureCalculatorPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-[color:var(--color-surface)]">
      <JsonLd data={faqJsonLd(SEO_FAQS)} />
      <MarketingHeader />

      <section className="px-5 pt-14 pb-4 sm:pt-20 text-center">
        <div className="mx-auto max-w-2xl">
          <span className="mb-4 inline-block rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-text-secondary)]">
            Free Ecommerce Calculator
          </span>
          <h1 className="mb-3 text-[2rem] sm:text-[2.5rem] font-bold tracking-[-0.02em] text-[color:var(--color-text-primary)] animate-page-enter" style={{ textWrap: "balance" } as React.CSSProperties}>
            How much revenue is your email capture leaving on the table?
          </h1>
          <p className="text-sm sm:text-base text-[color:var(--color-text-secondary)] animate-page-enter-delay-1">
            Set a target capture rate and estimate the revenue opportunity from converting more of your existing traffic.
          </p>
        </div>
      </section>

      <section className="px-5 py-10 sm:py-14">
        <EmailCaptureCalculatorClient />
      </section>

      {/* Cross-sell */}
      <section className="px-5 py-14 bg-[color:var(--color-surface-sunken)] border-y border-[color:var(--color-border)] text-center">
        <div className="mx-auto max-w-md">
          <h2 className="mb-2 text-lg font-bold text-[color:var(--color-text-primary)]">Want to know what may be holding your popup back?</h2>
          <p className="mb-4 text-sm text-[color:var(--color-text-secondary)]">Let Asmos analyze your current popup, offer, CTA, form structure, and conversion experience for free.</p>
          <Link href={CTA.tertiary.href} className="inline-flex items-center rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-5 py-2.5 text-sm font-semibold text-[color:var(--color-text-primary)] transition-[background-color,transform] duration-200 hover:bg-white active:scale-[0.97]">
            Analyze My Store Free
          </Link>
        </div>
      </section>

      {/* SEO content */}
      <section className="px-5 py-16 sm:py-24">
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-8 text-xl font-bold text-[color:var(--color-text-primary)] text-center">Common questions</h2>
          <div className="space-y-4">
            {SEO_FAQS.map((faq) => (
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
      <section className="px-5 py-16 sm:py-24 bg-[color:var(--color-surface-sunken)] border-t border-[color:var(--color-border)] text-center">
        <div className="mx-auto max-w-xl">
          <h2 className="mb-3 text-2xl font-bold tracking-tight text-[color:var(--color-text-primary)]" style={{ textWrap: "balance" } as React.CSSProperties}>
            Turn the opportunity into actual experiments.
          </h2>
          <p className="mb-7 text-sm text-[color:var(--color-text-secondary)]">Let Asmos continuously test and improve how your store converts visitors into subscribers.</p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href={CTA.primary.href} className="rounded-full bg-[color:var(--color-primary)] px-6 py-3 text-sm font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-[color:var(--color-primary-dark)] active:scale-[0.97]">
              {CTA.primary.label}
            </Link>
            <Link href={CTA.secondary.href} className="rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-6 py-3 text-sm font-semibold text-[color:var(--color-text-primary)] transition-[background-color,transform] duration-200 hover:bg-white active:scale-[0.97]">
              {CTA.secondary.label}
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
