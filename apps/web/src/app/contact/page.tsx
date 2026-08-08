import type { Metadata } from "next";
import Link from "next/link";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { ContactForm } from "@/components/marketing/ContactForm";
import { buildMetadata } from "@/lib/seo";
import { CTA, FOUNDER_EMAIL } from "@/lib/site";

export const metadata: Metadata = buildMetadata({
  title: "Contact Asmos",
  description: "Book a demo, send a general inquiry, or reach the Asmos team directly.",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-[color:var(--color-surface)]">
      <MarketingHeader />

      {/* Hero */}
      <section className="px-5 pt-14 pb-10 sm:pt-20 sm:pb-14 text-center">
        <div className="mx-auto max-w-xl">
          <h1 className="mb-3 text-[2rem] sm:text-[2.5rem] font-bold tracking-[-0.02em] text-[color:var(--color-text-primary)] animate-page-enter" style={{ textWrap: "balance" } as React.CSSProperties}>
            Let&apos;s talk about how Asmos can help.
          </h1>
          <p className="text-sm sm:text-base text-[color:var(--color-text-secondary)] animate-page-enter-delay-1">
            Book a demo, send us a message, or reach out directly for business and partnership inquiries.
          </p>
        </div>
      </section>

      <section className="px-5 pb-16 sm:pb-24">
        <div className="mx-auto max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Left: Book a demo + direct email */}
          <div className="space-y-6">
            <div id="book-a-demo" className="rounded-2xl border border-[color:var(--color-primary)]/25 bg-[color:var(--color-primary-light)] p-1.5 shadow-sm scroll-mt-24">
              <div className="rounded-[1rem] bg-[color:var(--color-surface)] p-7" style={{ boxShadow: "inset 0 1px 1px rgba(255,255,255,0.95)" }}>
                <h2 className="mb-2 text-lg font-bold tracking-tight text-[color:var(--color-text-primary)]">Book a Demo with the CEO</h2>
                <p className="mb-5 text-sm text-[color:var(--color-text-secondary)] leading-relaxed">
                  See how Asmos works, discuss your current conversion setup, and find out whether Asmos is a good fit for your store.
                </p>
                <a
                  href={`mailto:${FOUNDER_EMAIL}?subject=${encodeURIComponent("Book a demo")}`}
                  className="inline-flex items-center gap-2 rounded-lg bg-[color:var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-[color:var(--color-primary-dark)] active:scale-[0.97]"
                >
                  {CTA.secondary.label}
                </a>
                <p className="mt-2.5 text-[11px] text-[color:var(--color-text-secondary)]">
                  Scheduling widget coming soon — this button emails us directly to grab a time.
                </p>
                <div className="mt-5 border-t border-[color:var(--color-border)] pt-4">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-text-secondary)]">Best for</p>
                  <ul className="grid grid-cols-2 gap-1.5 text-xs text-[color:var(--color-text-secondary)]">
                    {["Product demos", "Managed Success", "Scale / Enterprise plans", "Ecommerce optimization", "Partnerships", "Design partner opportunities"].map((item) => (
                      <li key={item} className="flex items-start gap-1.5">
                        <span className="text-[color:var(--color-primary)]">•</span>{item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
              <h2 className="mb-1.5 text-base font-semibold text-[color:var(--color-text-primary)]">Prefer email?</h2>
              <a href={`mailto:${FOUNDER_EMAIL}`} className="text-sm font-medium text-[color:var(--color-primary)] underline underline-offset-2">
                {FOUNDER_EMAIL}
              </a>
              <p className="mt-2 text-xs text-[color:var(--color-text-secondary)] leading-relaxed">
                For partnerships, media, business inquiries, and anything that doesn&apos;t fit into the form.
              </p>
              <p className="mt-4 text-xs text-[color:var(--color-text-secondary)]">We usually respond within 1 business day.</p>
            </div>

            <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-6">
              <h2 className="mb-1.5 text-sm font-semibold text-[color:var(--color-text-primary)]">Running a high-traffic ecommerce store?</h2>
              <p className="mb-3 text-xs text-[color:var(--color-text-secondary)] leading-relaxed">
                If you have more than 1M monthly visitors or custom requirements, book a demo and we&apos;ll build a plan around your traffic and support needs.
              </p>
              <Link href="#book-a-demo" className="text-xs font-semibold text-[color:var(--color-primary)]">{CTA.secondary.label} →</Link>
            </div>
          </div>

          {/* Right: contact form */}
          <div>
            <h2 className="mb-4 text-lg font-bold tracking-tight text-[color:var(--color-text-primary)]">Send us a message</h2>
            <ContactForm />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-5 py-16 sm:py-24 bg-[color:var(--color-surface-sunken)] border-t border-[color:var(--color-border)] text-center">
        <div className="mx-auto max-w-xl">
          <h2 className="mb-6 text-2xl font-bold tracking-tight text-[color:var(--color-text-primary)]" style={{ textWrap: "balance" } as React.CSSProperties}>
            Ready to see Asmos in action?
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="#book-a-demo" className="rounded-lg bg-[color:var(--color-primary)] px-6 py-3 text-sm font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-[color:var(--color-primary-dark)] active:scale-[0.97]">
              {CTA.secondary.label}
            </Link>
            <Link href={CTA.primary.href} className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-6 py-3 text-sm font-semibold text-[color:var(--color-text-primary)] transition-[background-color,transform] duration-200 hover:bg-white active:scale-[0.97]">
              {CTA.primary.label}
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
