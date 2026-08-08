import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { BlogCoverPlaceholder } from "@/components/marketing/BlogCoverPlaceholder";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildMetadata, articleJsonLd, breadcrumbJsonLd, faqJsonLd } from "@/lib/seo";
import { BLOG_POSTS, getPostBySlug, type BlogBlock } from "@/lib/blog/posts";
import { CTA } from "@/lib/site";

export function generateStaticParams() {
  return BLOG_POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return buildMetadata({ title: "Article not found", description: "", path: `/blog/${slug}`, noIndex: true });
  return buildMetadata({ title: post.seoTitle, description: post.metaDescription, path: `/blog/${post.slug}` });
}

const TOOL_CTA: Record<string, { label: string; href: string }> = {
  analysis: { label: "Try the Free Optimization Analysis", href: "/analyze" },
  calculator: { label: "Try the Email Capture Revenue Calculator", href: "/tools/email-capture-calculator" },
  trial: { label: CTA.primary.label, href: CTA.primary.href },
};

function renderBlock(block: BlogBlock, i: number) {
  if (block.type === "h2") {
    return (
      <h2 key={i} id={slugify(block.text)} className="mt-10 mb-3 text-xl font-bold text-[color:var(--color-text-primary)] scroll-mt-24">
        {block.text}
      </h2>
    );
  }
  if (block.type === "h3") {
    return (
      <h3 key={i} id={slugify(block.text)} className="mt-8 mb-2.5 text-base font-semibold text-[color:var(--color-text-primary)] scroll-mt-24">
        {block.text}
      </h3>
    );
  }
  if (block.type === "callout") {
    return (
      <div key={i} className="my-6 rounded-xl border border-[color:var(--color-primary)]/25 bg-[color:var(--color-primary-light)] px-5 py-4">
        <p className="mb-2 text-sm text-[color:var(--color-text-primary)]">{block.text}</p>
        <Link href={block.ctaHref} className="text-sm font-semibold text-[color:var(--color-primary)] underline underline-offset-2">
          {block.ctaLabel} →
        </Link>
      </div>
    );
  }
  return (
    <p key={i} className="mb-4 text-sm text-[color:var(--color-text-secondary)] leading-relaxed">
      {block.text}
    </p>
  );
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default async function BlogArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const headings = post.body.filter((b): b is Extract<BlogBlock, { type: "h2" | "h3" }> => b.type === "h2" || b.type === "h3");
  const related = BLOG_POSTS.filter((p) => p.slug !== post.slug && p.category === post.category).slice(0, 3);
  const relatedFallback = related.length > 0 ? related : BLOG_POSTS.filter((p) => p.slug !== post.slug).slice(0, 3);
  const toolCta = TOOL_CTA[post.ctaType];

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[color:var(--color-surface)]">
      <JsonLd
        data={articleJsonLd({
          title: post.title,
          description: post.metaDescription,
          slug: post.slug,
          image: post.coverImage || "/assets/asmos-logo-primary-lightbg.webp",
          authorName: post.author.name,
          publishDate: post.publishDate,
          updatedDate: post.updatedDate,
        })}
      />
      <JsonLd data={breadcrumbJsonLd([{ name: "Blog", path: "/blog" }, { name: post.title, path: `/blog/${post.slug}` }])} />
      {post.faq && post.faq.length > 0 && <JsonLd data={faqJsonLd(post.faq)} />}

      <MarketingHeader />

      <article className="px-5 py-10 sm:py-14">
        <div className="mx-auto max-w-5xl">
          {/* Breadcrumbs */}
          <nav className="mb-6 text-xs text-[color:var(--color-text-secondary)]">
            <Link href="/blog" className="hover:text-[color:var(--color-primary)]">Blog</Link>
            <span className="mx-1.5">/</span>
            <span className="text-[color:var(--color-text-primary)]">{post.title}</span>
          </nav>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-12">
            <div className="max-w-2xl">
              <span className="mb-3 inline-block rounded-full bg-[color:var(--color-primary-light)] px-2.5 py-1 text-[10px] font-semibold text-[color:var(--color-primary)]">{post.category}</span>
              <h1 className="mb-4 text-2xl sm:text-[2rem] font-bold tracking-[-0.02em] text-[color:var(--color-text-primary)] leading-tight" style={{ textWrap: "balance" } as React.CSSProperties}>
                {post.title}
              </h1>
              <div className="mb-8 flex flex-wrap items-center gap-3 text-xs text-[color:var(--color-text-secondary)]">
                <span>{post.author.name}</span>
                <span>·</span>
                <time dateTime={post.publishDate}>{new Date(post.publishDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</time>
                <span>·</span>
                <span>{post.readTime}</span>
                {post.updatedDate !== post.publishDate && (
                  <>
                    <span>·</span>
                    <span>Updated {new Date(post.updatedDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
                  </>
                )}
              </div>

              <BlogCoverPlaceholder category={post.category} />

              <div className="mt-8">
                {post.body.map((block, i) => renderBlock(block, i))}
              </div>

              {toolCta && (
                <div className="mt-10 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-6 text-center">
                  <p className="mb-3 text-sm font-medium text-[color:var(--color-text-primary)]">Want Asmos to run experiments like these for you?</p>
                  <Link href={toolCta.href} className="inline-flex items-center rounded-lg bg-[color:var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-[color:var(--color-primary-dark)] active:scale-[0.97]">
                    {toolCta.label}
                  </Link>
                </div>
              )}

              {/* Author block */}
              <div className="mt-10 flex items-center gap-3 border-t border-[color:var(--color-border)] pt-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--color-primary-light)] text-xs font-bold text-[color:var(--color-primary)]">
                  {post.author.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">{post.author.name}</p>
                  <p className="text-xs text-[color:var(--color-text-secondary)]">{post.author.role}</p>
                </div>
              </div>
            </div>

            {/* Sticky TOC */}
            {headings.length > 0 && (
              <aside className="hidden lg:block">
                <div className="sticky top-24 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-5">
                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--color-text-secondary)]">On this page</p>
                  <ul className="space-y-2">
                    {headings.map((h, i) => (
                      <li key={i} className={h.type === "h3" ? "pl-3" : ""}>
                        <a href={`#${slugify(h.text)}`} className="text-xs text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-primary)] leading-snug">
                          {h.text}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </aside>
            )}
          </div>

          {/* Related articles */}
          {relatedFallback.length > 0 && (
            <div className="mt-16 border-t border-[color:var(--color-border)] pt-10">
              <h2 className="mb-6 text-lg font-bold text-[color:var(--color-text-primary)]">Related articles</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                {relatedFallback.map((p) => (
                  <Link key={p.slug} href={`/blog/${p.slug}`} className="group rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] overflow-hidden transition-shadow duration-200 hover:shadow-md">
                    <BlogCoverPlaceholder category={p.category} />
                    <div className="p-5">
                      <h3 className="text-sm font-semibold text-[color:var(--color-text-primary)] leading-snug group-hover:text-[color:var(--color-primary)] transition-colors duration-200">{p.title}</h3>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Final CTA */}
          <div className="mt-16 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-8 text-center">
            <h2 className="mb-3 text-xl font-bold text-[color:var(--color-text-primary)]" style={{ textWrap: "balance" } as React.CSSProperties}>
              Ready to apply what you&apos;ve learned?
            </h2>
            <p className="mb-6 text-sm text-[color:var(--color-text-secondary)] max-w-sm mx-auto">
              Let Asmos continuously test and improve your ecommerce conversion experiences.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link href={CTA.primary.href} className="rounded-lg bg-[color:var(--color-primary)] px-6 py-3 text-sm font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-[color:var(--color-primary-dark)] active:scale-[0.97]">
                {CTA.primary.label}
              </Link>
              <Link href={CTA.tertiary.href} className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-6 py-3 text-sm font-semibold text-[color:var(--color-text-primary)] transition-[background-color,transform] duration-200 hover:bg-white active:scale-[0.97]">
                {CTA.tertiary.label}
              </Link>
            </div>
          </div>
        </div>
      </article>

      <MarketingFooter />
    </div>
  );
}
