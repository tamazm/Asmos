import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth-adapter";
import { HomepageForm } from "@/components/ui/HomepageForm";
import { KnockoutBracketPreview } from "@/components/ui/KnockoutBracketPreview";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { PricingClient } from "@/components/marketing/PricingClient";
import { StatCounter } from "@/components/marketing/StatCounter";
import {
  IconAnalyze,
  IconGenerate,
  IconLearn,
  IconStore,
  IconExperiment,
  IconTraffic,
  IconAnalytics,
  IconBrain,
  IconIntegrations,
  DecorativeBlob,
} from "@/components/marketing/LandingIllustrations";
import { CTA } from "@/lib/site";
import { buildMetadata } from "@/lib/seo";
import { BLOG_POSTS } from "@/lib/blog/posts";
import { FAQS } from "@/lib/faq";

export const metadata: Metadata = buildMetadata({
  title: "AI Conversion Optimization for Ecommerce",
  description:
    "Asmos analyzes your store, generates conversion experiments, tests variants, learns from visitor behavior, and continuously improves performance.",
  path: "/",
});

function Arrow({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M2 8h11m0 0L9 4m4 4l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const PROBLEM_OLD = ["Build", "Guess", "Test", "Analyze", "Rebuild", "Repeat"];
const PROBLEM_NEW = ["Analyze", "Generate", "Test", "Learn", "Optimize"];

const HOW_STEPS = [
  { icon: IconAnalyze, title: "Analyze your store", body: "Asmos understands your brand, offer, audience, and current conversion setup." },
  { icon: IconGenerate, title: "Generate & test experiences", body: "AI creates popup concepts, launches variants, and reallocates traffic based on real performance." },
  { icon: IconLearn, title: "Learn & improve automatically", body: "Asmos identifies what's working and uses it as the foundation for the next generation of tests." },
];

const FEATURES = [
  { icon: IconStore, title: "AI Store Analysis", body: "Understand brand, offer, audience, and conversion opportunities." },
  { icon: IconExperiment, title: "Autonomous Experimentation", body: "Create and test variants without manually managing every experiment." },
  { icon: IconTraffic, title: "Smart Traffic Allocation", body: "Automatically shift traffic toward stronger performers." },
  { icon: IconAnalytics, title: "Deep Behavioral Analytics", body: "Track clicks, dismissals, form interactions, timing, and conversion behavior." },
  { icon: IconBrain, title: "AI Learnings", body: "Understand what is working and why." },
  { icon: IconIntegrations, title: "Email & SMS Integrations", body: "Connect captured leads directly to Klaviyo, Mailchimp, Omnisend, and other lifecycle tools." },
];

// Real, code-verifiable product facts — not marketing outcomes. See
// lib/limits.ts (MAX_VARIANTS_PER_ROUND.SCALE) and evaluateKnockout.ts
// (ALL_AXES, the Inngest cron trigger) for the source of each number.
const STATS = [
  { value: 5, suffix: "", label: "Test axes evaluated automatically", body: "Trigger, friction, copy, layout, and visual — Asmos isolates one variable at a time." },
  { value: 30, suffix: "", label: "Variants tested per round on Scale", body: "The knockout tournament scales its bracket size with your plan." },
  { value: 24, suffix: "/7", label: "Autonomous evaluation", body: "Traffic reallocates and new variants get generated on a schedule — no manual triggers." },
];

const AI_LEARNINGS = [
  "Shorter headlines are outperforming on mobile.",
  "Email-only forms are completing more often.",
  "Paid social visitors respond better to this offer.",
  "Variant 23 currently has the highest probability of winning.",
];

const INTEGRATIONS = ["Shopify", "Klaviyo", "Mailchimp", "Omnisend", "Zapier"];

function HeroHeadline({ text }: { text: string }) {
  const words = text.split(" ");
  return (
    <h1
      className="mb-5 text-[2.5rem] leading-[1.08] font-semibold tracking-[-0.02em] text-[color:var(--color-text-primary)] sm:text-[3.5rem] lg:text-[4rem]"
      style={{ textWrap: "balance" } as React.CSSProperties}
    >
      {words.map((word, i) => (
        <span key={i} className="hero-word mr-[0.3em] last:mr-0">
          {word}
        </span>
      ))}
    </h1>
  );
}

// Shared section-heading scale — mirrors the reference's restrained type
// system (size carries the hierarchy, weight stays at semibold rather than
// full bold) so every section reads as one consistent family.
function SectionHeading({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <h2
      className={`text-[1.75rem] sm:text-[2.25rem] lg:text-[2.5rem] font-semibold tracking-[-0.02em] text-[color:var(--color-text-primary)] ${className}`}
      style={{ textWrap: "balance" } as React.CSSProperties}
    >
      {children}
    </h2>
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
      <MarketingHeader />

      {/* ── 1. Hero (dark) ──────────────────────────────────────────── */}
      <section className="hero-dark relative px-5 pt-14 pb-16 sm:pt-20 sm:pb-24 overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-grid-faint"
          style={{ maskImage: "radial-gradient(ellipse 70% 60% at 50% 0%, black 0%, transparent 75%)", WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 0%, black 0%, transparent 75%)" }}
        />
        {/* Floating decorative blobs — pure CSS/SVG, brand blue, very low opacity */}
        <div aria-hidden="true" className="popup-float pointer-events-none absolute -left-16 top-10 h-64 w-64 text-[color:var(--color-primary)] opacity-[0.14]">
          <DecorativeBlob />
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 top-1/3 h-72 w-72 text-[color:var(--color-primary)] opacity-[0.10]" style={{ animation: "floatY 8s ease-in-out infinite 1.2s" }}>
          <DecorativeBlob />
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse 80% 50% at 50% -10%, oklch(48% 0.255 258 / 0.22) 0%, transparent 65%)" }}
        />
        <div className="relative mx-auto max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-12 lg:gap-10 items-center">
            {/* Left: copy + CTAs */}
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3.5 py-1.5 text-xs font-medium text-[color:var(--color-text-secondary)] shadow-sm animate-page-enter">
                <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-primary)] shrink-0" aria-hidden="true" />
                Autonomous conversion optimization for ecommerce
              </div>

              <HeroHeadline text="AI that continuously improves your ecommerce conversions." />

              <p
                className="mb-8 max-w-xl text-base sm:text-lg text-[color:var(--color-text-secondary)] leading-relaxed animate-page-enter-delay-2"
                style={{ textWrap: "pretty" } as React.CSSProperties}
              >
                Asmos analyzes your store, generates conversion experiments, tests variants, learns from visitor behavior, and continuously improves performance.
              </p>

              <div className="flex flex-wrap items-center gap-4 animate-page-enter-delay-2">
                <Link
                  href={CTA.primary.href}
                  className="btn-wipe rounded-full bg-[color:var(--color-primary)] px-6 py-3 text-sm font-semibold text-white transition-transform duration-200 active:scale-[0.97]"
                >
                  {CTA.primary.label}
                </Link>
                <Link
                  href={CTA.secondary.href}
                  className="rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-6 py-3 text-sm font-semibold text-[color:var(--color-text-primary)] transition-[background-color,transform] duration-200 hover:bg-[color:var(--color-surface-sunken)] active:scale-[0.97]"
                >
                  {CTA.secondary.label}
                </Link>
                <Link
                  href={CTA.tertiary.href}
                  className="text-sm font-medium text-[color:var(--color-text-secondary)] underline decoration-[color:var(--color-border)] underline-offset-4 transition-colors duration-200 hover:text-[color:var(--color-primary)]"
                >
                  {CTA.tertiary.label}
                </Link>
              </div>
            </div>

            {/* Right: live knockout-bracket demo — this IS the product.
                Glass-panel treatment reads as an elevated floating surface
                against the dark hero, rather than a flat card. */}
            <div className="flex flex-col items-center gap-3 animate-page-enter-delay-3">
              <div className="glass-panel hover-float w-full max-w-[400px] rounded-[1.75rem] p-2 shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
                {/* Browser chrome */}
                <div className="flex items-center gap-3 px-3 pb-2.5 pt-1.5">
                  <div className="flex items-center gap-1.5" aria-hidden="true">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                  </div>
                  <div className="flex-1 truncate rounded-full bg-[color:var(--color-surface-sunken)] px-3 py-1 text-center text-[10px] font-medium text-[color:var(--color-text-secondary)]">
                    asmos.io/campaigns/summer-sale
                  </div>
                </div>
                {/* Stage */}
                <div className="rounded-[1.35rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-3.5">
                  <div className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--color-text-secondary)]">
                    <span>Store</span>
                    <Arrow className="h-2.5 w-2.5 text-[color:var(--color-border)]" />
                    <span>Analyze</span>
                    <Arrow className="h-2.5 w-2.5 text-[color:var(--color-border)]" />
                    <span className="text-[color:var(--color-primary)]">Generate</span>
                  </div>
                  <KnockoutBracketPreview animated embedded variant="dark" />
                </div>
              </div>
              <p className="max-w-[300px] text-center text-[11px] leading-relaxed text-[color:var(--color-text-secondary)]">
                Four popup variants enter. Asmos shifts traffic toward the strongest performer in real time and eliminates the rest — this is what &ldquo;Test&rdquo; means at Asmos.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. Social proof ─────────────────────────────────────────── */}
      <section className="border-y border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] px-5 py-8">
        <div className="mx-auto max-w-6xl text-center reveal">
          <p className="text-sm font-medium text-[color:var(--color-text-secondary)]">
            Built for ecommerce teams focused on measurable growth.
          </p>
        </div>
      </section>

      {/* ── 3. Problem ──────────────────────────────────────────────── */}
      <section className="px-5 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <SectionHeading className="mb-10 sm:mb-14 text-center reveal">
            Conversion optimization is still too manual.
          </SectionHeading>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 reveal-stagger">
            <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-7">
              <p className="mb-5 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-text-secondary)]">The old way</p>
              <div className="flex flex-wrap items-center gap-2">
                {PROBLEM_OLD.map((step, i) => (
                  <span key={step} className="flex items-center gap-2">
                    <span className="rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[color:var(--color-text-secondary)]">
                      {step}
                    </span>
                    {i < PROBLEM_OLD.length - 1 && <Arrow className="h-3 w-3 text-[color:var(--color-border)]" />}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-[color:var(--color-primary)]/25 bg-[color:var(--color-primary-light)] p-7">
              <p className="mb-5 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-primary)]">With Asmos</p>
              <div className="flex flex-wrap items-center gap-2">
                {PROBLEM_NEW.map((step, i) => (
                  <span key={step} className="flex items-center gap-2">
                    <span className="rounded-full bg-[color:var(--color-primary)] px-3 py-1.5 text-xs font-medium text-white">
                      {step}
                    </span>
                    {i < PROBLEM_NEW.length - 1 && <Arrow className="h-3 w-3 text-[color:var(--color-primary)]/50" />}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. How Asmos Works ──────────────────────────────────────── */}
      <section className="px-5 py-16 sm:py-20 bg-[color:var(--color-surface-sunken)] border-y border-[color:var(--color-border)]">
        <div className="mx-auto max-w-6xl">
          <SectionHeading className="mb-12 text-center reveal">
            How Asmos works
          </SectionHeading>
          <div className="steps-rail grid grid-cols-1 md:grid-cols-3 gap-6 reveal-stagger mb-10">
            {HOW_STEPS.map((s) => (
              <div key={s.title} className="hover-float relative rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-[color:var(--color-primary-light)] text-[color:var(--color-primary)]">
                  <s.icon className="h-6 w-6" />
                </div>
                <h3 className="mb-1.5 text-sm font-semibold text-[color:var(--color-text-primary)]">{s.title}</h3>
                <p className="text-xs text-[color:var(--color-text-secondary)] leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
          <div className="text-center">
            <Link href={CTA.primary.href} className="btn-wipe inline-flex items-center gap-2 rounded-full bg-[color:var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white transition-transform duration-200 active:scale-[0.97]">
              {CTA.primary.label} <Arrow className="h-3.5 w-3.5 text-white/80" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── 5. Autonomous optimization ──────────────────────────────── */}
      <section className="px-5 py-16 sm:py-20 overflow-hidden">
        <div className="mx-auto max-w-2xl text-center reveal">
          <SectionHeading className="mb-4">
            Let the strongest experience win.
          </SectionHeading>
          <p className="mb-6 text-sm text-[color:var(--color-text-secondary)] leading-relaxed max-w-md mx-auto">
            The knockout tournament shown at the top of this page is exactly what happens inside every live campaign: Asmos continuously evaluates performance, reduces exposure to weaker experiences, and gives stronger variants more opportunity to convert.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {["Many variants", "Stronger variants remain", "Traffic concentrates", "Winner emerges", "New generation begins"].map((s, i, arr) => (
              <span key={s} className="flex items-center gap-2">
                <span className="rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[color:var(--color-text-secondary)]">{s}</span>
                {i < arr.length - 1 && <Arrow className="h-3 w-3 text-[color:var(--color-border)]" />}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. Core product features ────────────────────────────────── */}
      <section className="px-5 py-16 sm:py-20 bg-[color:var(--color-surface-sunken)] border-y border-[color:var(--color-border)]">
        <div className="mx-auto max-w-6xl">
          <SectionHeading className="mb-12 text-center reveal">
            Everything you need to optimize conversion, automatically
          </SectionHeading>
          {/* Bento layout: the lead feature spans two columns as a wider
              highlight tile, the rest sit in uniform 1x1 cells around it. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 reveal-stagger">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                className={`hover-float rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 ${
                  i === 0 ? "sm:col-span-2 lg:col-span-2 flex flex-col justify-center sm:flex-row sm:items-center sm:gap-5" : ""
                }`}
              >
                <div className="mb-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[color:var(--color-primary-light)] text-[color:var(--color-primary)] sm:mb-0">
                  <f.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="mb-1.5 text-sm font-semibold text-[color:var(--color-text-primary)]">{f.title}</h3>
                  <p className="text-xs text-[color:var(--color-text-secondary)] leading-relaxed">{f.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 7. By the numbers ───────────────────────────────────────── */}
      <section className="px-5 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <SectionHeading className="mb-12 text-center reveal">
            How the testing engine actually works
          </SectionHeading>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 reveal-stagger">
            {STATS.map((stat) => (
              <div key={stat.label} className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-7 text-center">
                <p className="text-4xl sm:text-5xl font-semibold tracking-[-0.02em] text-[color:var(--color-primary)]">
                  <StatCounter value={stat.value} suffix={stat.suffix} />
                </p>
                <p className="mt-3 text-sm font-semibold text-[color:var(--color-text-primary)]">{stat.label}</p>
                <p className="mt-1.5 text-xs text-[color:var(--color-text-secondary)] leading-relaxed">{stat.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 8. AI Learnings ──────────────────────────────────────────── */}
      <section className="px-5 py-16 sm:py-20 bg-[color:var(--color-surface-sunken)] border-y border-[color:var(--color-border)]">
        <div className="mx-auto max-w-6xl">
          <SectionHeading className="mb-10 text-center reveal">
            Asmos doesn&apos;t just find winners. It learns why they win.
          </SectionHeading>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 reveal-stagger max-w-3xl mx-auto">
            {AI_LEARNINGS.map((insight) => (
              <div key={insight} className="flex items-start gap-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-primary-light)] text-[color:var(--color-primary)] text-[10px] font-bold">AI</div>
                <p className="text-sm text-[color:var(--color-text-secondary)] leading-relaxed">{insight}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-[11px] text-[color:var(--color-text-secondary)]">Example insights — actual learnings are generated from your store&apos;s data.</p>
        </div>
      </section>

      {/* ── 9. Free Optimization Analysis (soft offramp before pricing) ── */}
      <section className="px-5 py-16 sm:py-20">
        <div className="mx-auto max-w-3xl text-center reveal">
          <span className="mb-4 inline-block rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-text-secondary)]">
            Free Tool
          </span>
          <SectionHeading className="mb-3">
            Not ready to start? Analyze your store first.
          </SectionHeading>
          <p className="mb-6 text-sm text-[color:var(--color-text-secondary)] max-w-md mx-auto">
            Paste your store URL and get a limited conversion analysis with actionable optimization opportunities — no account required.
          </p>
          <HomepageForm />
          <p className="mt-4 text-xs text-[color:var(--color-text-secondary)]">
            Also want to model the revenue impact? Try the{" "}
            <Link href="/tools/email-capture-calculator" className="text-[color:var(--color-primary)] underline underline-offset-2">Email Capture Revenue Calculator</Link>.
          </p>
        </div>
      </section>

      {/* ── 10. Pricing ──────────────────────────────────────────────── */}
      <section id="pricing" className="px-5 py-16 sm:py-20 bg-[color:var(--color-surface-sunken)] border-y border-[color:var(--color-border)]">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center reveal mb-10">
            <SectionHeading className="mb-3">
              Flexible pricing built around your traffic.
            </SectionHeading>
            <p className="text-sm text-[color:var(--color-text-secondary)]">
              Every plan includes the full Asmos platform. Pricing scales with your traffic and level of support — not locked features.
            </p>
          </div>
          <PricingClient />
          <div className="mt-4 text-center">
            <Link href="/pricing" className="text-sm font-medium text-[color:var(--color-primary)] underline underline-offset-4">
              Compare all plans in detail
            </Link>
          </div>
        </div>
      </section>

      {/* ── 11. Managed Success ──────────────────────────────────────── */}
      <section id="managed-success" className="px-5 py-16 sm:py-20">
        <div className="mx-auto max-w-2xl text-center reveal">
          <SectionHeading className="mb-3">
            Prefer a hands-on experience?
          </SectionHeading>
          <p className="mb-7 text-sm text-[color:var(--color-text-secondary)] max-w-md mx-auto">
            Add Managed Success for white-glove onboarding, hands-on optimization support, and a dedicated Customer Success Manager.
          </p>
          <Link href="/why-asmos#managed-success" className="inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-5 py-2.5 text-sm font-semibold text-[color:var(--color-text-primary)] transition-[background-color,transform] duration-200 hover:bg-[color:var(--color-surface-sunken)] active:scale-[0.97]">
            Learn About Managed Success <Arrow className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>

      {/* ── 12. FAQ ──────────────────────────────────────────────────── */}
      <section className="px-5 py-16 sm:py-20 bg-[color:var(--color-surface-sunken)] border-y border-[color:var(--color-border)]">
        <div className="mx-auto max-w-2xl">
          <SectionHeading className="mb-8 text-center reveal">
            Frequently asked questions
          </SectionHeading>
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

      {/* ── 13. Blog / resources preview ─────────────────────────────── */}
      <section className="px-5 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 flex items-end justify-between reveal">
            <SectionHeading>From the blog</SectionHeading>
            <Link href="/blog" className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium text-[color:var(--color-primary)]">
              Explore Resources <Arrow className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 reveal-stagger">
            {BLOG_POSTS.slice(0, 3).map((post) => (
              <Link key={post.slug} href={`/blog/${post.slug}`} className="hover-float group rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 transition-shadow duration-200 hover:shadow-md">
                <span className="mb-3 inline-block rounded-full bg-[color:var(--color-primary-light)] px-2.5 py-1 text-[10px] font-semibold text-[color:var(--color-primary)]">{post.category}</span>
                <h3 className="mb-2 text-sm font-semibold text-[color:var(--color-text-primary)] leading-snug group-hover:text-[color:var(--color-primary)] transition-colors duration-200">{post.title}</h3>
                <p className="text-xs text-[color:var(--color-text-secondary)] leading-relaxed line-clamp-3">{post.excerpt}</p>
                <p className="mt-3 text-[11px] text-[color:var(--color-text-secondary)]">{post.readTime}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── 14. Integrations ─────────────────────────────────────────── */}
      <section id="integrations" className="px-5 py-16 sm:py-20 bg-[color:var(--color-surface-sunken)] border-y border-[color:var(--color-border)]">
        <div className="mx-auto max-w-6xl text-center">
          <SectionHeading className="mb-3 reveal">
            Works with the tools you already use.
          </SectionHeading>
          <p className="mb-10 text-sm text-[color:var(--color-text-secondary)] max-w-lg mx-auto reveal">
            Asmos optimizes lead capture while you keep using your existing email and SMS systems for follow-up.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 reveal-stagger">
            {INTEGRATIONS.map((name) => (
              <span key={name} className="hover-float rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-5 py-2.5 text-sm font-medium text-[color:var(--color-text-primary)]">
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── 15. Final CTA (dark, bookends the hero) ──────────────────── */}
      <section className="hero-dark relative px-5 py-16 sm:py-20 overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse 70% 60% at 50% 110%, oklch(48% 0.255 258 / 0.22) 0%, transparent 65%)" }}
        />
        <div className="relative mx-auto max-w-2xl text-center reveal">
          <SectionHeading className="mb-4">
            Stop guessing what converts.
          </SectionHeading>
          <p className="mb-8 text-sm text-[color:var(--color-text-secondary)] max-w-sm mx-auto">
            Let Asmos continuously analyze, test, and improve your conversion experiences.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href={CTA.primary.href} className="btn-wipe rounded-full bg-[color:var(--color-primary)] px-6 py-3 text-sm font-semibold text-white transition-transform duration-200 active:scale-[0.97]">
              {CTA.primary.label}
            </Link>
            <Link href={CTA.secondary.href} className="rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-6 py-3 text-sm font-semibold text-[color:var(--color-text-primary)] transition-[background-color,transform] duration-200 hover:bg-[color:var(--color-surface-sunken)] active:scale-[0.97]">
              {CTA.secondary.label}
            </Link>
          </div>
          <Link href={CTA.tertiary.href} className="mt-4 inline-block text-xs font-medium text-[color:var(--color-text-secondary)] underline underline-offset-4 hover:text-[color:var(--color-primary)]">
            {CTA.tertiary.label}
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
