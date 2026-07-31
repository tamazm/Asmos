import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth-adapter";
import { HomepageForm } from "@/components/ui/HomepageForm";
import { KnockoutBracketPreview } from "@/components/ui/KnockoutBracketPreview";

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

export default async function LandingPage() {
  const { userId } = await auth();
  const isMock = process.env.MOCK_AUTH === "true";
  if (userId && !isMock) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[color:var(--color-surface)]">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-[color:var(--color-hero-border)] bg-[color:var(--color-hero-bg)]/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <Image
            src="/assets/asmos-logo-primary-darkbg.webp"
            alt="Asmos"
            width={110}
            height={28}
            priority
            className="h-8 w-auto"
          />
          <nav className="hidden items-center gap-6 text-sm font-medium text-[color:var(--color-hero-muted)] sm:flex">
            <Link
              href="#how-it-works"
              className="transition-colors duration-200 hover:text-[color:var(--color-hero-text)]"
            >
              How it works
            </Link>
            <Link
              href="/pricing"
              className="transition-colors duration-200 hover:text-[color:var(--color-hero-text)]"
            >
              Pricing
            </Link>
          </nav>
          <div className="flex items-center gap-3 text-sm font-medium">
            <Link
              href="/sign-in"
              className="hidden text-[color:var(--color-hero-muted)] transition-colors duration-200 hover:text-[color:var(--color-hero-text)] sm:block"
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

      {/* ── Hero — dark, typographic ─────────────────────────────────── */}
      <section className="hero-dark relative px-5 pt-14 pb-20 sm:pt-20 sm:pb-28 overflow-hidden">
        {/* Subtle blue ambient */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 60% at 60% 50%, oklch(35% 0.16 258 / 0.15) 0%, transparent 70%)",
          }}
        />

        <div className="relative mx-auto max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_440px] gap-12 lg:gap-16 items-center">

            {/* Left: copy + form */}
            <div>
              {/* Overline — just a label, no pill badge */}
              <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--color-primary)] animate-page-enter">
                Popup optimization for Shopify
              </p>

              {/* Display headline — Barlow Condensed, industrial scale */}
              <h1
                className="font-display mb-5 text-[clamp(3rem,7vw,5.5rem)] leading-[0.92] font-black tracking-tight text-[color:var(--color-hero-text)] uppercase animate-page-enter-delay-1"
              >
                Most visitors
                <br />
                leave.
                <br />
                <span className="text-[color:var(--color-primary)]">Asmos</span>{" "}
                keeps them.
              </h1>

              <p
                className="mb-7 text-base sm:text-lg text-[color:var(--color-hero-muted)] leading-relaxed max-w-[440px] animate-page-enter-delay-2"
                style={{ textWrap: "pretty" } as React.CSSProperties}
              >
                Paste your store URL. In 60 seconds, Asmos reads your brand and deploys a popup that captures emails and drives repeat sales. Then it keeps running knockout experiments until it converts as well as it possibly can.
              </p>

              <div className="animate-page-enter-delay-2">
                <HomepageForm dark />
              </div>

              {/* Social proof — minimal, no card */}
              <div className="mt-6 flex items-center gap-5 animate-page-enter-delay-3">
                <div className="flex -space-x-2">
                  {[
                    { bg: "#a78bfa", l: "S" },
                    { bg: "#34d399", l: "M" },
                    { bg: "#fb923c", l: "J" },
                    { bg: "#60a5fa", l: "K" },
                  ].map((a) => (
                    <span
                      key={a.l}
                      className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[color:var(--color-hero-bg)] text-[10px] font-bold text-white"
                      style={{ background: a.bg }}
                    >
                      {a.l}
                    </span>
                  ))}
                </div>
                <p className="text-sm text-[color:var(--color-hero-muted)]">
                  <span className="font-semibold text-[color:var(--color-hero-text)]">1,800+ stores</span>{" "}
                  growing with Asmos
                </p>
              </div>
            </div>

            {/* Right: Knockout bracket visualization */}
            <div className="hidden lg:flex justify-center animate-page-enter-delay-2">
              <KnockoutBracketPreview />
            </div>
          </div>
        </div>
      </section>

      {/* ── Editorial statement ──────────────────────────────────────── */}
      <section className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-5 py-14 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-8 lg:gap-16 items-start reveal">
            <div className="pt-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--color-text-secondary)]">
                The problem
              </p>
            </div>
            <div>
              <p
                className="font-display text-[clamp(1.7rem,3.5vw,2.6rem)] font-black uppercase leading-[1.05] tracking-tight text-[color:var(--color-text-primary)] mb-5"
                style={{ textWrap: "balance" } as React.CSSProperties}
              >
                97 out of 100 visitors leave without buying. Your popup isn&apos;t the problem. The version you launched in January is.
              </p>
              <p className="text-base text-[color:var(--color-text-secondary)] leading-relaxed max-w-prose">
                Most popup tools give you a template and walk away. Asmos keeps running after you launch. It tests variants automatically, kills underperformers, and doubles traffic on the winner. Every week, it gets closer to the ceiling.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works — rail layout ───────────────────────────────── */}
      <section id="how-it-works" className="px-5 py-16 sm:py-24 bg-[color:var(--color-surface-sunken)] border-b border-[color:var(--color-border)]">
        <div className="mx-auto max-w-6xl">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--color-primary)] reveal">
            How it works
          </p>
          <h2
            className="font-display mb-10 sm:mb-16 text-[clamp(2rem,4vw,3rem)] font-black uppercase tracking-tight text-[color:var(--color-text-primary)] reveal"
            style={{ textWrap: "balance" } as React.CSSProperties}
          >
            Three steps. Then it runs itself.
          </h2>

          <div className="relative reveal-stagger">
            {/* Connector line — desktop only */}
            <div
              aria-hidden="true"
              className="hidden md:block absolute top-[36px] left-0 right-0 h-px"
              style={{
                background: "linear-gradient(90deg, transparent 0%, var(--color-border) 8%, var(--color-border) 92%, transparent 100%)",
              }}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8">
              {[
                {
                  n: "01",
                  title: "Paste your store URL",
                  body: "We scan your brand colors, tone, and existing offers in under 10 seconds. No account needed yet.",
                  callout: "Brand-matched in seconds",
                },
                {
                  n: "02",
                  title: "Review your popup",
                  body: "Asmos builds a popup matched to your brand, offer, and audience. Live preview before you commit to anything.",
                  callout: "Live preview, no signup required",
                },
                {
                  n: "03",
                  title: "It keeps winning, automatically",
                  body: "Once live, Asmos runs knockout testing. Variants compete. Losers get cut. Traffic shifts to the winner. No check-ins.",
                  callout: "No manual A/B setup needed",
                },
              ].map((item) => (
                <div key={item.n} className="flex flex-col gap-4">
                  {/* Step number — big, positioned above the connector line */}
                  <div className="relative z-10 flex items-center gap-3 md:flex-col md:items-start md:gap-0">
                    <span
                      className="font-display text-[2.25rem] font-black tabular-nums leading-none tracking-tight text-[color:var(--color-primary)] md:mb-5"
                    >
                      {item.n}
                    </span>
                  </div>
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
                  <div className="flex items-center gap-2 pt-1">
                    <Check />
                    <span className="text-xs font-medium text-[color:var(--color-text-secondary)]">
                      {item.callout}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── The Knockout — product differentiator section ────────────── */}
      <section className="hero-dark px-5 py-16 sm:py-24 overflow-hidden">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_500px] gap-12 items-center">
            <div className="reveal">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--color-primary)]">
                The knockout system
              </p>
              <h2
                className="font-display mb-5 text-[clamp(2rem,4vw,3.25rem)] font-black uppercase leading-[0.95] tracking-tight text-[color:var(--color-hero-text)]"
                style={{ textWrap: "balance" } as React.CSSProperties}
              >
                No more &ldquo;set it and forget it.&rdquo;
                <br />
                <span className="text-[color:var(--color-primary)]">Set it and watch it win.</span>
              </h2>
              <p
                className="mb-6 text-base text-[color:var(--color-hero-muted)] leading-relaxed max-w-[400px]"
                style={{ textWrap: "pretty" } as React.CSSProperties}
              >
                Most A/B tools run variants equally until you manually declare a winner. Asmos shifts traffic toward the winner in real time, like a bracket tournament. Underperformers get eliminated. Traffic concentrates on what works.
              </p>
              <ul className="space-y-3">
                {[
                  "Up to 8 variants per campaign",
                  "Automatic winner promotion, no manual check-ins",
                  "Full bracket history so you see exactly why variants won",
                  "Adapts to device, time of day, and traffic source",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-[color:var(--color-hero-muted)]">
                    <svg aria-hidden width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 mt-0.5 text-[color:var(--color-primary)]">
                      <circle cx="7" cy="7" r="7" fill="currentColor" opacity="0.15" />
                      <path d="M4 7l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <Link
                  href="/sign-up"
                  className="inline-flex items-center gap-2 rounded-lg bg-[color:var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-[color:var(--color-primary-dark)] active:scale-[0.97]"
                >
                  See it in action
                  <svg aria-hidden width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3 7h8m0 0L7.5 3.5M11 7L7.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              </div>
            </div>

            {/* Bracket animation */}
            <div className="flex justify-center reveal-stagger">
              <KnockoutBracketPreview variant="dark" animated />
            </div>
          </div>
        </div>
      </section>

      {/* ── Results — single editorial statement + 2 large metrics ───── */}
      <section className="px-5 py-16 sm:py-24 bg-[color:var(--color-surface)] border-b border-[color:var(--color-border)]">
        <div className="mx-auto max-w-6xl">
          {/* Two-col: big metric + supporting text */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center mb-14 reveal">
            <div>
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--color-text-secondary)]">
                Results
              </p>
              <div className="mb-5">
                <span
                  className="font-display block text-[clamp(5rem,12vw,9rem)] font-black leading-none tracking-tight text-[color:var(--color-primary)] tabular-nums"
                >
                  +23%
                </span>
                <p className="text-lg font-semibold text-[color:var(--color-text-primary)] mt-1">
                  Average revenue lift in the first 30 days.
                </p>
              </div>
              <p className="text-sm text-[color:var(--color-text-secondary)] leading-relaxed max-w-sm">
                Across 1,800+ active stores. Median, not cherry-picked. Stores that set up in under 5 minutes and didn&apos;t touch it again.
              </p>
            </div>

            <div className="space-y-px">
              {[
                {
                  metric: "8x",
                  label: "More variants tested per campaign than any manual A/B tool",
                },
                {
                  metric: "~60s",
                  label: "From store URL to a live branded popup",
                },
                {
                  metric: "0",
                  label: "Manual tweaks required after launch",
                },
              ].map((item) => (
                <div
                  key={item.metric}
                  className="flex items-baseline gap-5 py-5 border-b border-[color:var(--color-border)] last:border-b-0"
                >
                  <span
                    className="font-display text-[clamp(2rem,4vw,3rem)] font-black tabular-nums tracking-tight text-[color:var(--color-text-primary)] shrink-0 w-24"
                  >
                    {item.metric}
                  </span>
                  <p className="text-sm text-[color:var(--color-text-secondary)] leading-relaxed">
                    {item.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Single featured testimonial ──────────────────────────────── */}
      <section className="px-5 py-16 sm:py-24 bg-[color:var(--color-surface-sunken)] border-b border-[color:var(--color-border)]">
        <div className="mx-auto max-w-6xl reveal">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-10 lg:gap-20 items-start">
            {/* Left: store owners label + attribution */}
            <div className="pt-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--color-text-secondary)] mb-6">
                From store owners
              </p>
              <div className="space-y-5">
                {[
                  { name: "Sara M.", role: "Owner, apparel brand" },
                  { name: "Dmitri V.", role: "Marketing lead, home goods" },
                  { name: "Priya K.", role: "Founder, skincare brand" },
                ].map((person, i) => (
                  <div key={person.name} className="flex items-center gap-3 cursor-pointer group" data-testimonial={i}>
                    <div
                      className="h-8 w-8 rounded-full border border-[color:var(--color-border)] flex items-center justify-center shrink-0 transition-colors duration-200 group-hover:border-[color:var(--color-primary)]"
                      style={{ background: ["#a78bfa20", "#34d39920", "#fb923c20"][i] }}
                    >
                      <span className="text-[11px] font-semibold text-[color:var(--color-text-secondary)]">
                        {person.name[0]}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[color:var(--color-text-primary)]">{person.name}</p>
                      <p className="text-[11px] text-[color:var(--color-text-secondary)]">{person.role}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: large pull-quote */}
            <figure className="relative">
              <div className="pull-quote-mark absolute -top-4 -left-2" aria-hidden="true">&ldquo;</div>
              <blockquote className="relative z-10 pl-4">
                <p
                  className="font-display text-[clamp(1.4rem,3vw,2.1rem)] font-black uppercase leading-[1.1] tracking-tight text-[color:var(--color-text-primary)] mb-5"
                  style={{ textWrap: "balance" } as React.CSSProperties}
                >
                  We went from converting 2.1% of visitors to 5.8% in three weeks. The popup just kept improving on its own.
                </p>
                <p className="text-sm text-[color:var(--color-text-secondary)] leading-relaxed mb-6 max-w-prose">
                  Set it up in under 5 minutes. Didn&apos;t touch it for a month. Sales from returning customers were up 31% compared to before. The brand-match is genuinely impressive.
                </p>
                <div className="flex gap-0.5" aria-label="5 stars">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg key={i} aria-hidden width="14" height="14" viewBox="0 0 12 12" fill="#165DFF">
                      <path d="M6 1l1.24 2.51L10 3.93l-2 1.95.47 2.75L6 7.27 3.53 8.63 4 5.88 2 3.93l2.76-.42L6 1z" />
                    </svg>
                  ))}
                </div>
              </blockquote>
            </figure>
          </div>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────────── */}
      <section id="pricing" className="px-5 py-16 sm:py-24 bg-[color:var(--color-surface)] border-b border-[color:var(--color-border)]">
        <div className="mx-auto max-w-5xl">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--color-primary)] reveal">
            Pricing
          </p>
          <h2
            className="font-display mb-3 text-[clamp(2rem,4vw,3rem)] font-black uppercase tracking-tight text-[color:var(--color-text-primary)] reveal"
            style={{ textWrap: "balance" } as React.CSSProperties}
          >
            Start free. Upgrade when you outgrow it.
          </h2>
          <p className="text-sm text-[color:var(--color-text-secondary)] mb-10 sm:mb-14 max-w-xs reveal">
            The free plan doesn&apos;t expire. No credit card, no trial clock.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-2xl reveal-stagger">
            {/* Starter */}
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-8 flex flex-col">
              <div className="mb-7">
                <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-text-secondary)] mb-3">
                  Starter
                </p>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-display text-5xl font-black tracking-tight text-[color:var(--color-text-primary)] tabular-nums">
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

            {/* Growth */}
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
                    <span className="font-display text-5xl font-black tracking-tight text-[color:var(--color-text-primary)] tabular-nums">
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
                    "Knockout A/B testing",
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

      {/* ── Final CTA — dark ─────────────────────────────────────────── */}
      <section className="hero-dark px-5 py-16 sm:py-24">
        <div className="mx-auto max-w-4xl text-center reveal">
          <h2
            className="font-display mb-4 text-[clamp(2.5rem,6vw,4.5rem)] font-black uppercase leading-[0.95] tracking-tight text-[color:var(--color-hero-text)]"
            style={{ textWrap: "balance" } as React.CSSProperties}
          >
            Your next{" "}
            <span className="text-[color:var(--color-primary)]">+23%</span>
            {" "}is 60 seconds away.
          </h2>
          <p className="mb-8 text-sm text-[color:var(--color-hero-muted)] max-w-sm mx-auto">
            Paste your store URL. We&apos;ll show you a popup built to convert before you create an account.
          </p>
          <HomepageForm dark />
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

      <ScrollReveal />
    </div>
  );
}

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
