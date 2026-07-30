import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { HomepageForm } from "@/components/ui/HomepageForm";

export default async function LandingPage() {
  const { userId } = await auth();
  if (userId) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[color:var(--color-surface)]">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-[color:var(--color-border)] bg-[color:var(--color-surface)]/90 px-6 py-3.5 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Image
            src="/assets/asmos-logo-primary-lightbg.webp"
            alt="Asmos"
            width={110}
            height={28}
            priority
            className="h-7 w-auto"
          />
          <nav className="hidden items-center gap-5 text-sm font-medium text-[color:var(--color-text-secondary)] sm:flex">
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
              className="hidden text-[color:var(--color-text-secondary)] transition-colors duration-200 hover:text-[color:var(--color-text-primary)] sm:block px-3 py-1.5"
            >
              Log in
            </Link>
            <Link
              href="/sign-up"
              className="rounded-lg bg-[color:var(--color-primary)] px-4 py-2 text-white transition-[background-color,transform] duration-200 hover:bg-[color:var(--color-primary-dark)] active:scale-[0.97]"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="relative flex flex-col items-center justify-center px-4 sm:px-6 py-24 text-center">
        {/* Ambient glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{
            background:
              "radial-gradient(ellipse 70% 55% at 50% 0%, rgba(22,93,255,0.07) 0%, transparent 68%)",
          }}
        />

        <div className="relative w-full max-w-2xl">
          {/* Eyebrow pill */}
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3.5 py-1.5 text-xs font-medium text-[color:var(--color-text-secondary)] shadow-sm animate-page-enter">
            <span
              className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-success)]"
              aria-hidden="true"
            />
            AI-powered popup optimization
          </div>

          <h1
            className="mb-5 text-[2.75rem] leading-[1.08] font-bold tracking-[-0.025em] text-[color:var(--color-text-primary)] md:text-5xl animate-page-enter-delay-1"
            style={{ textWrap: "balance" } as React.CSSProperties}
          >
            See the popup Asmos would build for your store.
          </h1>

          <p
            className="mb-10 text-lg text-[color:var(--color-text-secondary)] leading-relaxed max-w-lg mx-auto animate-page-enter-delay-2"
            style={{ textWrap: "pretty" } as React.CSSProperties}
          >
            Paste your Shopify store URL. Asmos will analyze your brand and
            create a conversion-ready popup.
          </p>

          <div className="animate-page-enter-delay-2">
            <HomepageForm />
          </div>

          <p className="mt-5 text-xs text-[color:var(--color-text-secondary)] animate-page-enter-delay-3">
            Takes approximately 60 seconds.
          </p>
        </div>
      </section>

      {/* ── Trust strip ─────────────────────────────────────────────────── */}
      <div className="border-y border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] px-4 sm:px-6 py-3.5">
        <p className="text-center text-xs text-[color:var(--color-text-secondary)] font-medium tracking-wide">
          No credit card required &nbsp;&middot;&nbsp; Free to start
          &nbsp;&middot;&nbsp; 2-minute setup
        </p>
      </div>

      {/* ── How it works ────────────────────────────────────────────────── */}
      <section className="px-4 sm:px-6 py-24 bg-[color:var(--color-surface)]">
        <div className="max-w-3xl mx-auto">
          <div className="mb-2 flex justify-center">
            <span className="inline-block rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-text-secondary)]">
              How it works
            </span>
          </div>
          <h2
            className="text-[1.75rem] leading-tight font-bold tracking-tight text-[color:var(--color-text-primary)] text-center mb-14"
            style={{ textWrap: "balance" } as React.CSSProperties}
          >
            Three steps to a smarter popup
          </h2>

          <ol className="space-y-8">
            {[
              {
                n: "1",
                title: "Paste your store URL",
                body: "We analyze your brand colors, style, and existing offers to understand what makes your store unique.",
              },
              {
                n: "2",
                title: "See your popup",
                body: "Asmos generates a popup matched to your brand identity, with copy and design tailored to convert your visitors.",
              },
              {
                n: "3",
                title: "Optimize automatically",
                body: "The AI agent continuously improves your conversion rate by testing variants and learning what works for your audience.",
              },
            ].map((item) => (
              <li
                key={item.n}
                className="flex gap-5 items-start group"
              >
                {/* Double-Bezel step number */}
                <div className="shrink-0 rounded-[0.875rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-1">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-[0.625rem] bg-[color:var(--color-primary-light)] text-sm font-bold text-[color:var(--color-primary)] tabular-nums"
                    style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8)" }}
                  >
                    {item.n}
                  </div>
                </div>
                <div className="pt-1.5">
                  <h3 className="text-base font-semibold text-[color:var(--color-text-primary)] mb-1">
                    {item.title}
                  </h3>
                  <p
                    className="text-sm text-[color:var(--color-text-secondary)] leading-relaxed"
                    style={{ textWrap: "pretty" } as React.CSSProperties}
                  >
                    {item.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────────────── */}
      <section className="px-4 sm:px-6 py-24 bg-[color:var(--color-surface-sunken)] border-t border-[color:var(--color-border)]">
        <div className="max-w-4xl mx-auto">
          <div className="mb-2 flex justify-center">
            <span className="inline-block rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-text-secondary)]">
              Pricing
            </span>
          </div>
          <h2
            className="text-[1.75rem] leading-tight font-bold tracking-tight text-[color:var(--color-text-primary)] text-center mb-3"
            style={{ textWrap: "balance" } as React.CSSProperties}
          >
            Simple pricing
          </h2>
          <p className="text-sm text-[color:var(--color-text-secondary)] text-center mb-12">
            Start free. Upgrade when you grow.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-2xl mx-auto">
            {/* Starter plan */}
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-sm p-8 flex flex-col">
              <div className="mb-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-text-secondary)] mb-2">
                  Starter
                </p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold tracking-tight text-[color:var(--color-text-primary)] tabular-nums">
                    Free
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-[color:var(--color-text-secondary)]">
                  No credit card required
                </p>
              </div>

              <ul className="space-y-2.5 mb-8 flex-1">
                {[
                  "Up to 1,000 impressions / mo",
                  "1 active campaign",
                  "Brand analysis",
                  "AI-generated popup",
                ].map((feature) => (
                  <li
                    key={feature}
                    className="flex items-center gap-2.5 text-sm text-[color:var(--color-text-secondary)]"
                  >
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--color-text-secondary)]"
                      aria-hidden="true"
                    />
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
            </div>

            {/* Growth plan — Double-Bezel featured card */}
            <div className="rounded-[1.375rem] border border-[color:var(--color-primary)]/30 bg-[color:var(--color-primary-light)] p-1.5 shadow-md">
              <div
                className="flex flex-col rounded-[1rem] bg-[color:var(--color-surface)] p-7 h-full"
                style={{ boxShadow: "inset 0 1px 1px rgba(255,255,255,0.95)" }}
              >
                <div className="mb-6">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-primary)] mb-2">
                    Growth
                  </p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold tracking-tight text-[color:var(--color-text-primary)] tabular-nums">
                      $29
                    </span>
                    <span className="text-sm text-[color:var(--color-text-secondary)]">
                      / mo
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-[color:var(--color-text-secondary)]">
                    Cancel anytime
                  </p>
                </div>

                <ul className="space-y-2.5 mb-8 flex-1">
                  {[
                    "Unlimited impressions",
                    "Unlimited campaigns",
                    "AI optimization",
                    "A/B testing",
                    "Analytics dashboard",
                    "Priority support",
                  ].map((feature) => (
                    <li
                      key={feature}
                      className="flex items-center gap-2.5 text-sm text-[color:var(--color-text-secondary)]"
                    >
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--color-primary)]"
                        aria-hidden="true"
                      />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Link
                  href="/sign-up"
                  className="block w-full rounded-lg bg-[color:var(--color-primary)] px-4 py-2.5 text-center text-sm font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-[color:var(--color-primary-dark)] active:scale-[0.97]"
                >
                  Start free trial
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 sm:px-6 py-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[color:var(--color-text-secondary)]">
          <p>&copy; 2026 Asmos</p>
          <nav className="flex items-center gap-5">
            <Link
              href="/pricing"
              className="transition-colors duration-200 hover:text-[color:var(--color-text-primary)]"
            >
              Pricing
            </Link>
            <Link
              href="/privacy"
              className="transition-colors duration-200 hover:text-[color:var(--color-text-primary)]"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="transition-colors duration-200 hover:text-[color:var(--color-text-primary)]"
            >
              Terms
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
