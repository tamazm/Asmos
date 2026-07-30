import Link from "next/link";
import Image from "next/image";

const plans = [
  {
    name: "Starter",
    price: null,
    priceLabel: "Free",
    priceNote: "No credit card required",
    cta: "Get started free",
    ctaHref: "/sign-up",
    ctaVariant: "secondary" as const,
    highlight: false,
    features: [
      "1,000 impressions per month",
      "1 active campaign",
      "Brand analysis",
      "AI popup generation",
    ],
  },
  {
    name: "Growth",
    price: 29,
    priceLabel: "$29",
    priceNote: "per month, cancel anytime",
    cta: "Start free trial",
    ctaHref: "/sign-up",
    ctaVariant: "primary" as const,
    highlight: true,
    features: [
      "50,000 impressions per month",
      "Unlimited campaigns",
      "AI optimization",
      "A/B testing",
      "Analytics dashboard",
      "Klaviyo and Mailchimp integrations",
      "Priority support",
    ],
  },
  {
    name: "Scale",
    price: 99,
    priceLabel: "$99",
    priceNote: "per month, cancel anytime",
    cta: "Contact sales",
    ctaHref: "/sign-up",
    ctaVariant: "secondary" as const,
    highlight: false,
    features: [
      "Unlimited impressions",
      "Unlimited campaigns",
      "All Growth features",
      "Dedicated onboarding",
      "Custom integrations",
      "SLA guarantee",
    ],
  },
];

const faqs = [
  {
    q: "What counts as an impression?",
    a: "An impression is recorded each time your popup is shown to a visitor. If the same visitor sees the popup twice across two separate sessions, that counts as two impressions.",
  },
  {
    q: "Can I cancel at any time?",
    a: "Yes. You can cancel your subscription at any time from your account settings. Your plan remains active until the end of the current billing period.",
  },
  {
    q: "What happens if I exceed my monthly impression limit?",
    a: "On the Starter plan, popups stop serving once you hit 1,000 impressions. Upgrade to Growth or Scale to remove limits and keep your campaigns running without interruption.",
  },
  {
    q: "Is there a free trial for paid plans?",
    a: "Yes. Growth and Scale plans start with a 14-day free trial, no credit card required. You only pay if you choose to continue after the trial.",
  },
];

export default function PricingPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-[color:var(--color-surface)]">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-[color:var(--color-border)] px-6 py-4 bg-[color:var(--color-surface)]">
        <Link href="/" aria-label="Asmos home">
          <Image
            src="/assets/asmos-logo-primary-lightbg.webp"
            alt="Asmos"
            width={110}
            height={28}
            priority
            className="h-7 w-auto"
          />
        </Link>
        <nav className="hidden items-center gap-5 text-sm font-medium text-[color:var(--color-text-secondary)] sm:flex">
          <Link
            href="/pricing"
            className="text-[color:var(--color-text-primary)] transition-colors duration-150"
          >
            Pricing
          </Link>
        </nav>
        <div className="flex items-center gap-3 text-sm font-medium">
          <Link
            href="/sign-in"
            className="px-3 py-1.5 text-[color:var(--color-text-secondary)] transition-colors duration-150 hover:text-[color:var(--color-text-primary)]"
          >
            Log in
          </Link>
          <Link
            href="/sign-up"
            className="rounded-lg bg-[color:var(--color-primary)] px-4 py-2 text-white transition-colors duration-150 hover:bg-[color:var(--color-primary-dark)] active:scale-[0.98]"
          >
            Get started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="px-4 py-16 text-center sm:px-6 sm:py-20">
        <div className="mx-auto max-w-2xl">
          <h1
            className="mb-4 text-4xl font-bold tracking-tight text-[color:var(--color-text-primary)] md:text-5xl"
            style={{ textWrap: "balance" } as React.CSSProperties}
          >
            Simple pricing that grows with you
          </h1>
          <p
            className="text-lg text-[color:var(--color-text-secondary)] leading-relaxed"
            style={{ textWrap: "pretty" } as React.CSSProperties}
          >
            Start free and upgrade when you need more impressions, campaigns, or
            advanced AI optimization.
          </p>
        </div>
      </section>

      {/* Plan cards */}
      <section className="px-4 pb-20 sm:px-6">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`flex flex-col rounded-2xl border bg-[color:var(--color-surface)] p-8 shadow-sm ${
                plan.highlight
                  ? "border-[#165DFF]"
                  : "border-[color:var(--color-border)]"
              }`}
            >
              {/* Plan name */}
              <p
                className={`mb-2 text-xs font-medium uppercase tracking-wide ${
                  plan.highlight
                    ? "text-[#165DFF]"
                    : "text-[color:var(--color-text-secondary)]"
                }`}
              >
                {plan.name}
              </p>

              {/* Price */}
              <div className="mb-1 flex items-baseline gap-1">
                <span className="text-3xl font-bold tracking-tight tabular-nums text-[color:var(--color-text-primary)]">
                  {plan.priceLabel}
                </span>
                {plan.price && (
                  <span className="text-sm text-[color:var(--color-text-secondary)]">
                    / mo
                  </span>
                )}
              </div>
              <p className="mb-6 text-xs text-[color:var(--color-text-secondary)]">
                {plan.priceNote}
              </p>

              {/* Features */}
              <ul className="mb-8 flex-1 space-y-2.5">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-center gap-2.5 text-sm text-[color:var(--color-text-secondary)]"
                  >
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        plan.highlight
                          ? "bg-[#165DFF]"
                          : "bg-[color:var(--color-text-secondary)]"
                      }`}
                      aria-hidden="true"
                    />
                    {feature}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Link
                href={plan.ctaHref}
                className={`block w-full rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition-colors duration-150 active:scale-[0.98] ${
                  plan.ctaVariant === "primary"
                    ? "bg-[#165DFF] text-white hover:bg-[color:var(--color-primary-dark)]"
                    : "border border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text-primary)] hover:bg-[color:var(--color-surface-sunken)]"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-2xl">
          <h2
            className="mb-10 text-center text-2xl font-semibold tracking-tight text-[color:var(--color-text-primary)]"
            style={{ textWrap: "balance" } as React.CSSProperties}
          >
            Frequently asked questions
          </h2>
          <div className="flex flex-col gap-8">
            {faqs.map((faq) => (
              <div key={faq.q}>
                <p className="mb-1.5 text-sm font-semibold text-[color:var(--color-text-primary)]">
                  {faq.q}
                </p>
                <p
                  className="text-sm text-[color:var(--color-text-secondary)] leading-relaxed"
                  style={{ textWrap: "pretty" } as React.CSSProperties}
                >
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="border-t border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-16 text-center sm:px-6 sm:py-20">
        <div className="mx-auto max-w-lg">
          <h2
            className="mb-3 text-2xl font-semibold tracking-tight text-[color:var(--color-text-primary)]"
            style={{ textWrap: "balance" } as React.CSSProperties}
          >
            Ready to grow?
          </h2>
          <p className="mb-8 text-sm text-[color:var(--color-text-secondary)] leading-relaxed">
            Start free. No credit card required. Upgrade when your store is ready to scale.
          </p>
          <Link
            href="/sign-up"
            className="inline-flex items-center justify-center rounded-lg bg-[#165DFF] px-6 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[color:var(--color-primary-dark)] active:scale-[0.98]"
          >
            Get started free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-xs text-[color:var(--color-text-secondary)] sm:flex-row">
          <p>&copy; 2026 Asmos</p>
          <nav className="flex items-center gap-5">
            <Link
              href="/pricing"
              className="transition-colors duration-150 hover:text-[color:var(--color-text-primary)]"
            >
              Pricing
            </Link>
            <Link
              href="/privacy"
              className="transition-colors duration-150 hover:text-[color:var(--color-text-primary)]"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="transition-colors duration-150 hover:text-[color:var(--color-text-primary)]"
            >
              Terms
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
