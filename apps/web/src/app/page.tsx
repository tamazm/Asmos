import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth-adapter";
import { HomepageForm } from "@/components/ui/HomepageForm";
import { KnockoutBracketPreview } from "@/components/ui/KnockoutBracketPreview";
import { KnockoutGraphPreview } from "@/components/marketing/KnockoutGraphPreview";
import { ConversionGrowthPreview } from "@/components/marketing/ConversionGrowthPreview";
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

// ── Shared building blocks ───────────────────────────────────────────────
// Every section on this page follows the same beat: a small eyebrow pill,
// a centered heading with exactly one accent-colored word, an optional
// one-line subtext. Centralizing it here keeps that rhythm consistent
// instead of hand-tuning class strings 15 times.

function Arrow({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M2 8h11m0 0L9 4m4 4l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Accent({ children }: { children: React.ReactNode }) {
  return <span className="text-[color:var(--color-primary)]">{children}</span>;
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-[color:var(--color-text-secondary)]">
      <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-primary)]" aria-hidden="true" />
      {children}
    </span>
  );
}

function SectionHeading({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <h2
      className={`text-[1.75rem] sm:text-[2.25rem] lg:text-[2.5rem] font-semibold leading-[1.15] tracking-[-0.02em] text-[color:var(--color-text-primary)] ${className}`}
      style={{ textWrap: "balance" } as React.CSSProperties}
    >
      {children}
    </h2>
  );
}

function SectionIntro({
  eyebrow,
  heading,
  sub,
  className = "",
}: {
  eyebrow: string;
  heading: React.ReactNode;
  sub?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto max-w-2xl text-center reveal ${className}`}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <SectionHeading>{heading}</SectionHeading>
      {sub && <p className="mt-3 text-sm text-[color:var(--color-text-secondary)] leading-relaxed">{sub}</p>}
    </div>
  );
}

function HatchDivider() {
  return <div aria-hidden="true" className="hatch-divider border-y border-[color:var(--color-border)]" />;
}

// Bordered lattice grid: a single outer panel whose cells are separated by
// hairline dividers instead of each being its own floating card. `cols`
// controls the desktop column count (rows always stack on mobile).
function LatticeGrid({ cols, children }: { cols: 2 | 3; children: React.ReactNode[] }) {
  const items = children;
  const smCols = cols === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3";
  return (
    <div className={`mx-auto max-w-6xl rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] overflow-hidden reveal-stagger`}>
      <div className={`grid grid-cols-1 ${smCols}`}>
        {items.map((child, i) => {
          const row = Math.floor(i / cols);
          const col = i % cols;
          return (
            <div
              key={i}
              className={`p-7 sm:p-8 border-[color:var(--color-border)] ${i > 0 ? "border-t" : ""} ${
                row > 0 ? "sm:border-t" : "sm:border-t-0"
              } ${col > 0 ? "sm:border-l" : ""}`}
            >
              {child}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// One step of the "How Asmos works" walkthrough: a live animation on one
// side, the explanation on the other. Alternates sides per row so the
// section reads as a sequence rather than a repeated block.
function HowItWorksRow({
  index,
  icon: Icon,
  title,
  body,
  reverse,
  visual,
}: {
  index: number;
  icon: (props: { className?: string }) => React.ReactElement;
  title: string;
  body: string;
  reverse?: boolean;
  visual: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 items-center gap-8 py-10 first:pt-0 last:pb-0 lg:grid-cols-2 lg:gap-16 reveal">
      <div className={reverse ? "lg:order-2" : ""}>{visual}</div>
      <div className={reverse ? "lg:order-1" : ""}>
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-[color:var(--color-primary-light)] text-[color:var(--color-primary)]">
          <Icon className="h-6 w-6" />
        </div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-primary)]">Step {index}</p>
        <h3 className="mb-3 text-xl sm:text-2xl font-semibold tracking-[-0.01em] text-[color:var(--color-text-primary)]">{title}</h3>
        <p className="max-w-md text-sm text-[color:var(--color-text-secondary)] leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

// ── Content ───────────────────────────────────────────────────────────────

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

// Real, code-verifiable product facts - not marketing outcomes. See
// lib/limits.ts (MAX_VARIANTS_PER_ROUND.SCALE) and evaluateKnockout.ts
// (ALL_AXES, the Inngest cron trigger) for the source of each number.
const STATS = [
  { value: 5, suffix: "", label: "Test axes evaluated automatically", body: "Trigger, friction, copy, layout, and visual - Asmos isolates one variable at a time." },
  { value: 30, suffix: "", label: "Variants tested per round on Scale", body: "The knockout tournament scales its bracket size with your plan." },
  { value: 24, suffix: "/7", label: "Autonomous evaluation", body: "Traffic reallocates and new variants get generated on a schedule - no manual triggers." },
];

const AI_LEARNINGS = [
  "Shorter headlines are outperforming on mobile.",
  "Email-only forms are completing more often.",
  "Paid social visitors respond better to this offer.",
  "Variant 23 currently has the highest probability of winning.",
];

const INTEGRATIONS = ["Shopify", "Klaviyo", "Mailchimp", "Omnisend", "Zapier"];

export default async function LandingPage() {
  const { userId } = await auth();
  const isMock = process.env.MOCK_AUTH === "true";
  if (userId && !isMock) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[color:var(--color-surface-sunken)]">
      <MarketingHeader />

      {/* ── 1. Hero ────────────────────────────────────────────────────── */}
      <section className="px-5 pt-16 pb-12 sm:pt-24 sm:pb-16 text-center bg-[color:var(--color-surface)]">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3.5 py-1.5 text-xs font-medium text-[color:var(--color-text-secondary)] shadow-sm animate-page-enter">
            <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-primary)] shrink-0" aria-hidden="true" />
            Autonomous conversion optimization for ecommerce
          </div>

          <h1
            className="mb-5 text-[2.5rem] leading-[1.08] font-semibold tracking-[-0.02em] text-[color:var(--color-text-primary)] sm:text-[3.5rem] lg:text-[4rem]"
            style={{ textWrap: "balance" } as React.CSSProperties}
          >
            AI that keeps <Accent>improving</Accent>{" "}your store&apos;s conversions.
          </h1>

          <p
            className="mx-auto mb-8 max-w-xl text-base sm:text-lg text-[color:var(--color-text-secondary)] leading-relaxed animate-page-enter-delay-2"
            style={{ textWrap: "pretty" } as React.CSSProperties}
          >
            Asmos analyzes your store, generates conversion experiments, tests variants, learns from visitor behavior, and continuously improves performance.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 animate-page-enter-delay-2">
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
          </div>
        </div>
      </section>

      <HatchDivider />

      {/* ── 3. Trust bar ───────────────────────────────────────────────── */}
      <section className="bg-[color:var(--color-surface-sunken)] px-5 py-8">
        <div className="mx-auto max-w-6xl reveal">
          <p className="text-center text-sm font-medium text-[color:var(--color-text-secondary)]">
            Built for ecommerce teams focused on measurable growth.
          </p>
        </div>
      </section>

      <HatchDivider />

      {/* ── 4. How it works ───────────────────────────────────────────── */}
      <section className="px-5 py-16 sm:py-20 bg-[color:var(--color-surface)]">
        <SectionIntro
          className="mb-10"
          eyebrow="How it works"
          heading={<>How <Accent>Asmos</Accent> works</>}
          sub="Three steps, running continuously - not a checklist you manage by hand."
        />
        <div className="mx-auto max-w-5xl divide-y divide-[color:var(--color-border)]">
          <HowItWorksRow
            index={1}
            icon={HOW_STEPS[0].icon}
            title={HOW_STEPS[0].title}
            body={HOW_STEPS[0].body}
            visual={
              <div className="flex justify-center">
                <KnockoutBracketPreview animated variant="default" />
              </div>
            }
          />
          <HowItWorksRow
            index={2}
            icon={HOW_STEPS[1].icon}
            title={HOW_STEPS[1].title}
            body={HOW_STEPS[1].body}
            reverse
            visual={<KnockoutGraphPreview />}
          />
          <HowItWorksRow
            index={3}
            icon={HOW_STEPS[2].icon}
            title={HOW_STEPS[2].title}
            body={HOW_STEPS[2].body}
            visual={<ConversionGrowthPreview />}
          />
        </div>
        <div className="mt-14 text-center">
          <Link href={CTA.primary.href} className="btn-wipe inline-flex items-center gap-2 rounded-full bg-[color:var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white transition-transform duration-200 active:scale-[0.97]">
            {CTA.primary.label} <Arrow className="h-3.5 w-3.5 text-white/80" />
          </Link>
        </div>
      </section>

      <HatchDivider />

      {/* ── 5. Problem framing ────────────────────────────────────────── */}
      <section className="px-5 py-16 sm:py-20 bg-[color:var(--color-surface-sunken)]">
        <SectionIntro className="mb-10" eyebrow="The old way" heading={<>Conversion testing is still too <Accent>manual</Accent>.</>} />
        <div className="mx-auto grid max-w-6xl grid-cols-1 divide-y divide-[color:var(--color-border)] overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] sm:grid-cols-2 sm:divide-x sm:divide-y-0 reveal-stagger">
          <div className="p-7 sm:p-8">
            <p className="mb-5 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-text-secondary)]">Without Asmos</p>
            <div className="flex flex-wrap items-center gap-2">
              {PROBLEM_OLD.map((step, i) => (
                <span key={step} className="flex items-center gap-2">
                  <span className="rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] px-3 py-1.5 text-xs font-medium text-[color:var(--color-text-secondary)]">
                    {step}
                  </span>
                  {i < PROBLEM_OLD.length - 1 && <Arrow className="h-3 w-3 text-[color:var(--color-border)]" />}
                </span>
              ))}
            </div>
          </div>
          <div className="p-7 sm:p-8">
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
      </section>

      <HatchDivider />

      {/* ── 6. Core product features ──────────────────────────────────── */}
      <section className="px-5 py-16 sm:py-20 bg-[color:var(--color-surface)]">
        <SectionIntro
          className="mb-10"
          eyebrow="Platform"
          heading={<>Everything you need to <Accent>optimize</Accent> conversion, automatically</>}
        />
        <LatticeGrid cols={2}>
          {FEATURES.map((f) => (
            <div key={f.title}>
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[color:var(--color-primary-light)] text-[color:var(--color-primary)]">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mb-1.5 text-sm font-semibold text-[color:var(--color-text-primary)]">{f.title}</h3>
              <p className="text-xs text-[color:var(--color-text-secondary)] leading-relaxed">{f.body}</p>
            </div>
          ))}
        </LatticeGrid>
      </section>

      <HatchDivider />

      {/* ── 7. Autonomous optimization ────────────────────────────────── */}
      <section className="px-5 py-16 sm:py-20 overflow-hidden bg-[color:var(--color-surface-sunken)]">
        <SectionIntro
          eyebrow="Live testing"
          heading={<>Let the <Accent>strongest</Accent> experience win.</>}
          sub="The knockout tournament shown above is exactly what happens inside every live campaign: Asmos continuously evaluates performance, reduces exposure to weaker experiences, and gives stronger variants more opportunity to convert."
        />
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 reveal">
          {["Many variants", "Stronger variants remain", "Traffic concentrates", "Winner emerges", "New generation begins"].map((s, i, arr) => (
            <span key={s} className="flex items-center gap-2">
              <span className="rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[color:var(--color-text-secondary)]">{s}</span>
              {i < arr.length - 1 && <Arrow className="h-3 w-3 text-[color:var(--color-border)]" />}
            </span>
          ))}
        </div>
      </section>

      <HatchDivider />

      {/* ── 8. Metrics ─────────────────────────────────────────────────── */}
      <section className="px-5 py-16 sm:py-20 bg-[color:var(--color-surface)]">
        <SectionIntro className="mb-10" eyebrow="Metrics" heading={<>How the testing engine actually <Accent>works</Accent></>} />
        <LatticeGrid cols={3}>
          {STATS.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-4xl sm:text-5xl font-semibold tracking-[-0.02em] text-[color:var(--color-primary)]">
                <StatCounter value={stat.value} suffix={stat.suffix} />
              </p>
              <p className="mt-3 text-sm font-semibold text-[color:var(--color-text-primary)]">{stat.label}</p>
              <p className="mt-1.5 text-xs text-[color:var(--color-text-secondary)] leading-relaxed">{stat.body}</p>
            </div>
          ))}
        </LatticeGrid>
      </section>

      <HatchDivider />

      {/* ── 9. AI Learnings ────────────────────────────────────────────── */}
      <section className="px-5 py-16 sm:py-20 bg-[color:var(--color-surface-sunken)]">
        <SectionIntro className="mb-10" eyebrow="AI learnings" heading={<>Asmos doesn&apos;t just find winners. It learns <Accent>why</Accent>.</>} />
        <div className="mx-auto max-w-2xl divide-y divide-[color:var(--color-border)] overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] reveal-stagger">
          {AI_LEARNINGS.map((insight) => (
            <div key={insight} className="flex items-start gap-3 p-4">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-primary-light)] text-[color:var(--color-primary)] text-[10px] font-bold">AI</div>
              <p className="text-sm text-[color:var(--color-text-secondary)] leading-relaxed">{insight}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-[11px] text-[color:var(--color-text-secondary)]">Example insights - actual learnings are generated from your store&apos;s data.</p>
      </section>

      <HatchDivider />

      {/* ── 10. Free Optimization Analysis (soft offramp before pricing) ── */}
      <section className="px-5 py-16 sm:py-20 bg-[color:var(--color-surface)]">
        <SectionIntro eyebrow="Free tool" heading={<>Not ready to start? <Accent>Analyze</Accent> your store first.</>} sub="Paste your store URL and get a limited conversion analysis with actionable optimization opportunities - no account required." />
        <div className="mt-6">
          <HomepageForm />
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <span className="text-xs text-[color:var(--color-text-secondary)]">Also free:</span>
          <Link
            href="/tools/email-capture-calculator"
            className="rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2 text-xs font-semibold text-[color:var(--color-text-primary)] transition-[background-color,transform] duration-200 hover:bg-[color:var(--color-surface-sunken)] active:scale-[0.97]"
          >
            Email Capture Revenue Calculator
          </Link>
          <Link
            href="/tools/traffic-calculator"
            className="rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-2 text-xs font-semibold text-[color:var(--color-text-primary)] transition-[background-color,transform] duration-200 hover:bg-[color:var(--color-surface-sunken)] active:scale-[0.97]"
          >
            Traffic Calculator
          </Link>
        </div>
      </section>

      <HatchDivider />

      {/* ── 11. Pricing ────────────────────────────────────────────────── */}
      <section id="pricing" className="px-5 py-16 sm:py-20 bg-[color:var(--color-surface-sunken)]">
        <SectionIntro
          className="mb-10"
          eyebrow="Pricing"
          heading={<>Flexible pricing built around your <Accent>traffic</Accent>.</>}
          sub="Every plan includes the full Asmos platform. Pricing scales with your traffic and level of support - not locked features."
        />
        <PricingClient />
        <div className="mt-4 text-center">
          <Link href="/pricing" className="text-sm font-medium text-[color:var(--color-primary)] underline underline-offset-4">
            Compare all plans in detail
          </Link>
        </div>
      </section>

      <HatchDivider />

      {/* ── 12. Managed Success ───────────────────────────────────────── */}
      <section id="managed-success" className="px-5 py-16 sm:py-20 bg-[color:var(--color-surface)]">
        <SectionIntro eyebrow="Managed Success" heading={<>Prefer a <Accent>hands-on</Accent> experience?</>} sub="Add Managed Success for white-glove onboarding, hands-on optimization support, and a dedicated Customer Success Manager." />
        <div className="mt-7 text-center">
          <Link href="/why-asmos#managed-success" className="inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-5 py-2.5 text-sm font-semibold text-[color:var(--color-text-primary)] transition-[background-color,transform] duration-200 hover:bg-[color:var(--color-surface-sunken)] active:scale-[0.97]">
            Learn About Managed Success <Arrow className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>

      <HatchDivider />

      {/* ── 13. FAQ - split layout: intro left, accordion right ─────────── */}
      <section className="px-5 py-16 sm:py-20 bg-[color:var(--color-surface-sunken)]">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.4fr]">
            <div className="border-[color:var(--color-border)] p-7 sm:border-r sm:p-10 reveal">
              <Eyebrow>FAQ</Eyebrow>
              <SectionHeading className="text-left">Frequently asked questions</SectionHeading>
              <p className="mt-3 text-sm text-[color:var(--color-text-secondary)]">Everything else is in the full pricing breakdown.</p>
            </div>
            <div className="divide-y divide-[color:var(--color-border)] reveal-stagger">
              {FAQS.map((faq) => (
                <details key={faq.question} className="group px-6 py-5 sm:px-8">
                  <summary className="cursor-pointer list-none text-sm font-semibold text-[color:var(--color-text-primary)] flex items-center justify-between gap-4">
                    {faq.question}
                    <span className="shrink-0 text-[color:var(--color-primary)] group-open:rotate-45 transition-transform duration-200 text-lg leading-none">+</span>
                  </summary>
                  <p className="mt-2.5 text-sm text-[color:var(--color-text-secondary)] leading-relaxed">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      <HatchDivider />

      {/* ── 14. Blog / resources preview ─────────────────────────────── */}
      <section className="px-5 py-16 sm:py-20 bg-[color:var(--color-surface)]">
        <SectionIntro className="mb-10" eyebrow="Blog" heading={<>From the <Accent>blog</Accent></>} />
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-5 sm:grid-cols-3 reveal-stagger">
          {BLOG_POSTS.slice(0, 3).map((post) => (
            <Link key={post.slug} href={`/blog/${post.slug}`} className="group overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] transition-shadow duration-200 hover:shadow-md">
              <div className="tile-texture flex aspect-[4/3] items-center justify-center px-4">
                <span className="text-center text-lg font-semibold leading-snug text-white/90">{post.category}</span>
              </div>
              <div className="p-5">
                <h3 className="mb-2 text-sm font-semibold text-[color:var(--color-text-primary)] leading-snug group-hover:text-[color:var(--color-primary)] transition-colors duration-200">{post.title}</h3>
                <p className="text-xs text-[color:var(--color-text-secondary)] leading-relaxed line-clamp-2">{post.excerpt}</p>
                <p className="mt-3 text-[11px] text-[color:var(--color-text-secondary)]">{post.readTime}</p>
              </div>
            </Link>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link href="/blog" className="inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-5 py-2.5 text-sm font-semibold text-[color:var(--color-text-primary)] transition-[background-color,transform] duration-200 hover:bg-[color:var(--color-surface-sunken)] active:scale-[0.97]">
            Explore Resources <Arrow className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>

      <HatchDivider />

      {/* ── 15. Integrations ─────────────────────────────────────────── */}
      <section id="integrations" className="px-5 py-16 sm:py-20 bg-[color:var(--color-surface-sunken)]">
        <SectionIntro className="mb-10" eyebrow="Integrations" heading={<>Works with the tools you already <Accent>use</Accent>.</>} sub="Asmos optimizes lead capture while you keep using your existing email and SMS systems for follow-up." />
        <div className="flex flex-wrap items-center justify-center gap-3 reveal-stagger">
          {INTEGRATIONS.map((name) => (
            <span key={name} className="hover-float rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-5 py-2.5 text-sm font-medium text-[color:var(--color-text-primary)]">
              {name}
            </span>
          ))}
        </div>
      </section>

      {/* ── 16. Why Asmos exists - a real pull-quote, not a fabricated
             customer testimonial ──────────────────────────────────────── */}
      <section className="px-5 py-16 sm:py-24 bg-[color:var(--color-surface)]">
        <SectionIntro className="mb-8" eyebrow="Why Asmos exists" heading={<>Built for <Accent>evidence</Accent>, not guesswork.</>} />
        <p
          className="reveal mx-auto max-w-3xl text-center text-xl sm:text-2xl font-medium leading-snug tracking-[-0.01em] text-[color:var(--color-text-primary)]"
          style={{ textWrap: "balance" } as React.CSSProperties}
        >
          &ldquo;Most stores run one popup forever because nobody has time to test the next version. Asmos exists so the next version is always being tested.&rdquo;
        </p>
      </section>

      {/* ── 17. Final CTA (dark) ─────────────────────────────────────── */}
      <section className="hero-dark relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse 70% 60% at 15% 50%, oklch(48% 0.255 258 / 0.22) 0%, transparent 65%)" }}
        />
        <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-8 px-5 py-16 sm:flex-row sm:items-center sm:justify-between sm:py-20 reveal">
          <div className="text-center sm:text-left">
            <h2
              className="text-2xl sm:text-[2rem] font-semibold tracking-[-0.02em] text-[color:var(--color-text-primary)]"
              style={{ textWrap: "balance" } as React.CSSProperties}
            >
              Stop <Accent>guessing</Accent> what converts.
            </h2>
            <p className="mt-2 text-sm text-[color:var(--color-text-secondary)] max-w-sm">
              Let Asmos continuously analyze, test, and improve your conversion experiences.
            </p>
          </div>
          <div className="flex flex-col items-center gap-3 sm:items-end shrink-0">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link href={CTA.primary.href} className="btn-wipe rounded-full bg-[color:var(--color-primary)] px-6 py-3 text-sm font-semibold text-white transition-transform duration-200 active:scale-[0.97]">
                {CTA.primary.label}
              </Link>
              <Link href={CTA.secondary.href} className="rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-6 py-3 text-sm font-semibold text-[color:var(--color-text-primary)] transition-[background-color,transform] duration-200 hover:bg-[color:var(--color-surface-sunken)] active:scale-[0.97]">
                {CTA.secondary.label}
              </Link>
            </div>
            <Link href={CTA.tertiary.href} className="text-xs font-medium text-[color:var(--color-text-secondary)] underline underline-offset-4 hover:text-[color:var(--color-primary)]">
              {CTA.tertiary.label}
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
