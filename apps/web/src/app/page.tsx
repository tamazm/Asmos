import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth-adapter";
import { HomepageForm } from "@/components/ui/HomepageForm";
import { PopupPreview } from "@/components/ui/PopupPreview";

// ─── Checkmark icon ─────────────────────────────────────────────────────────
function Check() {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      className="shrink-0 mt-0.5 text-[color:var(--color-primary)]"
    >
      <circle cx="7" cy="7" r="7" fill="currentColor" opacity="0.12" />
      <path
        d="M4 7l2 2 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Arrow icon ──────────────────────────────────────────────────────────────
function ArrowRight({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      className={className}
    >
      <path
        d="M3 7h8m0 0L7.5 3.5M11 7L7.5 10.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default async function LandingPage() {
  const { userId } = await auth();
  const isMock = process.env.MOCK_AUTH === "true";
  if (userId && !isMock) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[color:var(--color-surface)]">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)]/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <Image
            src="/assets/asmos-logo-primary-lightbg.webp"
            alt="Asmos"
            width={110}
            height={28}
            priority
            className="h-7 w-auto"
          />
          <nav className="hidden items-center gap-6 text-sm font-medium text-[color:var(--color-text-secondary)] sm:flex">
            <Link
              href="#how-it-works"
              className="transition-colors duration-200 hover:text-[color:var(--color-text-primary)]"
            >
              How it works
            </Link>
            <Link
              href="/pricing"
              className="transition-colors duration-200 hover:text-[color:var(--color-text-primary)]"
            >
              Pricing
            </Link>
          </nav>
          <div className="flex items-center gap-3 text-sm font-medium">
            <Link
              href="/sign-in"
              className="hidden text-[color:var(--color-text-secondary)] transition-colors duration-200 hover:text-[color:var(--color-text-primary)] sm:block"
            >
              Log in
            </Link>
            <Link
              href="/sign-up"
              className="rounded-lg bg-[color:var(--color-primary)] px-4 py-2 text-white transition-[background-color,transform] duration-200 hover:bg-[color:var(--color-primary-dark)] active:scale-[0.97]"
            >
              Get started free
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="relative px-5 pt-12 pb-16 sm:pt-20 sm:pb-28 overflow-hidden">
        {/* Ambient glow — top center */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(22,93,255,0.08) 0%, transparent 65%)",
          }}
        />

        <div className="relative mx-auto max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* Left: copy + form */}
            <div>
              {/* Eyebrow */}
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3.5 py-1.5 text-xs font-medium text-[color:var(--color-text-secondary)] shadow-sm animate-page-enter">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-success)] shrink-0"
                  aria-hidden="true"
                  style={{ boxShadow: "0 0 0 3px #dcfce7" }}
                />
                AI popup optimization for Shopify and WooCommerce
              </div>

              <h1
                className="mb-4 text-[2.1rem] leading-[1.08] font-bold tracking-[-0.03em] text-[color:var(--color-text-primary)] sm:text-[2.6rem] lg:text-5xl animate-page-enter-delay-1"
                style={{ textWrap: "balance" } as React.CSSProperties}
              >
                Your next 500 email subscribers are already on your site
              </h1>

              <p
                className="mb-7 text-base sm:text-lg text-[color:var(--color-text-secondary)] leading-relaxed max-w-[480px] animate-page-enter-delay-2"
                style={{ textWrap: "pretty" } as React.CSSProperties}
              >
                Paste your store URL. Asmos reads your brand, builds a popup
                that matches it, then runs continuous experiments to find the
                version that converts the most visitors into subscribers.
              </p>

              {/* URL form */}
              <div className="animate-page-enter-delay-2">
                <HomepageForm />
              </div>

              {/* Sub-CTA trust line */}
              <p className="mt-4 text-xs text-[color:var(--color-text-secondary)] animate-page-enter-delay-3">
                Free to start. No credit card. Takes about 60 seconds.
              </p>
            </div>

            {/* Right: popup preview illustration */}
            <div className="flex justify-center lg:justify-end animate-page-enter-delay-2 mt-10 lg:mt-0">
              <PopupPreview />
            </div>
          </div>
        </div>
      </section>

      {/* ── Social proof bar ────────────────────────────────────────── */}
      <div className="border-y border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)]">
        <div className="mx-auto max-w-6xl px-5 py-5 reveal-stagger">
          <dl className="grid grid-cols-2 sm:flex sm:flex-row items-center justify-center gap-5 sm:gap-12">
            {[
              { value: "4.2M+", label: "popups served" },
              { value: "1,800+", label: "stores using Asmos" },
              { value: "+23%", label: "average capture lift" },
              { value: "2 min", label: "to first live popup" },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col items-center gap-0.5 text-center">
                <dt className="text-xl sm:text-[1.375rem] font-bold tracking-tight text-[color:var(--color-text-primary)] tabular-nums">
                  {stat.value}
                </dt>
                <dd className="text-[11px] sm:text-xs text-[color:var(--color-text-secondary)] font-medium">
                  {stat.label}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* ── How it works ────────────────────────────────────────────── */}
      <section id="how-it-works" className="px-5 py-16 sm:py-24 bg-[color:var(--color-surface)]">
        <div className="mx-auto max-w-6xl">
          <div className="mb-2 flex justify-center reveal">
            <span className="inline-block rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-text-secondary)]">
              How it works
            </span>
          </div>
          <h2
            className="mb-3 text-2xl sm:text-[1.875rem] font-bold tracking-tight text-[color:var(--color-text-primary)] text-center reveal"
            style={{ textWrap: "balance" } as React.CSSProperties}
          >
            Live popup on your store in under 5 minutes
          </h2>
          <p className="text-center text-sm text-[color:var(--color-text-secondary)] mb-10 sm:mb-14 max-w-sm mx-auto reveal">
            No templates to configure. No design decisions. Just paste your URL.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 reveal-stagger">
            {[
              {
                n: "01",
                title: "Paste your store URL",
                body: "We scan your brand colors, tone, and existing offers in under 10 seconds. No account needed yet.",
                callout: "Brand-matched automatically",
              },
              {
                n: "02",
                title: "Get a popup built for your brand",
                body: "Asmos generates a popup with copy and design tailored to your store. Review it before you commit to anything.",
                callout: "Live preview, no signup required",
              },
              {
                n: "03",
                title: "It keeps improving on its own",
                body: "Once live, Asmos tests multiple versions and automatically sends more visitors to the one converting best.",
                callout: "No manual A/B setup needed",
              },
            ].map((item) => (
              <div
                key={item.n}
                className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-7 flex flex-col gap-5"
              >
                <span className="text-3xl font-bold tabular-nums text-[color:var(--color-primary)] opacity-20 tracking-tight leading-none">
                  {item.n}
                </span>
                <div>
                  <h3 className="text-base font-semibold text-[color:var(--color-text-primary)] mb-2">
                    {item.title}
                  </h3>
                  <p
                    className="text-sm text-[color:var(--color-text-secondary)] leading-relaxed"
                    style={{ textWrap: "pretty" } as React.CSSProperties}
                  >
                    {item.body}
                  </p>
                </div>
                <div className="mt-auto pt-3 border-t border-[color:var(--color-border)] flex items-center gap-2">
                  <Check />
                  <span className="text-xs font-medium text-[color:var(--color-text-secondary)]">
                    {item.callout}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Results section ─────────────────────────────────────────── */}
      <section className="px-5 py-16 sm:py-24 bg-[color:var(--color-surface-sunken)] border-t border-[color:var(--color-border)]">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12 items-center">
            {/* Left: copy */}
            <div className="reveal">
              <div className="mb-4">
                <span className="inline-block rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-text-secondary)]">
                  Results
                </span>
              </div>
              <h2
                className="mb-4 text-2xl sm:text-[1.875rem] font-bold tracking-tight text-[color:var(--color-text-primary)]"
                style={{ textWrap: "balance" } as React.CSSProperties}
              >
                Most popup tools show the same thing to everyone, forever
              </h2>
              <p
                className="mb-8 text-sm text-[color:var(--color-text-secondary)] leading-relaxed max-w-sm"
                style={{ textWrap: "pretty" } as React.CSSProperties}
              >
                Asmos runs multiple popup versions simultaneously, figures out
                which one is actually converting visitors, and shifts traffic
                to it automatically. No spreadsheets. No weekly check-ins.
              </p>
              <ul className="space-y-3">
                {[
                  "Tests multiple versions at once, not just two",
                  "Adapts to device, time of day, and traffic source",
                  "Stops wasting impressions on underperforming variants early",
                  "Full history of every test, nothing gets deleted",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-[color:var(--color-text-secondary)]">
                    <Check />
                    <span style={{ textWrap: "pretty" } as React.CSSProperties}>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8 sm:mt-10">
                <Link
                  href="/sign-up"
                  className="inline-flex items-center gap-2 rounded-lg bg-[color:var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-[color:var(--color-primary-dark)] active:scale-[0.97]"
                >
                  Start growing my list
                  <ArrowRight className="text-white/80" />
                </Link>
                <p className="mt-2.5 text-xs text-[color:var(--color-text-secondary)]">
                  Free to start, no credit card.
                </p>
              </div>
            </div>

            {/* Right: metric cards */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 reveal-stagger">
              {[
                {
                  metric: "+23%",
                  label: "Average email capture lift in the first 30 days",
                  accent: false,
                },
                {
                  metric: "8x",
                  label: "More popup versions tested per campaign than a manual A/B tool",
                  accent: true,
                },
                {
                  metric: "~60s",
                  label: "From store URL to a branded popup live on your site",
                  accent: false,
                },
                {
                  metric: "0",
                  label: "Manual tweaks required after setup. It runs itself.",
                  accent: false,
                },
              ].map((card) => (
                <div
                  key={card.metric}
                  className={[
                    "rounded-2xl border p-4 sm:p-6 flex flex-col gap-2",
                    card.accent
                      ? "border-[color:var(--color-primary)]/25 bg-[color:var(--color-primary-light)]"
                      : "border-[color:var(--color-border)] bg-[color:var(--color-surface)]",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "text-2xl sm:text-3xl font-bold tabular-nums tracking-tight",
                      card.accent
                        ? "text-[color:var(--color-primary)]"
                        : "text-[color:var(--color-text-primary)]",
                    ].join(" ")}
                  >
                    {card.metric}
                  </span>
                  <p
                    className="text-xs text-[color:var(--color-text-secondary)] leading-relaxed"
                    style={{ textWrap: "pretty" } as React.CSSProperties}
                  >
                    {card.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Testimonials ────────────────────────────────────────────── */}
      <section className="px-5 py-16 sm:py-24 bg-[color:var(--color-surface)] border-t border-[color:var(--color-border)]">
        <div className="mx-auto max-w-6xl">
          <div className="mb-2 flex justify-center reveal">
            <span className="inline-block rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-text-secondary)]">
              From store owners
            </span>
          </div>
          <h2
            className="mb-10 sm:mb-14 text-2xl sm:text-[1.875rem] font-bold tracking-tight text-[color:var(--color-text-primary)] text-center reveal"
            style={{ textWrap: "balance" } as React.CSSProperties}
          >
            Store owners who stopped guessing what works
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 reveal-stagger">
            {[
              {
                quote:
                  "We went from a 2.1% capture rate to 5.8% in three weeks. The popup just kept improving on its own.",
                name: "Sara M.",
                role: "Owner, apparel brand",
              },
              {
                quote:
                  "Set it up in under 5 minutes. Didn't touch it for a month. Conversion was up 31% compared to our old popup tool.",
                name: "Dmitri V.",
                role: "Marketing lead, home goods store",
              },
              {
                quote:
                  "The brand-match on setup is genuinely impressive. First popup looked like we designed it ourselves.",
                name: "Priya K.",
                role: "Founder, skincare brand",
              },
            ].map((t) => (
              <figure
                key={t.name}
                className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-7 flex flex-col gap-5"
              >
                {/* Star row */}
                <div className="flex gap-0.5" aria-label="5 stars">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg key={i} aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="#165DFF">
                      <path d="M6 1l1.24 2.51L10 3.93l-2 1.95.47 2.75L6 7.27 3.53 8.63 4 5.88 2 3.93l2.76-.42L6 1z" />
                    </svg>
                  ))}
                </div>
                <blockquote>
                  <p
                    className="text-sm text-[color:var(--color-text-primary)] leading-relaxed"
                    style={{ textWrap: "pretty" } as React.CSSProperties}
                  >
                    "{t.quote}"
                  </p>
                </blockquote>
                <figcaption className="mt-auto flex items-center gap-3">
                  {/* Avatar placeholder */}
                  <div
                    className="h-8 w-8 rounded-full bg-[color:var(--color-primary-light)] border border-[color:var(--color-border)] flex items-center justify-center shrink-0"
                  >
                    <span className="text-[11px] font-semibold text-[color:var(--color-primary)]">
                      {t.name[0]}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[color:var(--color-text-primary)]">{t.name}</p>
                    <p className="text-[11px] text-[color:var(--color-text-secondary)]">{t.role}</p>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────────── */}
      <section id="pricing" className="px-5 py-16 sm:py-24 bg-[color:var(--color-surface-sunken)] border-t border-[color:var(--color-border)]">
        <div className="mx-auto max-w-6xl">
          <div className="mb-2 flex justify-center reveal">
            <span className="inline-block rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-text-secondary)]">
              Pricing
            </span>
          </div>
          <h2
            className="mb-3 text-2xl sm:text-[1.875rem] font-bold tracking-tight text-[color:var(--color-text-primary)] text-center reveal"
            style={{ textWrap: "balance" } as React.CSSProperties}
          >
            Start free. Upgrade when you outgrow it.
          </h2>
          <p className="text-sm text-[color:var(--color-text-secondary)] text-center mb-10 sm:mb-14 max-w-xs mx-auto reveal">
            The free plan doesn't expire. No credit card, no trial clock.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-2xl mx-auto reveal-stagger">
            {/* Starter */}
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-8 flex flex-col">
              <div className="mb-7">
                <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-text-secondary)] mb-3">
                  Starter
                </p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-4xl font-bold tracking-tight text-[color:var(--color-text-primary)] tabular-nums">
                    Free
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-[color:var(--color-text-secondary)]">
                  No credit card required
                </p>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {[
                  "Up to 1,000 impressions / month",
                  "1 active campaign",
                  "AI brand analysis",
                  "AI-generated popup",
                ].map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm text-[color:var(--color-text-secondary)]">
                    <Check />
                    {feature}
                  </li>
                ))}
              </ul>

              <Link
                href="/sign-up"
                className="block w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2.5 text-center text-sm font-semibold text-[color:var(--color-text-primary)] transition-[background-color,transform] duration-200 hover:bg-[color:var(--color-surface-sunken)] active:scale-[0.97]"
              >
                Get started free
              </Link>
              <p className="mt-2.5 text-center text-xs text-[color:var(--color-text-secondary)]">
                No expiry on the free plan
              </p>
            </div>

            {/* Growth — featured */}
            <div className="rounded-[1.375rem] border border-[color:var(--color-primary)]/30 bg-[color:var(--color-primary-light)] p-1.5 shadow-lg">
              <div
                className="flex flex-col rounded-[1rem] bg-[color:var(--color-surface)] p-7 h-full"
                style={{ boxShadow: "inset 0 1px 1px rgba(255,255,255,0.95)" }}
              >
                <div className="mb-7">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-primary)]">
                      Growth
                    </p>
                    <span className="rounded-full bg-[color:var(--color-primary)] px-2.5 py-0.5 text-[10px] font-semibold text-white">
                      Most popular
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-4xl font-bold tracking-tight text-[color:var(--color-text-primary)] tabular-nums">
                      $29
                    </span>
                    <span className="text-sm text-[color:var(--color-text-secondary)]">/ mo</span>
                  </div>
                  <p className="mt-1.5 text-xs text-[color:var(--color-text-secondary)]">
                    Cancel anytime. No contracts.
                  </p>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {[
                    "Unlimited impressions",
                    "Unlimited campaigns",
                    "AI optimization, always on",
                    "Bandit-based A/B testing",
                    "Analytics dashboard",
                    "Priority support",
                  ].map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm text-[color:var(--color-text-secondary)]">
                      <Check />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Link
                  href="/sign-up"
                  className="block w-full rounded-lg bg-[color:var(--color-primary)] px-4 py-2.5 text-center text-sm font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-[color:var(--color-primary-dark)] active:scale-[0.97]"
                >
                  Start 14-day free trial
                </Link>
                <p className="mt-2.5 text-center text-xs text-[color:var(--color-text-secondary)]">
                  No credit card needed to start
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────────── */}
      <section className="px-5 py-16 sm:py-24 bg-[color:var(--color-surface)] border-t border-[color:var(--color-border)]">
        <div className="mx-auto max-w-2xl text-center reveal">
          <h2
            className="mb-4 text-2xl sm:text-[2rem] font-bold tracking-tight text-[color:var(--color-text-primary)]"
            style={{ textWrap: "balance" } as React.CSSProperties}
          >
            Find out what your store's been leaving on the table
          </h2>
          <p className="mb-8 text-sm text-[color:var(--color-text-secondary)] max-w-sm mx-auto">
            Paste your URL and get a branded popup preview in under a minute. No account needed.
          </p>
          <HomepageForm />
          <p className="mt-4 text-xs text-[color:var(--color-text-secondary)]">
            Free to start. No credit card. About 60 seconds.
          </p>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="border-t border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] px-5 py-8">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[color:var(--color-text-secondary)]">
          <div className="flex items-center gap-3">
            <Image
              src="/assets/asmos-logo-primary-lightbg.webp"
              alt="Asmos"
              width={72}
              height={18}
              className="h-4 w-auto opacity-60"
            />
            <span>&copy; 2026 Asmos</span>
          </div>
          <nav className="flex items-center gap-5">
            <Link href="/pricing" className="transition-colors duration-200 hover:text-[color:var(--color-text-primary)]">
              Pricing
            </Link>
            <Link href="/privacy" className="transition-colors duration-200 hover:text-[color:var(--color-text-primary)]">
              Privacy
            </Link>
            <Link href="/terms" className="transition-colors duration-200 hover:text-[color:var(--color-text-primary)]">
              Terms
            </Link>
          </nav>
        </div>
      </footer>

      {/* ── Scroll reveal wiring ────────────────────────────────────── */}
      <ScrollReveal />
    </div>
  );
}

// Lightweight IntersectionObserver wiring for .reveal and .reveal-stagger
function ScrollReveal() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
(function(){
  if(typeof IntersectionObserver==='undefined') return;
  var els=document.querySelectorAll('.reveal,.reveal-stagger');
  var io=new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(e.isIntersecting){e.target.classList.add('is-visible');io.unobserve(e.target);}
    });
  },{threshold:0.12,rootMargin:'0px 0px -40px 0px'});
  els.forEach(function(el){io.observe(el);});
})();
        `,
      }}
    />
  );
}
