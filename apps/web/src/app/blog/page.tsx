import type { Metadata } from "next";
import Link from "next/link";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { BlogIndexClient } from "@/components/marketing/BlogIndexClient";
import { BlogCoverPlaceholder } from "@/components/marketing/BlogCoverPlaceholder";
import { buildMetadata } from "@/lib/seo";
import { BLOG_POSTS } from "@/lib/blog/posts";
import { CTA } from "@/lib/site";

export const metadata: Metadata = buildMetadata({
  title: "Blog — Insights for Better Ecommerce Conversion",
  description: "Practical guides, experiments, benchmarks, and conversion insights from Asmos.",
  path: "/blog",
});

export default function BlogIndexPage() {
  const featured = BLOG_POSTS.find((p) => p.featured) ?? BLOG_POSTS[0];
  const rest = BLOG_POSTS.filter((p) => p.slug !== featured.slug);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[color:var(--color-surface)]">
      <MarketingHeader />

      {/* Hero */}
      <section className="px-5 pt-14 pb-8 sm:pt-20 text-center">
        <div className="mx-auto max-w-2xl">
          <h1 className="mb-3 text-[2rem] sm:text-[2.5rem] font-bold tracking-[-0.02em] text-[color:var(--color-text-primary)] animate-page-enter" style={{ textWrap: "balance" } as React.CSSProperties}>
            Insights for better ecommerce conversion
          </h1>
          <p className="text-sm sm:text-base text-[color:var(--color-text-secondary)] animate-page-enter-delay-1">
            Practical guides, experiments, benchmarks, and conversion insights from Asmos.
          </p>
        </div>
      </section>

      {/* Featured article */}
      {featured && (
        <section className="px-5 pb-10">
          <Link href={`/blog/${featured.slug}`} className="group mx-auto flex max-w-4xl flex-col sm:flex-row overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] transition-shadow duration-200 hover:shadow-md">
            <div className="sm:w-2/5">
              <BlogCoverPlaceholder category={featured.category} />
            </div>
            <div className="flex-1 p-6 sm:p-7">
              <span className="mb-3 inline-block rounded-full bg-[color:var(--color-primary-light)] px-2.5 py-1 text-[10px] font-semibold text-[color:var(--color-primary)]">{featured.category}</span>
              <h2 className="mb-2 text-lg font-bold text-[color:var(--color-text-primary)] leading-snug group-hover:text-[color:var(--color-primary)] transition-colors duration-200">{featured.title}</h2>
              <p className="mb-3 text-sm text-[color:var(--color-text-secondary)] leading-relaxed">{featured.excerpt}</p>
              <p className="text-[11px] text-[color:var(--color-text-secondary)]">{featured.author.name} · {featured.readTime}</p>
            </div>
          </Link>
        </section>
      )}

      {/* Search, filters, grid, newsletter */}
      <section className="px-5 py-10 sm:py-14">
        <BlogIndexClient posts={rest} />
      </section>

      {/* Free tools */}
      <section className="px-5 py-16 sm:py-24 bg-[color:var(--color-surface-sunken)] border-y border-[color:var(--color-border)]">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-10 text-2xl font-bold tracking-tight text-[color:var(--color-text-primary)]" style={{ textWrap: "balance" } as React.CSSProperties}>
            Put the insights into practice
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              { title: "Free Optimization Analysis", body: "Analyze your store and get actionable conversion recommendations.", cta: "Analyze My Store", href: "/analyze" },
              { title: "Email Capture Revenue Calculator", body: "Estimate how much additional revenue higher email capture could generate.", cta: "Calculate Revenue Opportunity", href: "/tools/email-capture-calculator" },
              { title: "Traffic Calculator", body: "Understand your traffic and conversion opportunity.", cta: "Try Calculator", href: "/tools/traffic-calculator" },
            ].map((tool) => (
              <div key={tool.title} className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 flex flex-col">
                <h3 className="mb-1.5 text-sm font-semibold text-[color:var(--color-text-primary)]">{tool.title}</h3>
                <p className="mb-4 text-xs text-[color:var(--color-text-secondary)] leading-relaxed flex-1">{tool.body}</p>
                <Link href={tool.href} className="text-xs font-semibold text-[color:var(--color-primary)]">{tool.cta} →</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-5 py-16 sm:py-24 text-center">
        <div className="mx-auto max-w-xl">
          <h2 className="mb-3 text-2xl font-bold tracking-tight text-[color:var(--color-text-primary)]" style={{ textWrap: "balance" } as React.CSSProperties}>
            Ready to apply what you&apos;ve learned?
          </h2>
          <p className="mb-7 text-sm text-[color:var(--color-text-secondary)]">Let Asmos continuously test and improve your ecommerce conversion experiences.</p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href={CTA.primary.href} className="rounded-lg bg-[color:var(--color-primary)] px-6 py-3 text-sm font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-[color:var(--color-primary-dark)] active:scale-[0.97]">
              {CTA.primary.label}
            </Link>
            <Link href={CTA.tertiary.href} className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-6 py-3 text-sm font-semibold text-[color:var(--color-text-primary)] transition-[background-color,transform] duration-200 hover:bg-white active:scale-[0.97]">
              {CTA.tertiary.label}
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
