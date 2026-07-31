import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth-adapter";
import { HomepageForm } from "@/components/ui/HomepageForm";
import { PopupPreview } from "@/components/ui/PopupPreview";
import { KnockoutBracketPreview } from "@/components/ui/KnockoutBracketPreview";

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

export default async function NewLandingPage() {
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
            className="h-8 w-auto"
          />
          <nav className="hidden items-center gap-6 text-sm font-medium text-[color:var(--color-text-secondary)] sm:flex">
            <Link href="#how-it-works" className="transition-colors duration-200 hover:text-[color:var(--color-text-primary)]">
              How it works
            </Link>
            <Link href="/pricing" className="transition-colors duration-200 hover:text-[color:var(--color-text-primary)]">
              Pricing
            </Link>
          </nav>
          <div className="flex items-center gap-3 text-sm font-medium">
            <Link href="/sign-in" className="hidden text-[color:var(--color-text-secondary)] transition-colors duration-200 hover:text-[color:var(--color-text-primary)] sm:block">
              Log in
            </Link>
            <Link href="/sign-up" className="rounded-lg bg-[color:var(--color-primary)] px-4 py-2 text-white transition-[background-color,transform] duration-200 hover:bg-[color:var(--color-primary-dark)] active:scale-[0.97]">
              Get started free
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative px-5 pt-14 pb-20 sm:pt-20 sm:pb-28 overflow-hidden bg-[color:var(--color-surface)]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 60% at 65% 50%, oklch(35% 0.16 258 / 0.06) 0%, transparent 70%)",
          }}
        />

        <div className="relative mx-auto max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* Left: copy + form */}
            <div>
              <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--color-primary)] animate-page-enter">
                For Shopify stores
              </p>

              <h1
                className="font-display mb-5 text-[clamp(2.8rem,6.5vw,5rem)] leading-[0.93] font-black tracking-tight text-[color:var(--color-text-primary)] uppercase animate-page-enter-delay-1"
                style={{ textWrap: "balance" } as React.CSSProperties}
              >
                Turn visitors into buyers.
                <br />
                <span className="text-[color:var(--color-primary)]">Automatically.</span>
              </h1>

              <p
                className="mb-7 text-base sm:text-lg text-[color:var(--color-text-secondary)] leading-relaxed max-w-[460px] animate-page-enter-delay-2"
                style={{ textWrap: "pretty" } as React.CSSProperties}
              >
                Paste your store URL. Asmos reads your brand, builds a branded popup, and keeps testing until it converts as well as it can — all on its own.
              </p>

              <div className="animate-page-enter-delay-2">
                <HomepageForm />
              </div>

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
                      className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[color:var(--color-surface)] text-[10px] font-bold text-white"
                      style={{ background: a.bg }}
                    >
                      {a.l}
                    </span>
                  ))}
                </div>
                <p className="text-sm text-[color:var(--color-text-secondary)]">
                  <span className="font-semibold text-[color:var(--color-text-primary)]">1,800+ stores</span>{" "}
                  growing with Asmos
                </p>
              </div>
            </div>

            {/* Right: popup preview */}
            <div className="flex justify-center lg:justify-end animate-page-enter-delay-2 mt-10 lg:mt-0">
              <PopupPreview />
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats bar ───────────────────────────────────────────────── */}
      <div className="border-y border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)]">
        <div className="mx-auto max-w-6xl px-5 py-5 reveal-stagger">
          <dl className="grid grid-cols-2 sm:flex sm:flex-row items-center justify-center gap-5 sm:gap-12">
            {[
              { value: "4.2M+", label: "popups delivered" },
              { value: "1,800+", label: "stores growing" },
              { value: "+23%", label: "avg. revenue lift" },
              { value: "~60s", label: "to first live popup" },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col items-center gap-0.5 text-center">
                <dt className="font-display text-xl sm:text-2xl font-black tracking-tight text-[color:var(--color-text-primary)] tabular-nums">
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
      <section id="how-it-works" className="px-5 py-16 sm:py-24 bg-[color:var(--color-surface)] border-b border-[color:var(--color-border)]">
        <div className="mx-auto max-w-6xl">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--color-primary)] reveal">
            How it works
          </p>
          <h2
            className="font-display mb-3 text-[clamp(1.8rem,3.5vw,2.8rem)] font-black uppercase tracking-tight text-[color:var(--color-text-primary)] reveal"
            style={{ textWrap: "balance" } as React.CSSProperties}
          >
            More sales from traffic you already have.
          </h2>
          <p className="text-sm text-[color:var(--color-text-secondary)] mb-12 sm:mb-16 max-w-sm reveal">
            No templates. No designer. Just paste your URL.
          </p>

          <div className="relative reveal-stagger">
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
                  body: "We read your brand colors, tone, and offers in under 10 seconds. No account needed.",
                  callout: "Brand-matched in seconds",
                },
                {
                  n: "02",
                  title: "Get a popup built for your store",
                  body: "Asmos builds a popup that matches your brand and offer. You see a live preview before signing up.",
                  callout: "Live preview, no signup required",
                },
                {
                  n: "03",
                  title: "It keeps getting better on its own",
                  body: "Once live, Asmos tests multiple versions and sends more traffic to whichever one is converting best. No manual work.",
                  callout: "No A/B setup needed",
                },
              ].map((item) => (
                <div key={item.n} className="flex flex-col gap-4">
                  <span className="font-display text-[2.5rem] font-black tabular-nums leading-none tracking-tight text-[color:var(--color-primary)] opacity-90 md:mb-3">
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
                  <div className="flex items-center gap-2 pt-1">
                    <Check />
                    <span className="text-xs font-medium text-[color:var(--color-text-secondary)]">{item.callout}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Results ─────────────────────────────────────────────────── */}
      <section className="px-5 py-16 sm:py-24 bg-[color:var(--color-surface-sunken)] border-b border-[color:var(--color-border)]">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <div className="reveal">
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--color-text-secondary)]">
                Results
              </p>
              <h2
                className="font-display mb-4 text-[clamp(1.8rem,3.5vw,2.8rem)] font-black uppercase leading-[1.0] tracking-tight text-[color:var(--color-text-primary)]"
                style={{ textWrap: "balance" } as React.CSSProperties}
              >
                Most stores convert 1–2% of visitors. The rest leave and never come back.
              </h2>
              <p
                className="mb-8 text-sm text-[color:var(--color-text-secondary)] leading-relaxed max-w-sm"
                style={{ textWrap: "pretty" } as React.CSSProperties}
              >
                Asmos captures those visitors before they go — then keeps testing which offer and timing drives the most sales, automatically shifting to the winner. No spreadsheets, no guessing.
              </p>
              <ul className="space-y-3">
                {[
                  "Captures visitors who would have left empty-handed",
                  "Adapts to device, time of day, and traffic source",
                  "Stops wasting impressions on weak variants early",
                  "Full history of every test — see exactly what worked",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-[color:var(--color-text-secondary)]">
                    <Check />
                    <span style={{ textWrap: "pretty" } as React.CSSProperties}>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <Link
                  href="/sign-up"
                  className="inline-flex items-center gap-2 rounded-lg bg-[color:var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-[color:var(--color-primary-dark)] active:scale-[0.97]"
                >
                  Start converting more visitors
                  <svg aria-hidden width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3 7h8m0 0L7.5 3.5M11 7L7.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
                <p className="mt-2.5 text-xs text-[color:var(--color-text-secondary)]">Free to start. No credit card.</p>
              </div>
            </div>

            {/* Metric list — editorial style */}
            <div className="space-y-px reveal-stagger">
              {[
                { metric: "+23%", label: "Average revenue lift in the first 30 days" },
                { metric: "8x", label: "More variants tested per campaign vs manual A/B" },
                { metric: "~60s", label: "From store URL to a live branded popup" },
                { metric: "0", label: "Manual tweaks needed. It runs itself." },
              ].map((item) => (
                <div
                  key={item.metric}
                  className="flex items-baseline gap-5 py-5 border-b border-[color:var(--color-border)] last:border-b-0"
                >
                  <span className="font-display text-[clamp(1.8rem,3.5vw,2.6rem)] font-black tabular-nums tracking-tight text-[color:var(--color-text-primary)] shrink-0 w-20">
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

      {/* ── Knockout — the differentiator, explained plainly ─────────── */}
      <section className="px-5 py-16 sm:py-24 bg-[color:var(--color-surface)] border-b border-[color:var(--color-border)] overflow-hidden">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-12 items-center">
            <div className="reveal">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--color-primary)]">
                How the testing works
              </p>
              <h2
                className="font-display mb-5 text-[clamp(1.8rem,3.5vw,2.8rem)] font-black uppercase leading-[1.0] tracking-tight text-[color:var(--color-text-primary)]"
                style={{ textWrap: "balance" } as React.CSSProperties}
              >
                Other tools run all variants equally.
                <br />
                <span className="text-[color:var(--color-primary)]">Asmos cuts the losers and doubles down on what works.</span>
              </h2>
              <p
                className="mb-6 text-base text-[color:var(--color-text-secondary)] leading-relaxed max-w-[420px]"
                style={{ textWrap: "pretty" } as React.CSSProperties}
              >
                Standard A/B testing splits traffic 50/50 and waits weeks. Asmos runs a tournament: variants compete in real time, underperformers lose traffic, the winner gets everything. More conversions from day one, not just at the end.
              </p>
              <ul className="space-y-3">
                {[
                  "Up to 8 popup variants per campaign",
                  "Traffic shifts toward the winner automatically",
                  "No manual winner declarations",
                  "Full bracket history showing why each variant won or lost",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-[color:var(--color-text-secondary)]">
                    <Check />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex justify-center reveal-eager">
              <KnockoutBracketPreview animated />
            </div>
          </div>
        </div>
      </section>

      {/* ── Testimonials ────────────────────────────────────────────── */}
      <section className="px-5 py-16 sm:py-24 bg-[color:var(--color-surface-sunken)] border-b border-[color:var(--color-border)]">
        <div className="mx-auto max-w-6xl">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--color-text-secondary)] text-center reveal">
            From store owners
          </p>
          <h2
            className="font-display mb-10 sm:mb-14 text-[clamp(1.8rem,3.5vw,2.8rem)] font-black uppercase tracking-tight text-[color:var(--color-text-primary)] text-center reveal"
            style={{ textWrap: "balance" } as React.CSSProperties}
          >
            Stores that stopped leaving money on the table.
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 reveal-stagger">
            {[
              {
                quote: "We went from 2.1% to 5.8% conversion in three weeks. The popup just kept improving on its own.",
                name: "Sara M.",
                role: "Owner, apparel brand",
                initial: "S",
                color: "#a78bfa",
              },
              {
                quote: "Set it up in 5 minutes. Didn't touch it for a month. Sales from returning customers were up 31%.",
                name: "Dmitri V.",
                role: "Marketing lead, home goods store",
                initial: "D",
                color: "#34d399",
              },
              {
                quote: "The brand match is genuinely impressive. First popup looked like we designed it — and it converted on day one.",
                name: "Priya K.",
                role: "Founder, skincare brand",
                initial: "P",
                color: "#fb923c",
              },
            ].map((t) => (
              <figure
                key={t.name}
                className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-7 flex flex-col gap-5"
              >
                <div className="flex gap-0.5" aria-label="5 stars">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg key={i} aria-hidden width="12" height="12" viewBox="0 0 12 12" fill="#165DFF">
                      <path d="M6 1l1.24 2.51L10 3.93l-2 1.95.47 2.75L6 7.27 3.53 8.63 4 5.88 2 3.93l2.76-.42L6 1z" />
                    </svg>
                  ))}
                </div>
                <blockquote>
                  <p
                    className="text-sm text-[color:var(--color-text-primary)] leading-relaxed"
                    style={{ textWrap: "pretty" } as React.CSSProperties}
                  >
                    &ldquo;{t.quote}&rdquo;
                  </p>
                </blockquote>
                <figcaption className="mt-auto flex items-center gap-3">
                  <div
                    className="h-8 w-8 rounded-full border border-[color:var(--color-border)] flex items-center justify-center shrink-0"
                    style={{ background: t.color + "22" }}
                  >
                    <span className="text-[11px] font-semibold" style={{ color: t.color }}>{t.initial}</span>
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
      <section id="pricing" className="px-5 py-16 sm:py-24 bg-[color:var(--color-surface)] border-b border-[color:var(--color-border)]">
        <div className="mx-auto max-w-5xl">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--color-primary)] reveal">
            Pricing
          </p>
          <h2
            className="font-display mb-3 text-[clamp(1.8rem,3.5vw,2.8rem)] font-black uppercase tracking-tight text-[color:var(--color-text-primary)] reveal"
            style={{ textWrap: "balance" } as React.CSSProperties}
          >
            Start free. Upgrade when you&apos;re ready.
          </h2>
          <p className="text-sm text-[color:var(--color-text-secondary)] mb-10 sm:mb-14 max-w-xs reveal">
            Free plan doesn&apos;t expire. No credit card, no trial clock.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-2xl reveal-stagger">
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-8 flex flex-col">
              <div className="mb-7">
                <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-text-secondary)] mb-3">Starter</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-display text-5xl font-black tracking-tight text-[color:var(--color-text-primary)] tabular-nums">Free</span>
                </div>
                <p className="mt-1.5 text-xs text-[color:var(--color-text-secondary)]">No credit card required</p>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {["Up to 1,000 impressions / month", "1 active campaign", "AI brand analysis", "AI-generated popup"].map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-[color:var(--color-text-secondary)]"><Check />{f}</li>
                ))}
              </ul>
              <Link href="/sign-up" className="block w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2.5 text-center text-sm font-semibold text-[color:var(--color-text-primary)] transition-[background-color,transform] duration-200 hover:bg-[color:var(--color-surface-sunken)] active:scale-[0.97]">
                Get started free
              </Link>
              <p className="mt-2.5 text-center text-xs text-[color:var(--color-text-secondary)]">No expiry on the free plan</p>
            </div>

            <div className="rounded-[1.375rem] border border-[color:var(--color-primary)]/30 bg-[color:var(--color-primary-light)] p-1.5 shadow-lg">
              <div className="flex flex-col rounded-[1rem] bg-[color:var(--color-surface)] p-7 h-full" style={{ boxShadow: "inset 0 1px 1px rgba(255,255,255,0.95)" }}>
                <div className="mb-7">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-primary)]">Growth</p>
                    <span className="rounded-full bg-[color:var(--color-primary)] px-2.5 py-0.5 text-[10px] font-semibold text-white">Most popular</span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-display text-5xl font-black tracking-tight text-[color:var(--color-text-primary)] tabular-nums">$29</span>
                    <span className="text-sm text-[color:var(--color-text-secondary)]">/ mo</span>
                  </div>
                  <p className="mt-1.5 text-xs text-[color:var(--color-text-secondary)]">Cancel anytime. No contracts.</p>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {["Unlimited impressions", "Unlimited campaigns", "AI optimization, always on", "Knockout A/B testing", "Analytics dashboard", "Priority support"].map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-[color:var(--color-text-secondary)]"><Check />{f}</li>
                  ))}
                </ul>
                <Link href="/sign-up" className="block w-full rounded-lg bg-[color:var(--color-primary)] px-4 py-2.5 text-center text-sm font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-[color:var(--color-primary-dark)] active:scale-[0.97]">
                  Start 14-day free trial
                </Link>
                <p className="mt-2.5 text-center text-xs text-[color:var(--color-text-secondary)]">No credit card needed to start</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────── */}
      <section className="px-5 py-16 sm:py-24 bg-[color:var(--color-surface-sunken)] border-b border-[color:var(--color-border)]">
        <div className="mx-auto max-w-2xl text-center reveal">
          <h2
            className="font-display mb-4 text-[clamp(2.2rem,5vw,4rem)] font-black uppercase leading-[0.95] tracking-tight text-[color:var(--color-text-primary)]"
            style={{ textWrap: "balance" } as React.CSSProperties}
          >
            See how much your store could be making.
          </h2>
          <p className="mb-8 text-sm text-[color:var(--color-text-secondary)] max-w-sm mx-auto">
            Paste your store URL. We&apos;ll show you a popup built for your brand — before you create an account.
          </p>
          <HomepageForm />
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="border-t border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] px-5 py-8">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[color:var(--color-text-secondary)]">
          <div className="flex items-center gap-3">
            <Image src="/assets/asmos-logo-primary-lightbg.webp" alt="Asmos" width={72} height={18} className="h-4 w-auto opacity-60" />
            <span>&copy; 2026 Asmos</span>
          </div>
          <nav className="flex items-center gap-5">
            <Link href="/pricing" className="transition-colors duration-200 hover:text-[color:var(--color-text-primary)]">Pricing</Link>
            <Link href="/privacy" className="transition-colors duration-200 hover:text-[color:var(--color-text-primary)]">Privacy</Link>
            <Link href="/terms" className="transition-colors duration-200 hover:text-[color:var(--color-text-primary)]">Terms</Link>
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
  var els=document.querySelectorAll('.reveal,.reveal-eager,.reveal-stagger');
  var io=new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(e.isIntersecting){e.target.classList.add('is-visible');io.unobserve(e.target);}
    });
  },{threshold:0.06,rootMargin:'0px 0px 60px 0px'});
  els.forEach(function(el){io.observe(el);});
})();
        `,
      }}
    />
  );
}
