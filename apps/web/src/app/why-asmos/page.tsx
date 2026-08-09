import type { Metadata } from "next";
import Link from "next/link";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { CTA } from "@/lib/site";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Why Asmos — Autonomous Conversion Optimization vs. Popup Builders",
  description:
    "Traditional popup tools help you build forms. Asmos continuously improves them. See how Asmos compares to Klaviyo, Mailchimp, and OptiMonk.",
  path: "/why-asmos",
});

function Arrow({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M2 8h11m0 0L9 4m4 4l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FlowRow({ steps, tone }: { steps: string[]; tone: "muted" | "primary" }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {steps.map((s, i) => (
        <span key={s} className="flex items-center gap-2">
          <span
            className={
              tone === "primary"
                ? "rounded-full bg-[color:var(--color-primary)] px-3 py-1.5 text-xs font-medium text-white"
                : "rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[color:var(--color-text-secondary)]"
            }
          >
            {s}
          </span>
          {i < steps.length - 1 && (
            <Arrow className={tone === "primary" ? "h-3 w-3 text-[color:var(--color-primary)]/50" : "h-3 w-3 text-[color:var(--color-border)]"} />
          )}
        </span>
      ))}
    </div>
  );
}

const PILLARS = [
  { title: "AI-Generated Experiments", body: "Asmos doesn't only generate a popup. It generates conversion hypotheses and variants worth testing." },
  { title: "Autonomous Optimization", body: "Asmos continuously evaluates performance and moves traffic toward stronger experiences." },
  { title: "Continuous Learning", body: "Every experiment gives Asmos more information about what works for your store." },
  { title: "Behavioral Intelligence", body: "Understand clicks, form interaction, abandonment, timing, and conversion behavior." },
  { title: "Conversion-Focused Analytics", body: "See which variants, offers, messages, and experiences are actually driving performance." },
  { title: "Built Around Your Existing Stack", body: "Continue using tools like Klaviyo or Mailchimp for email and SMS delivery while Asmos focuses on optimizing how those leads are captured." },
];

const BUILDER_VS_PLATFORM = [
  ["You create the popup", "AI generates the initial experience"],
  ["You decide what to test", "Asmos proposes experiments"],
  ["You create variants manually", "Asmos creates variants"],
  ["Traffic is manually configured", "Traffic allocation can be automated"],
  ["You analyze the winner", "Asmos evaluates performance"],
  ["You decide what to do next", "Asmos generates the next optimization"],
  ["Optimization is occasional", "Optimization is continuous"],
];

type Cell = { state: "yes" | "partial" | "no"; label?: string };
const yes = (label?: string): Cell => ({ state: "yes", label });
const partial = (label?: string): Cell => ({ state: "partial", label });
const no = (label?: string): Cell => ({ state: "no", label });

const COMPARISON: { capability: string; asmos: Cell; klaviyo: Cell; mailchimp: Cell; optimonk: Cell }[] = [
  { capability: "Popup / Form Creation", asmos: yes(), klaviyo: yes(), mailchimp: yes(), optimonk: yes() },
  { capability: "Email Capture", asmos: yes(), klaviyo: yes(), mailchimp: yes(), optimonk: yes() },
  { capability: "SMS Capture", asmos: yes(), klaviyo: yes(), mailchimp: yes(), optimonk: partial("Depends on integration") },
  { capability: "A/B Testing", asmos: yes("Autonomous"), klaviyo: yes("Standard A/B"), mailchimp: partial("Limited / not core popup workflow"), optimonk: yes("Standard A/B") },
  { capability: "Automatic Winner Selection", asmos: yes(), klaviyo: yes(), mailchimp: no(), optimonk: partial("Testing available") },
  { capability: "AI-Generated Experiments", asmos: yes(), klaviyo: partial("Limited / selected optimization features"), mailchimp: no(), optimonk: partial("AI features available") },
  { capability: "Autonomous Variant Generation", asmos: yes(), klaviyo: no(), mailchimp: no(), optimonk: partial("Limited") },
  { capability: "Dynamic Traffic Allocation", asmos: yes(), klaviyo: partial("Mostly configured testing weights"), mailchimp: no(), optimonk: partial("Standard split testing") },
  { capability: "Automatic Variant Elimination", asmos: yes(), klaviyo: partial("Winner can be automatically selected"), mailchimp: no(), optimonk: partial("Standard experiment workflow") },
  { capability: "Continuous Next-Generation Testing", asmos: yes(), klaviyo: no(), mailchimp: no(), optimonk: no() },
  { capability: "Deep Popup Behavioral Analytics", asmos: yes(), klaviyo: partial("Form analytics"), mailchimp: partial("Popup reporting"), optimonk: partial("Campaign analytics") },
  { capability: "AI Learnings Across Experiments", asmos: yes(), klaviyo: partial("Limited"), mailchimp: no(), optimonk: partial("Limited") },
  { capability: "Dedicated Ecommerce Conversion Optimization", asmos: yes(), klaviyo: partial("Part of broader CRM/marketing platform"), mailchimp: partial("Part of broader marketing platform"), optimonk: yes() },
  { capability: "Email Marketing Platform", asmos: partial("Integrates"), klaviyo: yes(), mailchimp: yes(), optimonk: partial("Integrates") },
  { capability: "Designed to Replace Your Email Platform", asmos: no(), klaviyo: no(), mailchimp: no(), optimonk: no() },
];

function Cell({ cell, emphasize }: { cell: Cell; emphasize?: boolean }) {
  const base = "inline-flex items-center gap-1.5 text-xs";
  if (cell.state === "yes") {
    return (
      <span className={base}>
        <span className={emphasize ? "text-[color:var(--color-primary)] font-bold" : "text-[color:var(--color-success)] font-bold"}>✓</span>
        {cell.label && <span className="text-[color:var(--color-text-secondary)]">{cell.label}</span>}
      </span>
    );
  }
  if (cell.state === "partial") {
    return (
      <span className={base}>
        <span className="text-amber-500 font-bold">◐</span>
        {cell.label && <span className="text-[color:var(--color-text-secondary)]">{cell.label}</span>}
      </span>
    );
  }
  return (
    <span className={base}>
      <span className="text-[color:var(--color-text-secondary)]">—</span>
      {cell.label && <span className="text-[color:var(--color-text-secondary)]">{cell.label}</span>}
    </span>
  );
}

const AUTONOMOUS_STEPS = [
  "Your store is analyzed.",
  "An initial experience is created.",
  "Multiple meaningful variants are generated.",
  "Visitors interact with those variants.",
  "Performance is measured.",
  "Stronger variants receive more traffic.",
  "Weak variants are reduced or eliminated.",
  "Asmos identifies winning traits.",
  "New experiments are generated.",
  "The process continues.",
];

const CONTROLS = [
  "Require approval before publishing",
  "Lock discount values",
  "Protect brand colors",
  "Protect legal copy",
  "Set testing limits",
  "Define audience restrictions",
  "Pause optimization anytime",
  "Use Managed Success for additional human support",
];

export default function WhyAsmosPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-[color:var(--color-surface)]">
      <MarketingHeader />

      {/* Hero */}
      <section className="px-5 pt-14 pb-16 sm:pt-20 sm:pb-20">
        <div className="mx-auto max-w-5xl">
          <h1 className="mb-5 max-w-2xl text-[2.1rem] leading-[1.1] font-bold tracking-[-0.02em] text-[color:var(--color-text-primary)] sm:text-[2.75rem] animate-page-enter">
            Built to optimize, not just build.
          </h1>
          <p className="mb-8 max-w-xl text-base sm:text-lg text-[color:var(--color-text-secondary)] leading-relaxed animate-page-enter-delay-1">
            Traditional popup tools give you a builder and leave optimization to your team. Asmos analyzes, generates, tests, learns, and continuously improves your conversion experiences.
          </p>
          <div className="flex flex-wrap items-center gap-4 mb-12 animate-page-enter-delay-2">
            <Link href={CTA.primary.href} className="rounded-full bg-[color:var(--color-primary)] px-6 py-3 text-sm font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-[color:var(--color-primary-dark)] active:scale-[0.97]">
              {CTA.primary.label}
            </Link>
            <Link href={CTA.secondary.href} className="rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-6 py-3 text-sm font-semibold text-[color:var(--color-text-primary)] transition-[background-color,transform] duration-200 hover:bg-[color:var(--color-surface-sunken)] active:scale-[0.97]">
              {CTA.secondary.label}
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-page-enter-delay-3">
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-6">
              <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-text-secondary)]">Traditional</p>
              <FlowRow steps={["Build", "Publish", "Analyze manually", "Change manually"]} tone="muted" />
            </div>
            <div className="rounded-2xl border border-[color:var(--color-primary)]/25 bg-[color:var(--color-primary-light)] p-6">
              <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-primary)]">Asmos</p>
              <FlowRow steps={["Analyze", "Generate", "Test", "Learn", "Optimize"]} tone="primary" />
            </div>
          </div>
        </div>
      </section>

      {/* Problem with traditional tools */}
      <section className="px-5 py-16 sm:py-24 bg-[color:var(--color-surface-sunken)] border-y border-[color:var(--color-border)]">
        <div className="mx-auto max-w-4xl reveal">
          <h2 className="mb-4 text-2xl font-bold tracking-tight text-[color:var(--color-text-primary)]" style={{ textWrap: "balance" } as React.CSSProperties}>
            Publishing is where most popup tools stop.
          </h2>
          <p className="mb-4 text-sm text-[color:var(--color-text-secondary)] leading-relaxed">
            Most popup platforms are designed around creation. You choose a template, headline, offer, form fields, trigger, and design. Then your team is responsible for deciding what to test, which variants to create, how long to run them, which version won, and what to change next.
          </p>
          <p className="text-sm text-[color:var(--color-text-secondary)] leading-relaxed font-medium text-[color:var(--color-text-primary)]">
            Asmos is designed around what happens after publishing.
          </p>
        </div>
      </section>

      {/* Pillars */}
      <section className="px-5 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-12 text-2xl sm:text-[1.9rem] font-bold tracking-tight text-[color:var(--color-text-primary)] text-center reveal" style={{ textWrap: "balance" } as React.CSSProperties}>
            What makes Asmos different
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 reveal-stagger">
            {PILLARS.map((p) => (
              <div key={p.title} className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
                <h3 className="mb-1.5 text-sm font-semibold text-[color:var(--color-text-primary)]">{p.title}</h3>
                <p className="text-xs text-[color:var(--color-text-secondary)] leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Builder vs platform */}
      <section className="px-5 py-16 sm:py-24 bg-[color:var(--color-surface-sunken)] border-y border-[color:var(--color-border)]">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-10 text-2xl font-bold tracking-tight text-[color:var(--color-text-primary)] text-center reveal" style={{ textWrap: "balance" } as React.CSSProperties}>
            A popup builder gives you tools. Asmos does the work.
          </h2>
          <div className="overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] reveal-eager">
            <div className="grid grid-cols-2 border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] text-xs font-semibold uppercase tracking-wide text-[color:var(--color-text-secondary)]">
              <div className="px-5 py-3">Traditional Popup Builder</div>
              <div className="px-5 py-3 text-[color:var(--color-primary)]">Asmos</div>
            </div>
            {BUILDER_VS_PLATFORM.map((row, i) => (
              <div key={i} className="grid grid-cols-2 border-b border-[color:var(--color-border)] last:border-b-0 text-sm">
                <div className="px-5 py-3.5 text-[color:var(--color-text-secondary)]">{row[0]}</div>
                <div className="px-5 py-3.5 text-[color:var(--color-text-primary)] font-medium">{row[1]}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison table */}
      <section className="px-5 py-16 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-3 text-2xl sm:text-[1.9rem] font-bold tracking-tight text-[color:var(--color-text-primary)] text-center reveal" style={{ textWrap: "balance" } as React.CSSProperties}>
            How Asmos compares
          </h2>
          <p className="mb-3 text-sm text-[color:var(--color-text-secondary)] text-center max-w-xl mx-auto reveal">
            Klaviyo, Mailchimp, and OptiMonk are powerful marketing and popup tools. Asmos is built around a different objective: continuously optimizing conversion performance.
          </p>
          <p className="mb-10 text-[11px] text-[color:var(--color-text-secondary)] text-center">✓ Included · ◐ Limited / partial · — Not core / unavailable</p>
          <div className="overflow-x-auto reveal-eager">
            <table className="w-full min-w-[720px] border-collapse rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-left">
              <thead>
                <tr className="border-b border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] text-xs font-semibold uppercase tracking-wide text-[color:var(--color-text-secondary)]">
                  <th className="px-4 py-3">Capability</th>
                  <th className="px-4 py-3 text-[color:var(--color-primary)] bg-[color:var(--color-primary-light)]">Asmos</th>
                  <th className="px-4 py-3">Klaviyo</th>
                  <th className="px-4 py-3">Mailchimp</th>
                  <th className="px-4 py-3">OptiMonk</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row) => (
                  <tr key={row.capability} className="border-b border-[color:var(--color-border)] last:border-b-0 text-sm">
                    <td className="px-4 py-3 text-[color:var(--color-text-primary)] font-medium">{row.capability}</td>
                    <td className="px-4 py-3 bg-[color:var(--color-primary-light)]/40"><Cell cell={row.asmos} emphasize /></td>
                    <td className="px-4 py-3"><Cell cell={row.klaviyo} /></td>
                    <td className="px-4 py-3"><Cell cell={row.mailchimp} /></td>
                    <td className="px-4 py-3"><Cell cell={row.optimonk} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-10 max-w-2xl mx-auto text-center reveal">
            <p className="mb-2 text-base font-semibold text-[color:var(--color-text-primary)]">Asmos isn&apos;t trying to replace Klaviyo or Mailchimp.</p>
            <p className="text-sm text-[color:var(--color-text-secondary)] leading-relaxed">
              Use Asmos to optimize how visitors become subscribers. Keep using your existing email and SMS platform to communicate with them afterward.
            </p>
            <div className="mt-6 flex items-center justify-center">
              <FlowRow steps={["Visitor", "Asmos — Conversion + Lead Capture", "Klaviyo / Mailchimp / Omnisend", "Customer"]} tone="muted" />
            </div>
          </div>
        </div>
      </section>

      {/* What autonomous means */}
      <section className="px-5 py-16 sm:py-24 bg-[color:var(--color-surface-sunken)] border-y border-[color:var(--color-border)]">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-8 text-2xl font-bold tracking-tight text-[color:var(--color-text-primary)] text-center reveal" style={{ textWrap: "balance" } as React.CSSProperties}>
            What autonomous optimization means
          </h2>
          <ol className="space-y-2 reveal-stagger max-w-lg mx-auto">
            {AUTONOMOUS_STEPS.map((step, i) => (
              <li key={step} className="flex items-start gap-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-3 text-sm text-[color:var(--color-text-secondary)]">
                <span className="text-xs font-bold text-[color:var(--color-primary)] tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                {step}
              </li>
            ))}
          </ol>
          <p className="mt-8 text-center text-sm font-medium text-[color:var(--color-text-primary)] max-w-md mx-auto">
            You set the goal and guardrails. Asmos manages the optimization loop.
          </p>
        </div>
      </section>

      {/* Human control */}
      <section className="px-5 py-16 sm:py-24">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-3 text-2xl font-bold tracking-tight text-[color:var(--color-text-primary)] text-center reveal" style={{ textWrap: "balance" } as React.CSSProperties}>
            Autonomous doesn&apos;t mean uncontrolled.
          </h2>
          <p className="mb-8 text-sm text-[color:var(--color-text-secondary)] text-center max-w-lg mx-auto reveal">
            Choose how much control Asmos has. Start with approval-based optimization and increase autonomy when you&apos;re comfortable.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 reveal-stagger max-w-2xl mx-auto">
            {CONTROLS.map((c) => (
              <div key={c} className="flex items-center gap-2.5 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-3 text-sm text-[color:var(--color-text-secondary)]">
                <span className="text-[color:var(--color-primary)] font-bold text-xs">✓</span>
                {c}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Flywheel */}
      <section className="px-5 py-16 sm:py-24 bg-[color:var(--color-surface-sunken)] border-y border-[color:var(--color-border)]">
        <div className="mx-auto max-w-3xl text-center reveal">
          <h2 className="mb-6 text-2xl font-bold tracking-tight text-[color:var(--color-text-primary)]" style={{ textWrap: "balance" } as React.CSSProperties}>
            Every experiment becomes another learning.
          </h2>
          <FlowRow steps={["More Visitors", "More Experiments", "More Performance Data", "Better Learnings", "Better Variants", "Higher Conversion Potential"]} tone="primary" />
          <p className="mt-8 text-sm text-[color:var(--color-text-secondary)] leading-relaxed max-w-lg mx-auto">
            Asmos is designed to build a growing understanding of your audience, offers, messaging, layouts, traffic sources, devices, and customer segments.
          </p>
        </div>
      </section>

      {/* Existing stack */}
      <section id="integrations" className="px-5 py-16 sm:py-24">
        <div className="mx-auto max-w-3xl text-center reveal">
          <h2 className="mb-6 text-2xl font-bold tracking-tight text-[color:var(--color-text-primary)]" style={{ textWrap: "balance" } as React.CSSProperties}>
            Optimize the capture. Keep the systems you already love.
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {["Klaviyo", "Mailchimp", "Omnisend", "Attentive", "Zapier", "Shopify"].map((name) => (
              <span key={name} className="rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-5 py-2.5 text-sm font-medium text-[color:var(--color-text-primary)]">
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Managed success */}
      <section id="managed-success" className="px-5 py-16 sm:py-24 bg-[color:var(--color-surface-sunken)] border-y border-[color:var(--color-border)]">
        <div className="mx-auto max-w-2xl text-center reveal">
          <h2 className="mb-3 text-2xl font-bold tracking-tight text-[color:var(--color-text-primary)]" style={{ textWrap: "balance" } as React.CSSProperties}>
            AI when you want autonomy. Humans when you want support.
          </h2>
          <p className="mb-7 text-sm text-[color:var(--color-text-secondary)] max-w-md mx-auto">
            Managed Success adds white-glove onboarding, hands-on optimization support, and a dedicated Customer Success Manager.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/pricing" className="rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-5 py-2.5 text-sm font-semibold text-[color:var(--color-text-primary)] transition-[background-color,transform] duration-200 hover:bg-[color:var(--color-surface-sunken)] active:scale-[0.97]">
              Explore Managed Success
            </Link>
            <Link href={CTA.secondary.href} className="text-sm font-medium text-[color:var(--color-primary)]">
              {CTA.secondary.label}
            </Link>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-5 py-16 sm:py-24">
        <div className="mx-auto max-w-2xl text-center reveal">
          <h2 className="mb-4 text-2xl sm:text-[2rem] font-bold tracking-tight text-[color:var(--color-text-primary)]" style={{ textWrap: "balance" } as React.CSSProperties}>
            Build less. Learn faster. Convert more.
          </h2>
          <p className="mb-8 text-sm text-[color:var(--color-text-secondary)] max-w-sm mx-auto">
            Let Asmos continuously improve the experiences turning your visitors into subscribers and customers.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href={CTA.primary.href} className="rounded-full bg-[color:var(--color-primary)] px-6 py-3 text-sm font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-[color:var(--color-primary-dark)] active:scale-[0.97]">
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
