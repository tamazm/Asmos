import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth-adapter";
import { HomepageForm } from "@/components/ui/HomepageForm";
import { PopupPreview } from "@/components/ui/PopupPreview";

// ─── Icons ───────────────────────────────────────────────────────────
function Check() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none"
      className="shrink-0 mt-0.5 text-[color:var(--color-primary)]">
      <circle cx="7" cy="7" r="7" fill="currentColor" opacity="0.12" />
      <path d="M4 7l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowRight({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none" className={className}>
      <path d="M3 7h8m0 0L7.5 3.5M11 7L7.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────
export default async function LandingPage() {
  const { userId } = await auth();
  const isMock = process.env.MOCK_AUTH === "true";
  if (userId && !isMock) redirect("/dashboard");

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[color:var(--color-surface)]">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <header
        id="site-header"
        className="sticky top-0 z-40 border-b border-[color:var(--color-hero-border)] bg-[color:var(--color-hero-bg)] backdrop-blur-sm transition-all duration-300"
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <Image
            src="/assets/asmos-logo-primary-lightbg.webp"
            alt="Asmos"
            width={110} height={28} priority
            className="h-7 w-auto brightness-0 invert"
          />
          <nav className="hidden items-center gap-6 text-sm font-medium sm:flex" style={{ color: "var(--color-hero-muted)" }}>
            <Link href="#how-it-works"
              className="transition-colors duration-200 hover:text-[color:var(--color-hero-text)]">
              How it works
            </Link>
            <Link href="/pricing"
              className="transition-colors duration-200 hover:text-[color:var(--color-hero-text)]">
              Pricing
            </Link>
          </nav>
          <div className="flex items-center gap-3 text-sm font-medium">
            <Link href="/sign-in"
              className="hidden transition-colors duration-200 sm:block"
              style={{ color: "var(--color-hero-muted)" }}
              onMouseEnter={undefined}>
              Log in
            </Link>
            <Link href="/sign-up"
              className="rounded-lg bg-[color:var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-[color:var(--color-primary-dark)] active:scale-[0.97]">
              Get started free
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero — dark ─────────────────────────────────────────────── */}
      <section className="hero-dark relative overflow-hidden px-5 pb-24 pt-16 sm:pb-32 sm:pt-24">
        {/* Radial glow behind popup */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0"
          style={{
            background: [
              "radial-gradient(ellipse 60% 55% at 72% 50%, oklch(48% 0.255 258 / 0.13) 0%, transparent 65%)",
              "radial-gradient(ellipse 80% 40% at 50% -5%, oklch(48% 0.255 258 / 0.09) 0%, transparent 60%)",
            ].join(", "),
          }}
        />

        <div className="relative mx-auto max-w-6xl">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">

            {/* Left: copy */}
            <div>
              {/* Eyebrow */}
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium animate-page-enter"
                style={{ borderColor: "var(--color-hero-border)", color: "var(--color-hero-muted)", background: "oklch(18% 0.032 258)" }}>
                <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-success)] shrink-0"
                  style={{ boxShadow: "0 0 0 3px oklch(35% 0.12 150 / 0.35)" }} />
                AI popup optimization for Shopify &amp; WooCommerce
              </div>

              {/* Headline — word-by-word reveal */}
              <h1 className="mb-6 font-bold tracking-[-0.035em] leading-[1.06]"
                style={{
                  color: "var(--color-hero-text)",
                  fontSize: "clamp(2.1rem, 5.5vw, 4rem)",
                  textWrap: "balance",
                } as React.CSSProperties}>
                {"Your next 500 email subscribers are already on your site".split(" ").map((w, i) => (
                  <span key={i} className="hero-word" style={{ marginRight: "0.28em" }}>{w}</span>
                ))}
              </h1>

              <p className="mb-8 text-base leading-relaxed sm:text-lg animate-page-enter-delay-2 max-w-[480px]"
                style={{ color: "var(--color-hero-muted)", textWrap: "pretty" } as React.CSSProperties}>
                Paste your store URL. Asmos reads your brand, builds a popup that matches it, then runs
                continuous experiments to find the version that converts the most.
              </p>

              <div className="animate-page-enter-delay-2">
                <HomepageForm dark />
              </div>

              <p className="mt-3.5 text-xs animate-page-enter-delay-3" style={{ color: "var(--color-hero-muted)" }}>
                Free to start. No credit card. About 60 seconds.
              </p>
            </div>

            {/* Right: popup preview */}
            <div className="flex justify-center pb-10 lg:justify-end lg:pb-0 animate-page-enter-delay-2">
              <PopupPreview />
            </div>
          </div>
        </div>
      </section>

      {/* ── Social proof bar ────────────────────────────────────────── */}
      <div className="border-y border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)]">
        <div className="mx-auto max-w-6xl px-5 py-6 reveal-stagger">
          <dl className="flex flex-col items-center justify-center gap-6 sm:flex-row sm:gap-14">
            {[
              { value: "4200000", display: "4.2M+", label: "popups served" },
              { value: "1800",    display: "1,800+", label: "stores using Asmos" },
              { value: "23",      display: "+23%",   label: "avg. capture lift" },
              { value: "2",       display: "2 min",  label: "to first live popup" },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col items-center gap-0.5 text-center">
                <dt
                  className="stat-counter text-[1.5rem] font-bold tracking-tight text-[color:var(--color-text-primary)] tabular-nums"
                  data-target={stat.value}
                  data-display={stat.display}
                >
                  {stat.display}
                </dt>
                <dd className="text-xs font-medium text-[color:var(--color-text-secondary)]">
                  {stat.label}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* ── How it works ────────────────────────────────────────────── */}
      <section id="how-it-works" className="px-5 py-20 sm:py-28 bg-[color:var(--color-surface)]">
        <div className="mx-auto max-w-5xl">
          <div className="mb-2 flex justify-center reveal">
            <span className="inline-block rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-text-secondary)]">
              How it works
            </span>
          </div>
          <h2 className="mb-3 text-center font-bold tracking-tight text-[color:var(--color-text-primary)] reveal"
            style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", textWrap: "balance" } as React.CSSProperties}>
            Live popup on your store in under 5 minutes
          </h2>
          <p className="text-center text-sm text-[color:var(--color-text-secondary)] mb-16 max-w-sm mx-auto reveal"
            style={{ textWrap: "pretty" } as React.CSSProperties}>
            No templates to configure. No design decisions. Just paste your URL.
          </p>

          {/* Step rail */}
          <div className="relative grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-6 steps-rail reveal-stagger">
            {[
              {
                n: "01",
                title: "Paste your store URL",
                body: "We scan your brand colors, tone, and existing offers in under 10 seconds. No account needed yet.",
                callout: "Brand-matched automatically",
              },
              {
                n: "02",
                title: "Review your popup",
                body: "Asmos generates a popup with copy and design tailored to your store. Review it before committing to anything.",
                callout: "Live preview, no signup required",
              },
              {
                n: "03",
                title: "It improves on its own",
                body: "Once live, Asmos tests multiple versions and shifts traffic to the one converting best. Automatically.",
                callout: "No manual A/B setup",
              },
            ].map((item) => (
              <div key={item.n} className="flex flex-col gap-4">
                {/* Step number */}
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[color:var(--color-primary)]/25 bg-[color:var(--color-primary-light)]">
                    <span className="text-[13px] font-bold tabular-nums text-[color:var(--color-primary)]">{item.n}</span>
                  </div>
                  <div className="h-px flex-1 bg-[color:var(--color-border)] md:hidden" />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-[color:var(--color-text-primary)] mb-1.5">{item.title}</h3>
                  <p className="text-sm text-[color:var(--color-text-secondary)] leading-relaxed"
                    style={{ textWrap: "pretty" } as React.CSSProperties}>{item.body}</p>
                </div>
                <div className="mt-auto flex items-center gap-2 pt-3 border-t border-[color:var(--color-border)]">
                  <Check />
                  <span className="text-xs font-medium text-[color:var(--color-text-secondary)]">{item.callout}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Results section ─────────────────────────────────────────── */}
      <section className="px-5 py-20 sm:py-28 bg-[color:var(--color-surface-sunken)] border-t border-[color:var(--color-border)]">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-start">

            {/* Left: copy */}
            <div className="reveal">
              <div className="mb-4">
                <span className="inline-block rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-text-secondary)]">
                  Results
                </span>
              </div>
              <h2 className="mb-5 font-bold tracking-tight text-[color:var(--color-text-primary)]"
                style={{ fontSize: "clamp(1.4rem, 3vw, 1.875rem)", textWrap: "balance" } as React.CSSProperties}>
                Most popup tools show the same thing to everyone, forever
              </h2>
              <p className="mb-7 text-sm text-[color:var(--color-text-secondary)] leading-relaxed max-w-sm"
                style={{ textWrap: "pretty" } as React.CSSProperties}>
                Asmos runs multiple popup versions simultaneously, figures out which one is actually
                converting visitors, and shifts traffic to it automatically. No spreadsheets. No weekly check-ins.
              </p>
              <ul className="space-y-3 mb-10">
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
              <Link href="/sign-up"
                className="btn-wipe inline-flex items-center gap-2 rounded-lg bg-[color:var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white active:scale-[0.97] transition-transform duration-150">
                Start growing my list
                <ArrowRight className="text-white/80" />
              </Link>
              <p className="mt-2.5 text-xs text-[color:var(--color-text-secondary)]">Free to start, no credit card.</p>
            </div>

            {/* Right: big stat + facts */}
            <div className="reveal" style={{ transitionDelay: "80ms" }}>
              {/* Hero stat */}
              <div className="mb-8 rounded-2xl border border-[color:var(--color-primary)]/20 bg-[color:var(--color-primary-light)] p-8">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-primary)]">
                  Average in first 30 days
                </div>
                <div className="font-bold tabular-nums tracking-tight leading-none text-[color:var(--color-primary)]"
                  style={{ fontSize: "clamp(4rem, 10vw, 6rem)" }}>
                  +23%
                </div>
                <div className="mt-2 text-sm text-[color:var(--color-text-secondary)]">
                  email capture lift
                </div>
              </div>
              {/* Supporting facts */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { n: "8x",   label: "more variants tested vs. manual A/B" },
                  { n: "~60s", label: "from URL to branded popup live" },
                  { n: "0",    label: "manual tweaks needed after setup" },
                ].map((f) => (
                  <div key={f.n} className="flex flex-col gap-1">
                    <span className="text-2xl font-bold tabular-nums tracking-tight text-[color:var(--color-text-primary)]">{f.n}</span>
                    <span className="text-[11px] text-[color:var(--color-text-secondary)] leading-snug"
                      style={{ textWrap: "pretty" } as React.CSSProperties}>{f.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Testimonials ────────────────────────────────────────────── */}
      <section className="px-5 py-20 sm:py-28 bg-[color:var(--color-surface)] border-t border-[color:var(--color-border)]">
        <div className="mx-auto max-w-5xl">
          <div className="mb-2 flex justify-center reveal">
            <span className="inline-block rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-text-secondary)]">
              From store owners
            </span>
          </div>
          <h2 className="mb-12 font-bold tracking-tight text-[color:var(--color-text-primary)] text-center reveal"
            style={{ fontSize: "clamp(1.4rem, 3vw, 1.875rem)", textWrap: "balance" } as React.CSSProperties}>
            Store owners who stopped guessing what works
          </h2>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3 reveal-stagger">
            {[
              {
                quote: "We went from a 2.1% capture rate to 5.8% in three weeks. The popup just kept improving on its own.",
                name: "Sara M.",
                role: "Owner, apparel brand",
                color: "#6366f1",
              },
              {
                quote: "Set it up in under 5 minutes. Didn't touch it for a month. Conversion was up 31% compared to our old popup tool.",
                name: "Dmitri V.",
                role: "Marketing lead, home goods",
                color: "#165DFF",
              },
              {
                quote: "The brand-match on setup is genuinely impressive. First popup looked like we designed it ourselves.",
                name: "Priya K.",
                role: "Founder, skincare brand",
                color: "#10b981",
              },
            ].map((t) => (
              <figure key={t.name}
                className="relative overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-7 flex flex-col gap-5">
                {/* Decorative large quote mark */}
                <span aria-hidden="true"
                  className="pointer-events-none absolute -top-3 -right-1 select-none font-bold leading-none"
                  style={{ fontSize: "9rem", color: t.color, opacity: 0.05, lineHeight: 1 }}>
                  &ldquo;
                </span>
                {/* Stars */}
                <div className="flex gap-0.5" aria-label="5 stars">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg key={i} aria-hidden="true" width="12" height="12" viewBox="0 0 12 12">
                      <path fill={t.color} opacity="0.9"
                        d="M6 1l1.24 2.51L10 3.93l-2 1.95.47 2.75L6 7.27 3.53 8.63 4 5.88 2 3.93l2.76-.42L6 1z" />
                    </svg>
                  ))}
                </div>
                <blockquote>
                  <p className="text-sm text-[color:var(--color-text-primary)] leading-relaxed"
                    style={{ textWrap: "pretty" } as React.CSSProperties}>
                    &ldquo;{t.quote}&rdquo;
                  </p>
                </blockquote>
                <figcaption className="mt-auto flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full border border-white/60 flex items-center justify-center shrink-0"
                    style={{ background: `radial-gradient(circle at 35% 35%, ${t.color}cc, ${t.color}66)` }}>
                    <span className="text-[11px] font-bold text-white">{t.name[0]}</span>
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
      <section id="pricing" className="px-5 py-20 sm:py-28 bg-[color:var(--color-surface-sunken)] border-t border-[color:var(--color-border)]">
        <div className="mx-auto max-w-5xl">
          <div className="mb-2 flex justify-center reveal">
            <span className="inline-block rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-text-secondary)]">
              Pricing
            </span>
          </div>
          <h2 className="mb-3 font-bold tracking-tight text-[color:var(--color-text-primary)] text-center reveal"
            style={{ fontSize: "clamp(1.4rem, 3vw, 1.875rem)", textWrap: "balance" } as React.CSSProperties}>
            Start free. Upgrade when you outgrow it.
          </h2>
          <p className="text-sm text-[color:var(--color-text-secondary)] text-center mb-12 max-w-xs mx-auto reveal">
            The free plan does not expire. No credit card, no trial clock.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-2xl mx-auto reveal-stagger">
            {/* Starter */}
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-8 flex flex-col">
              <div className="mb-7">
                <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-text-secondary)] mb-3">Starter</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-4xl font-bold tracking-tight text-[color:var(--color-text-primary)] tabular-nums">Free</span>
                </div>
                <p className="mt-1.5 text-xs text-[color:var(--color-text-secondary)]">No credit card required</p>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {["Up to 1,000 impressions / month", "1 active campaign", "AI brand analysis", "AI-generated popup"].map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-[color:var(--color-text-secondary)]">
                    <Check />{f}
                  </li>
                ))}
              </ul>
              <Link href="/sign-up"
                className="block w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2.5 text-center text-sm font-semibold text-[color:var(--color-text-primary)] transition-[background-color,transform] duration-200 hover:bg-[color:var(--color-surface-sunken)] active:scale-[0.97]">
                Get started free
              </Link>
              <p className="mt-2.5 text-center text-xs text-[color:var(--color-text-secondary)]">No expiry on the free plan</p>
            </div>

            {/* Growth */}
            <div className="rounded-[1.375rem] border border-[color:var(--color-primary)]/30 bg-[color:var(--color-primary-light)] p-1.5 shadow-lg">
              <div className="flex flex-col rounded-[1rem] bg-[color:var(--color-surface)] p-7 h-full"
                style={{ boxShadow: "inset 0 1px 1px rgba(255,255,255,0.95)" }}>
                <div className="mb-7">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-primary)]">Growth</p>
                    <span className="rounded-full bg-[color:var(--color-primary)] px-2.5 py-0.5 text-[10px] font-semibold text-white">Most popular</span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-4xl font-bold tracking-tight text-[color:var(--color-text-primary)] tabular-nums">$29</span>
                    <span className="text-sm text-[color:var(--color-text-secondary)]">/ mo</span>
                  </div>
                  <p className="mt-1.5 text-xs text-[color:var(--color-text-secondary)]">Cancel anytime. No contracts.</p>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {["Unlimited impressions", "Unlimited campaigns", "AI optimization, always on", "Bandit-based A/B testing", "Analytics dashboard", "Priority support"].map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-[color:var(--color-text-secondary)]">
                      <Check />{f}
                    </li>
                  ))}
                </ul>
                <Link href="/sign-up"
                  className="btn-wipe block w-full rounded-lg bg-[color:var(--color-primary)] px-4 py-2.5 text-center text-sm font-semibold text-white transition-transform duration-150 active:scale-[0.97]">
                  Start 14-day free trial
                </Link>
                <p className="mt-2.5 text-center text-xs text-[color:var(--color-text-secondary)]">No credit card needed to start</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA — blue drench ──────────────────────────────────── */}
      <section className="px-5 py-20 sm:py-28 reveal"
        style={{
          background: "oklch(42% 0.255 258)",
        }}>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mb-4 font-bold tracking-tight text-white"
            style={{ fontSize: "clamp(1.6rem, 4vw, 2.25rem)", textWrap: "balance" } as React.CSSProperties}>
            Find out what your store&apos;s been leaving on the table
          </h2>
          <p className="mb-8 text-sm leading-relaxed max-w-sm mx-auto" style={{ color: "oklch(85% 0.05 258)" }}>
            Paste your URL and get a branded popup preview in under a minute. No account needed.
          </p>
          <HomepageForm dark inverted />
          <p className="mt-4 text-xs" style={{ color: "oklch(75% 0.06 258)" }}>
            Free to start. No credit card. About 60 seconds.
          </p>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="border-t border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] px-5 py-8">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[color:var(--color-text-secondary)]">
          <div className="flex items-center gap-3">
            <Image src="/assets/asmos-logo-primary-lightbg.webp" alt="Asmos" width={72} height={18}
              className="h-4 w-auto opacity-50" />
            <span>&copy; 2026 Asmos</span>
          </div>
          <nav className="flex items-center gap-5">
            {[["Pricing", "/pricing"], ["Privacy", "/privacy"], ["Terms", "/terms"]].map(([label, href]) => (
              <Link key={href} href={href}
                className="transition-colors duration-200 hover:text-[color:var(--color-text-primary)]">
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>

      {/* ── JS wiring: scroll-reveal + count-up + nav ──────────────── */}
      <ScrollWiring />
    </div>
  );
}

// ─── Scroll wiring ────────────────────────────────────────────────────
function ScrollWiring() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
(function(){
  /* ---------- scroll-reveal ---------- */
  if(typeof IntersectionObserver==='undefined') return;
  var io=new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(e.isIntersecting){e.target.classList.add('is-visible');io.unobserve(e.target);}
    });
  },{threshold:0.1,rootMargin:'0px 0px -40px 0px'});
  document.querySelectorAll('.reveal,.reveal-stagger').forEach(function(el){io.observe(el);});

  /* ---------- stat count-up ---------- */
  var counters=document.querySelectorAll('.stat-counter[data-display]');
  var countIo=new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(!e.isIntersecting) return;
      countIo.unobserve(e.target);
      var el=e.target;
      var display=el.getAttribute('data-display');
      var prefix=display.startsWith('+') ? '+' : '';
      var suffix=display.endsWith('%') ? '%' : display.endsWith('+') ? '+' : '';
      var raw=display.replace(/[^0-9.]/g,'');
      var target=parseFloat(raw);
      if(isNaN(target)||target>99999){return;}
      var start=0;var dur=1400;var startTs=null;
      function step(ts){
        if(!startTs) startTs=ts;
        var p=Math.min((ts-startTs)/dur,1);
        var ease=1-Math.pow(1-p,4);
        var cur=Math.round(ease*target);
        el.textContent=prefix+(display.includes(',') ? cur.toLocaleString() : cur)+suffix;
        if(p<1) requestAnimationFrame(step);
        else el.textContent=display;
      }
      requestAnimationFrame(step);
    });
  },{threshold:0.5});
  counters.forEach(function(el){countIo.observe(el);});

  /* ---------- navbar dark → light on scroll ---------- */
  var header=document.getElementById('site-header');
  function onScroll(){
    if(!header) return;
    if(window.scrollY>80){
      header.classList.add('nav-scrolled');
      header.classList.remove('nav-hero-dark');
      var img=header.querySelector('img');
      if(img){img.style.filter='';}
      header.querySelectorAll('a').forEach(function(a){
        a.style.removeProperty('color');
      });
    } else {
      header.classList.remove('nav-scrolled');
      header.classList.add('nav-hero-dark');
      var img2=header.querySelector('img');
      if(img2){img2.style.filter='brightness(0) invert(1)';}
    }
  }
  window.addEventListener('scroll',onScroll,{passive:true});
  onScroll();
})();
        `,
      }}
    />
  );
}
